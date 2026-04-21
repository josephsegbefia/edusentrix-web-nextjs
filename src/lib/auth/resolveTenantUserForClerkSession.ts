import mongoose from "mongoose";
import { User, type IUser } from "@/models/User";

const DEFAULT_SELECT =
  "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt clerkUserId name";

export function schoolIdFromClerkMetadata(cUser: {
  publicMetadata?: Record<string, unknown> | null;
  privateMetadata?: Record<string, unknown> | null;
}): string | undefined {
  const pub = cUser.publicMetadata?.schoolId;
  const priv = cUser.privateMetadata?.schoolId;
  return (
    (typeof pub === "string" ? pub : undefined) ||
    (typeof priv === "string" ? priv : undefined)
  );
}

/**
 * Moves clerkUserId onto `targetUserId` and removes it from any other user.
 * clerkUserId is globally unique (sparse) in Mongo.
 */
export async function attachClerkUserIdToUser(
  clerkUserId: string,
  targetUserId: mongoose.Types.ObjectId
): Promise<void> {
  await User.updateMany({ clerkUserId }, { $unset: { clerkUserId: 1 } });
  await User.updateOne({ _id: targetUserId }, { $set: { clerkUserId } });
}

type ResolveOpts = {
  clerkUserId: string;
  /** Lowercased primary email, or "" */
  email: string;
  schoolIdFromMetadata: string | undefined;
  select?: string;
};

/**
 * Resolves the Mongo user for this Clerk session without ambiguous email-only
 * lookup when the same email exists in multiple schools.
 *
 * Order:
 * 1. clerkUserId + schoolId (from Clerk metadata) when metadata school is valid
 * 2. email + schoolId (link clerk id to pre-provisioned user)
 * 3. clerkUserId alone — if metadata school disagrees with linked row, migrate
 *    clerk id to the metadata school's row when it exists; otherwise null (no cross-tenant leak)
 * 4. email alone — only when at most one user has this email (legacy)
 */
export async function resolveTenantUserForClerkSession(
  opts: ResolveOpts
): Promise<IUser | null> {
  const { clerkUserId, email, schoolIdFromMetadata } = opts;
  const select = opts.select ?? DEFAULT_SELECT;

  const metaOid =
    schoolIdFromMetadata && mongoose.isValidObjectId(schoolIdFromMetadata)
      ? new mongoose.Types.ObjectId(schoolIdFromMetadata)
      : null;

  const emailNorm = email.trim().toLowerCase();

  // 1) Tenant-scoped: Clerk id already on the school from metadata
  if (metaOid) {
    const scoped = (await User.findOne({
      clerkUserId,
      schoolId: metaOid,
    })
      .select(select)
      .lean()) as IUser | null;
    if (scoped) return scoped;

    // 2) Pre-provisioned user for this school — attach Clerk id
    if (emailNorm) {
      const target = (await User.findOne({
        email: emailNorm,
        schoolId: metaOid,
      })
        .select(select)
        .lean()) as IUser | null;
      if (target?._id) {
        await attachClerkUserIdToUser(
          clerkUserId,
          target._id instanceof mongoose.Types.ObjectId
            ? target._id
            : new mongoose.Types.ObjectId(String(target._id))
        );
        return (await User.findById(target._id).select(select).lean()) as IUser | null;
      }
    }
  }

  // 3) Existing Clerk link
  const byClerk = (await User.findOne({ clerkUserId })
    .select(select)
    .lean()) as IUser | null;

  if (byClerk) {
    const linkedSchool = byClerk.schoolId
      ? String(byClerk.schoolId)
      : null;
    const metaSchool = metaOid ? String(metaOid) : null;

    if (metaSchool && linkedSchool && linkedSchool !== metaSchool) {
      if (emailNorm) {
        const target = (await User.findOne({
          email: emailNorm,
          schoolId: metaOid!,
        })
          .select(select)
          .lean()) as IUser | null;
        if (target?._id) {
          await attachClerkUserIdToUser(
            clerkUserId,
            target._id instanceof mongoose.Types.ObjectId
              ? target._id
              : new mongoose.Types.ObjectId(String(target._id))
          );
          return (await User.findById(target._id).select(select).lean()) as IUser | null;
        }
      }
      return null;
    }

    if (
      metaSchool &&
      !linkedSchool &&
      emailNorm &&
      byClerk.role !== "platform_admin"
    ) {
      const target = (await User.findOne({
        email: emailNorm,
        schoolId: metaOid!,
      })
        .select(select)
        .lean()) as IUser | null;
      if (
        target?._id &&
        String(target._id) !== String(byClerk._id)
      ) {
        await attachClerkUserIdToUser(
          clerkUserId,
          target._id instanceof mongoose.Types.ObjectId
            ? target._id
            : new mongoose.Types.ObjectId(String(target._id))
        );
        return (await User.findById(target._id).select(select).lean()) as IUser | null;
      }
    }

    return byClerk;
  }

  // 4) Legacy: single email row only
  if (!emailNorm) return null;
  if (metaOid) return null;

  const dupCount = await User.countDocuments({ email: emailNorm });
  if (dupCount > 1) return null;

  const single = (await User.findOne({ email: emailNorm })
    .select(select)
    .lean()) as IUser | null;
  if (!single?._id) return null;

  await attachClerkUserIdToUser(
    clerkUserId,
    single._id instanceof mongoose.Types.ObjectId
      ? single._id
      : new mongoose.Types.ObjectId(String(single._id))
  );
  return (await User.findById(single._id).select(select).lean()) as IUser | null;
}
