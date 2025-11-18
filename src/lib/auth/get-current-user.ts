import "server-only";
import { redirect } from "next/navigation";
import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

export type AppRole =
  | "platform_admin"
  | "school_admin"
  | "staff"
  | "teacher"
  | "parent"
  | "student";

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

export async function getCurrentUser(): Promise<CurrentAppUser | null> {
  const authResult = await auth();
  const userId = authResult.userId;
  if (!userId) return null;

  await connectToDatabase();

  // We use clerkUserId as the canonical identity link
  const docRaw = await User.findOne({ clerkUserId: userId })
    .select(
      "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt"
    )
    .lean();

  // Normalize to ensure it's a single document, not an array
  const doc = Array.isArray(docRaw) ? docRaw[0] : docRaw;

  if (!doc) {
    // As a fallback, try by email
    const cu = await clerkCurrentUser();
    const email = cu?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    if (!email) return null;

    const byEmailRaw = await User.findOne({ email }).lean();
    if (!byEmailRaw) return null;

    // Normalize to ensure it's a single document, not an array
    const byEmail = Array.isArray(byEmailRaw) ? byEmailRaw[0] : byEmailRaw;
    if (!byEmail) return null;

    // bind clerkUserId now for future lookups
    await User.updateOne(
      { _id: byEmail._id },
      { $set: { clerkUserId: userId } }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byEmailTyped = byEmail as any;
    const name =
      [byEmailTyped.firstName, byEmailTyped.lastName]
        .filter(Boolean)
        .join(" ") || undefined;
    return {
      _id: String(byEmail._id),
      email: byEmail.email,
      name,
      avatarUrl: byEmail.avatarUrl,
      role: byEmail.role as AppRole | undefined,
      schoolId: byEmail.schoolId ? String(byEmail.schoolId) : undefined,
      pendingOnboarding: !!byEmail.pendingOnboarding,
      createdAt: byEmail.createdAt,
      updatedAt: byEmail.updatedAt,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docTyped = doc as any;
  const name =
    [docTyped.firstName, docTyped.lastName].filter(Boolean).join(" ") ||
    undefined;
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
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
