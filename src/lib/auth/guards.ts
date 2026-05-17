// src/lib/auth/guards.ts
import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import type { AppRole } from "@/lib/roles";
import type { CurrentAppUser } from "./get-current-user";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";

export function assertRole(user: CurrentAppUser | null, allowed: AppRole[]) {
  if (!user) redirect("/login");
  if (!user.role || !allowed.includes(user.role)) {
    // Optional: send to a nicer 403 page
    redirect("/dashboard");
  }
}

/**
 * Require user to have one of the specified roles
 * Returns the user object if authorized, null if not
 * Used in API routes where you need the user object and want to handle errors manually
 */
export async function requireRole(...allowedRoles: AppRole[]) {
  const assisted = await getActiveAssistedAccessSession();
  if (assisted) {
    if (!allowedRoles.includes("school_admin")) return null;
    return {
      _id: assisted.actorUserId,
      schoolId: assisted.schoolId,
      role: "school_admin" as const,
    };
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return null;
  }

  await connectToDatabase();
  const userRaw = await User.findOne({ clerkUserId }).lean();
  const userNormalized = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const user = userNormalized as Pick<
    IUser,
    "_id" | "schoolId" | "role"
  > | null;

  if (!user) {
    return null;
  }

  if (!user.role || !allowedRoles.includes(user.role)) {
    return null;
  }

  return user;
}
