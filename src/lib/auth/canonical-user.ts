import mongoose from "mongoose";
import { User, type IUser } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { Invitation } from "@/models/Invitation";
import { Invite } from "@/models/Invite";
import type { AppRole, MembershipRole } from "@/lib/roles";
import { isMembershipRole } from "@/lib/roles";
import { attachClerkUserIdToUser } from "@/lib/auth/resolveTenantUserForClerkSession";
import { resolveSchoolIdForOnboarding } from "@/lib/onboarding/school-id-for-onboarding";

const DEFAULT_SELECT =
  "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt clerkUserId name";

type ClerkProfile = {
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  schoolId?: string | null;
};

type EnsureCanonicalUserOptions = ClerkProfile & {
  select?: string;
  pendingOnboarding?: boolean;
};

type EnsureCanonicalUserForEmailOptions = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  schoolId?: string | mongoose.Types.ObjectId | null;
  pendingOnboarding?: boolean;
  select?: string;
};

export function normalizeIdentityEmail(email: string | null | undefined) {
  return (email || "").trim().toLowerCase();
}

function toObjectIdOrNull(value: unknown): mongoose.Types.ObjectId | null {
  if (!value || !mongoose.isValidObjectId(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function roleForMembership(role: string | null | undefined): MembershipRole | null {
  if (!role || !isMembershipRole(role)) return null;
  return role;
}

function composeDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function splitDisplayName(fullName: string | null | undefined) {
  const trimmed = (fullName || "").trim();
  if (!trimmed) {
    return { firstName: undefined, lastName: undefined };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || undefined,
    lastName: parts.slice(1).join(" ") || undefined,
  };
}

async function findPendingSchoolInvite(email: string) {
  const now = new Date();
  const [invitation, legacyInvite] = await Promise.all([
    Invitation.findOne({
      email,
      status: "pending",
      expiresAt: { $gt: now },
    })
      .sort({ sentAt: -1 })
      .select("schoolId role")
      .lean<{ schoolId: mongoose.Types.ObjectId; role: string } | null>(),
    Invite.findOne({
      email,
      status: "pending",
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .select("schoolId")
      .lean<{ schoolId: mongoose.Types.ObjectId } | null>(),
  ]);

  if (invitation?.schoolId) {
    return {
      schoolId: invitation.schoolId,
      role: roleForMembership(invitation.role),
    };
  }

  if (legacyInvite?.schoolId) {
    return {
      schoolId: legacyInvite.schoolId,
      role: "school_admin" as MembershipRole,
    };
  }

  return null;
}

export async function ensureMembershipForUser(input: {
  userId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  role?: string | null;
  status?: "active" | "invited" | "suspended";
}) {
  const role = roleForMembership(input.role);
  const update: Record<string, unknown> = {
    $set: { status: input.status || "active" },
    $setOnInsert: {
      userId: input.userId,
      schoolId: input.schoolId,
    },
  };

  if (role) {
    update.$addToSet = { roles: role };
  }

  return UserMembership.findOneAndUpdate(
    { userId: input.userId, schoolId: input.schoolId },
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export async function ensureCanonicalUserForClerkSession(
  options: EnsureCanonicalUserOptions
): Promise<IUser> {
  const email = normalizeIdentityEmail(options.email);
  const select = options.select ?? DEFAULT_SELECT;
  const schoolOid = toObjectIdOrNull(options.schoolId);
  const role = options.role || undefined;

  if (!email) {
    throw new Error("A primary email is required to resolve an app user.");
  }

  const pendingInvite = !schoolOid ? await findPendingSchoolInvite(email) : null;
  let effectiveSchoolId = schoolOid || pendingInvite?.schoolId || null;
  let effectiveRole = role || pendingInvite?.role || undefined;

  let user = (await User.findOne({ clerkUserId: options.clerkUserId })
    .select(select)
    .lean()) as IUser | null;

  if (!user && effectiveSchoolId) {
    user = (await User.findOne({ email, schoolId: effectiveSchoolId })
      .select(select)
      .lean()) as IUser | null;
  }

  if (!user) {
    const emailMatches = (await User.find({ email })
      .sort({ schoolId: -1, updatedAt: -1, createdAt: -1 })
      .limit(2)
      .select(select)
      .lean()) as IUser[];

    if (emailMatches.length === 1) {
      user = emailMatches[0];
    } else if (emailMatches.length > 1) {
      throw new Error(
        `Multiple app users already exist for ${email}. Run the identity merge migration before linking a new Clerk session.`
      );
    }
  }

  if (!effectiveSchoolId) {
    const resolvedSchoolId = await resolveSchoolIdForOnboarding({
      userId: user?._id
        ? user._id instanceof mongoose.Types.ObjectId
          ? user._id
          : new mongoose.Types.ObjectId(String(user._id))
        : null,
      email,
      userSchoolId: user?.schoolId,
      clerkSchoolId: options.schoolId,
    });
    if (resolvedSchoolId) {
      effectiveSchoolId = resolvedSchoolId;
      if (!effectiveRole) {
        effectiveRole = "school_admin";
      }
    }
  }

  if (user?._id) {
    const userId =
      user._id instanceof mongoose.Types.ObjectId
        ? user._id
        : new mongoose.Types.ObjectId(String(user._id));
    const fallbackNameParts = splitDisplayName(user.name);

    const nextFirstName =
      user.firstName || fallbackNameParts.firstName || options.firstName || undefined;
    const nextLastName =
      user.lastName || fallbackNameParts.lastName || options.lastName || undefined;
    const nextDisplayName = composeDisplayName(nextFirstName, nextLastName);

    if (!user.clerkUserId || user.clerkUserId === options.clerkUserId) {
      await attachClerkUserIdToUser(options.clerkUserId, userId);
    }

    const set: Record<string, unknown> = {
      ...(options.firstName && !user.firstName ? { firstName: options.firstName } : {}),
      ...(options.lastName && !user.lastName ? { lastName: options.lastName } : {}),
      ...(fallbackNameParts.firstName && !user.firstName
        ? { firstName: fallbackNameParts.firstName }
        : {}),
      ...(fallbackNameParts.lastName && !user.lastName
        ? { lastName: fallbackNameParts.lastName }
        : {}),
      ...(nextDisplayName && !user.name ? { name: nextDisplayName } : {}),
      ...(options.avatarUrl && !user.avatarUrl
        ? { avatarUrl: options.avatarUrl }
        : {}),
      ...(effectiveRole && !user.role ? { role: effectiveRole as AppRole } : {}),
      ...(effectiveSchoolId && !user.schoolId ? { schoolId: effectiveSchoolId } : {}),
      ...(options.pendingOnboarding !== undefined
        ? { pendingOnboarding: options.pendingOnboarding }
        : {}),
    };

    if (Object.keys(set).length > 0) {
      await User.updateOne({ _id: userId }, { $set: set });
    }

    if (effectiveSchoolId && effectiveRole) {
      await ensureMembershipForUser({
        userId,
        schoolId: effectiveSchoolId,
        role: effectiveRole,
        status: "active",
      });
    }

    return (await User.findById(userId).select(select).lean()) as IUser;
  }

  const created = await User.create({
    clerkUserId: options.clerkUserId,
    email,
    name: composeDisplayName(options.firstName, options.lastName) || undefined,
    firstName: options.firstName || undefined,
    lastName: options.lastName || undefined,
    avatarUrl: options.avatarUrl || undefined,
    role: effectiveRole as AppRole | undefined,
    schoolId: effectiveSchoolId || undefined,
    pendingOnboarding:
      options.pendingOnboarding ?? effectiveRole === "school_admin",
  });

  if (effectiveSchoolId && effectiveRole) {
    await ensureMembershipForUser({
      userId: created._id,
      schoolId: effectiveSchoolId,
      role: effectiveRole,
      status: "active",
    });
  }

  return created.toObject() as IUser;
}

export async function ensureCanonicalUserForEmail(
  options: EnsureCanonicalUserForEmailOptions
): Promise<IUser> {
  const email = normalizeIdentityEmail(options.email);
  const select = options.select ?? DEFAULT_SELECT;
  const schoolOid = toObjectIdOrNull(options.schoolId);
  const role = options.role || undefined;

  if (!email) {
    throw new Error("An email is required to resolve an app user.");
  }

  let user = schoolOid
    ? ((await User.findOne({ email, schoolId: schoolOid })
        .select(select)
        .lean()) as IUser | null)
    : null;

  if (!user) {
    const emailMatches = (await User.find({ email })
      .sort({ schoolId: -1, updatedAt: -1, createdAt: -1 })
      .limit(2)
      .select(select)
      .lean()) as IUser[];

    if (emailMatches.length === 1) {
      user = emailMatches[0];
    } else if (emailMatches.length > 1) {
      throw new Error(
        `Multiple app users already exist for ${email}. Run the identity merge migration before adding another school membership.`
      );
    }
  }

  if (user?._id) {
    const userId =
      user._id instanceof mongoose.Types.ObjectId
        ? user._id
        : new mongoose.Types.ObjectId(String(user._id));
    const fallbackNameParts = splitDisplayName(options.name || user.name);
    const nextFirstName =
      user.firstName || options.firstName || fallbackNameParts.firstName || undefined;
    const nextLastName =
      user.lastName || options.lastName || fallbackNameParts.lastName || undefined;
    const nextDisplayName =
      options.name || user.name || composeDisplayName(nextFirstName, nextLastName) || undefined;
    const set: Record<string, unknown> = {
      ...(nextDisplayName && !user.name ? { name: nextDisplayName } : {}),
      ...(options.firstName && !user.firstName ? { firstName: options.firstName } : {}),
      ...(options.lastName && !user.lastName ? { lastName: options.lastName } : {}),
      ...(fallbackNameParts.firstName && !user.firstName
        ? { firstName: fallbackNameParts.firstName }
        : {}),
      ...(fallbackNameParts.lastName && !user.lastName
        ? { lastName: fallbackNameParts.lastName }
        : {}),
      ...(options.phone ? { phone: options.phone } : {}),
      ...(options.avatarUrl && !user.avatarUrl
        ? { avatarUrl: options.avatarUrl }
        : {}),
      ...(role && !user.role ? { role: role as AppRole } : {}),
      ...(schoolOid && !user.schoolId ? { schoolId: schoolOid } : {}),
      ...(options.pendingOnboarding !== undefined
        ? { pendingOnboarding: options.pendingOnboarding }
        : {}),
    };

    if (Object.keys(set).length > 0) {
      await User.updateOne({ _id: userId }, { $set: set });
    }

    if (schoolOid && role) {
      await ensureMembershipForUser({
        userId,
        schoolId: schoolOid,
        role,
        status: "invited",
      });
    }

    return (await User.findById(userId).select(select).lean()) as IUser;
  }

  const created = await User.create({
    email,
    name: options.name || undefined,
    firstName: options.firstName || undefined,
    lastName: options.lastName || undefined,
    phone: options.phone || undefined,
    avatarUrl: options.avatarUrl || undefined,
    role: role as AppRole | undefined,
    schoolId: schoolOid || undefined,
    pendingOnboarding:
      options.pendingOnboarding ?? role === "school_admin",
  });

  if (schoolOid && role) {
    await ensureMembershipForUser({
      userId: created._id,
      schoolId: schoolOid,
      role,
      status: "invited",
    });
  }

  return created.toObject() as IUser;
}
