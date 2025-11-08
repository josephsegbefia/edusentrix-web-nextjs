import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "../supabase/server";
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
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;

  await connectToDatabase();

  const doc = await User.findOne({ supabaseUserId: authUser.id })
    .select(
      "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt"
    )
    .lean();
  if (!doc || Array.isArray(doc)) {
    // User exists in Supabase but not in our database yet.

    return {
      _id: "unknown",
      email: authUser.email ?? "",
      role: undefined,
      schoolId: undefined,
      pendingOnboarding: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

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

// Helper for layouts that must enforce login
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
