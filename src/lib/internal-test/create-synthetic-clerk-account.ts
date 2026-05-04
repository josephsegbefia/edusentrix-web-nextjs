import "server-only";
import mongoose from "mongoose";
import { clerkClient } from "@clerk/nextjs/server";
import type { MembershipRole } from "@/lib/roles";

export async function createSyntheticClerkAccount(input: {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  role: MembershipRole;
  schoolId: mongoose.Types.ObjectId;
}): Promise<{ clerkUserId: string }> {
  const clerk = await clerkClient();
  const created = await clerk.users.createUser({
    emailAddress: [input.email],
    password: input.password,
    firstName: input.firstName?.trim() || undefined,
    lastName: input.lastName?.trim() || undefined,
    publicMetadata: {
      role: input.role,
      schoolId: String(input.schoolId),
    },
    skipPasswordChecks: true,
    skipLegalChecks: true,
  });
  return { clerkUserId: created.id };
}
