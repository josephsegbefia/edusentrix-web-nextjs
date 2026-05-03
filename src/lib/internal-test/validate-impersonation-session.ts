import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { User, type IUser } from "@/models/User";
import { InternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import { userHasInternalTestManage } from "@/lib/internal-test/platform-access";
import {
  getInternalTestImpersonationSecret,
  INTERNAL_TEST_IMPERSONATION_COOKIE,
} from "./impersonation-secret";
import { verifyImpersonationToken, type ImpersonationTokenPayload } from "./impersonation-token";

export type ValidatedImpersonation = {
  payload: ImpersonationTokenPayload;
  actor: Pick<IUser, "_id" | "role" | "clerkUserId" | "platformPermissionKeys">;
  target: IUser;
};

/**
 * Validates the internal-test impersonation cookie for the current Clerk session.
 * Actor must be a platform admin with internal-test manage; target must be a test user
 * in an internal test school with allowImpersonation.
 */
export async function validateInternalTestImpersonationSession(): Promise<ValidatedImpersonation | null> {
  const secret = getInternalTestImpersonationSecret();
  if (!secret) return null;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const jar = await cookies();
  const raw = jar.get(INTERNAL_TEST_IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;

  const verified = verifyImpersonationToken(secret, raw);
  if (!verified || verified.actorClerkId !== clerkUserId) return null;

  await connectToDatabase();

  const actorRaw = await User.findOne({ clerkUserId }).select("_id role clerkUserId platformPermissionKeys").lean();
  const actor = Array.isArray(actorRaw) ? actorRaw[0] : actorRaw;
  if (!actor || actor.role !== "platform_admin" || !userHasInternalTestManage(actor)) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(verified.targetUserId) || !mongoose.Types.ObjectId.isValid(verified.schoolId)) {
    return null;
  }

  const target = await User.findById(verified.targetUserId).lean<IUser | null>();
  if (!target || !target.isTestUser) return null;
  if (String(target.schoolId) !== verified.schoolId) return null;

  const school = await School.findById(verified.schoolId)
    .select("isInternalTestSchool internalTest")
    .lean();
  if (!school?.isInternalTestSchool || !school.internalTest?.enabled) return null;

  const config = await InternalTestSchoolConfig.findOne({
    schoolId: new mongoose.Types.ObjectId(verified.schoolId),
  }).lean();
  if (!config?.allowImpersonation) return null;

  return {
    payload: verified,
    actor,
    target,
  };
}
