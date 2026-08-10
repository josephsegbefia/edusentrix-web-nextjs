import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import type { IDemoSession } from "@/models/DemoSession";
import type { CurrentAppUser } from "@/lib/auth/get-current-user";
import type { AppRole } from "@/lib/roles";

async function findPersonaUserByRole(
  schoolId: IDemoSession["sandboxSchoolId"],
  role: string
) {
  const membership = await UserMembership.findOne({
    schoolId,
    status: "active",
    roles: role,
  })
    .select("userId roles")
    .lean();

  if (membership?.userId) {
    return (await User.findById(membership.userId)
      .select(
        "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt"
      )
      .lean()) as IUser | null;
  }

  return (await User.findOne({
    schoolId,
    role,
  })
    .select(
      "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt"
    )
    .lean()) as IUser | null;
}

/**
 * Extended user shape returned by `/api/me` in demo mode.
 * Additive over the production `CurrentAppUser` (spec section 9.8).
 */
export type DemoAppUser = CurrentAppUser & {
  isDemo: true;
  demoSessionId: string;
  demoLeadId: string;
  demoSandboxId: string;
  demoPersonaRole: string;
  demoSchoolId: string;
};

/**
 * Resolve a full demo persona from an active session.
 *
 * The persona is backed by a real synthetic `User` document in the demo
 * database, so existing role helpers and page components work unchanged.
 */
export async function resolveDemoPersona(
  session: IDemoSession
): Promise<DemoAppUser | null> {
  if (!session.sandboxSchoolId) return null;

  await connectToDatabase();

  let user: IUser | null = null;

  if (session.activePersonaUserId) {
    user = (await User.findById(session.activePersonaUserId)
      .select(
        "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt"
      )
      .lean()) as IUser | null;
  }

  if (!user) {
    user = await findPersonaUserByRole(
      session.sandboxSchoolId,
      session.activePersonaRole || "school_admin"
    );
  }

  if (!user) return null;

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return {
    _id: String(user._id),
    email: user.email,
    name,
    avatarUrl: user.avatarUrl,
    role: (session.activePersonaRole || user.role) as AppRole | undefined,
    schoolId: String(session.sandboxSchoolId),
    pendingOnboarding: false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isDemo: true,
    demoSessionId: String(session._id),
    demoLeadId: String(session.leadId),
    demoSandboxId: session.sandboxId ? String(session.sandboxId) : "",
    demoPersonaRole: session.activePersonaRole || "school_admin",
    demoSchoolId: String(session.sandboxSchoolId),
  };
}

/**
 * Resolve demo persona's membership for guard helpers.
 */
export async function resolveDemoMembership(
  session: IDemoSession
): Promise<{
  user: Pick<IUser, "_id" | "schoolId" | "role" | "email">;
  membership: IUserMembership;
} | null> {
  const persona = await resolveDemoPersona(session);
  if (!persona) return null;

  await connectToDatabase();

  const user = (await User.findById(persona._id)
    .select("_id schoolId role email")
    .lean()) as Pick<IUser, "_id" | "schoolId" | "role" | "email"> | null;
  if (!user || !user.schoolId) return null;

  const membership = (await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  }).lean()) as IUserMembership | null;

  if (!membership) return null;

  return { user, membership };
}
