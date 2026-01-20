// src/lib/auth/get-current-user.ts
// test after moving to organization github
import "server-only";
import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import type { AppRole } from "@/lib/roles";

export type CurrentAppUser = {
  _id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role?: AppRole;
  schoolId?: string;
  pendingOnboarding?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function getCurrentUser(
  clerkUserId?: string
): Promise<CurrentAppUser | null> {
  const resolvedUserId = clerkUserId ?? (await auth()).userId;
  if (!resolvedUserId) return null;

  await connectToDatabase();

  let doc: IUser | null = (await User.findOne({ clerkUserId: resolvedUserId })
    .select(
      "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt"
    )
    .lean()) as IUser | null;

  if (!doc) {
    const clerk = await clerkClient();
    const cUser = await clerk.users.getUser(resolvedUserId);
    const email =
      cUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? undefined;

    if (email) {
      const byEmail = (await User.findOne({ email })
        .select(
          "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt"
        )
        .lean()) as IUser | null;

      if (byEmail) {
        await User.updateOne(
          { _id: byEmail._id },
          { $set: { clerkUserId: resolvedUserId } }
        );
        doc = { ...byEmail, clerkUserId: resolvedUserId };
      }
    }
  }

  if (!doc) return null;

  const name =
    [doc.firstName, doc.lastName].filter(Boolean).join(" ") || undefined;

  return {
    _id: String(doc._id),
    email: doc.email,
    name,
    avatarUrl: doc.avatarUrl,
    role: doc.role as AppRole | undefined,
    schoolId: doc.schoolId ? String(doc.schoolId) : undefined,
    pendingOnboarding: !!doc.pendingOnboarding,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function requireUser() {
  const me = await getCurrentUser();
  if (!me) {
    // Redirect to sign-in page if user is not authenticated
    redirect("/sign-in");
  }
  return me;
}
