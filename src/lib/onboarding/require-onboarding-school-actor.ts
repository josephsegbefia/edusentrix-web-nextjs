import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import type { ISchool } from "@/models/School";
import { ensureCanonicalUserForClerkSession } from "@/lib/auth/canonical-user";
import { schoolIdFromClerkMetadata } from "@/lib/auth/resolveTenantUserForClerkSession";
import { resolveOnboardingSchoolForUser } from "@/lib/onboarding/resolve-onboarding-school";
import { syncClerkNameFromAppUser } from "@/lib/auth/sync-clerk-name";

export type OnboardingSchoolActorResult =
  | {
      ok: true;
      user: IUser;
      school: ISchool;
      email: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function requireOnboardingSchoolActor(
  clerkUserId: string
): Promise<OnboardingSchoolActorResult> {
  await connectToDatabase();

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(clerkUserId);

  const email =
    clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ||
    clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase() ||
    "";

  if (!email) {
    return {
      ok: false,
      status: 401,
      error: "No email associated with this account",
    };
  }

  let appUser: IUser;
  try {
    const roleFromMetadata =
      (clerkUser.publicMetadata?.role as string | undefined) || "school_admin";
    appUser = await ensureCanonicalUserForClerkSession({
      clerkUserId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      avatarUrl: clerkUser.imageUrl,
      role: roleFromMetadata,
      schoolId: schoolIdFromClerkMetadata(clerkUser),
    });
    await syncClerkNameFromAppUser({
      clerkUserId,
      currentClerkFirstName: clerkUser.firstName,
      currentClerkLastName: clerkUser.lastName,
      appFirstName: appUser.firstName,
      appLastName: appUser.lastName,
      appDisplayName: appUser.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve app user";
    return { ok: false, status: 500, error: message };
  }

  const school = await resolveOnboardingSchoolForUser({
    appUser,
    email,
    clerkSchoolId: schoolIdFromClerkMetadata(clerkUser),
  });

  if (!school) {
    return { ok: false, status: 409, error: "No school bound" };
  }

  const userId =
    appUser._id instanceof mongoose.Types.ObjectId
      ? appUser._id
      : new mongoose.Types.ObjectId(String(appUser._id));

  const user = (await User.findById(userId).lean()) as IUser | null;
  if (!user) {
    return { ok: false, status: 404, error: "User not found" };
  }

  return { ok: true, user, school, email };
}
