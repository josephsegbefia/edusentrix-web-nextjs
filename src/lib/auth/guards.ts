/* eslint-disable @typescript-eslint/no-explicit-any */
import connectToDatabase from "@/db/connectToDatabase";
import { supabaseServer } from "../supabase/server";
import { User } from "@/models/User";

export async function getCurrentUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  await connectToDatabase();
  const appUser = await User.findOne({ supabaseUserId: data.user.id });
  return appUser;
}

export async function requireRole(...roles: Array<"platform_admin" | "staff">) {
  const user = await getCurrentUser();
  if (!user) return null;
  const ok = user.roles.some((r: any) => roles.includes(r as any));
  return ok ? user : null;
}
