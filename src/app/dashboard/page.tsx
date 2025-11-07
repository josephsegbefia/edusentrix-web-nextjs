export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { connectToDatabase } from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User, type IUser } from "@/models/User";

function routeFor(user: {
  role: string | null;
  primaryRole?: string | null;
  pendingOnboarding?: boolean;
}) {
  if (user.pendingOnboarding) return "/onboard";
  const r = (user.role || "").toLowerCase();
  const primary = (user.primaryRole || "").toLowerCase();

  // Platform admin -> /appsentrix (matches protected route structure)
  if (r === "platform_admin" || r === "platformadmin") return "/appsentrix";

  // School admin -> /admin (matches protected route structure)
  if (
    r === "schooladmin" ||
    r === "school_admin" ||
    r === "admin" ||
    primary === "schooladmin"
  )
    return "/admin";

  // Other roles -> their respective protected routes
  if (primary === "teacher") return "/teacher";
  if (primary === "parent") return "/parent";
  if (primary === "student") return "/student";
  if (primary === "bursar") return "/bursar";

  // Default to onboarding if role is unknown
  return "/onboard";
}

export default async function DashboardHub() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  await connectToDatabase();
  const appUser = await User.findOne({
    supabaseUserId: data.user.id,
  })
    .select("roles pendingOnboarding")
    .lean<IUser>();

  if (!appUser) redirect("/onboard"); // fresh invite, no user doc yet

  // Get primary role (prioritize platform_admin, otherwise use first role)
  const roles = (
    Array.isArray(appUser.roles) && appUser.roles.length > 0
      ? appUser.roles
      : appUser.role
      ? [appUser.role]
      : []
  ) as string[];
  const primaryRole = roles.includes("platform_admin")
    ? "platform_admin"
    : roles[0];
  // Normalize role name (convert camelCase to snake_case for consistency)
  const role =
    primaryRole === "schoolAdmin" ? "school_admin" : primaryRole || null;

  redirect(
    routeFor({
      role,
      primaryRole,
      pendingOnboarding: !!appUser.pendingOnboarding,
    })
  );
}
