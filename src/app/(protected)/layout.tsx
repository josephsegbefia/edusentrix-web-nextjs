import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { routeForRoles, type AppRole } from "@/lib/roles";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login?error=unauthorized");
  }

  await connectToDatabase();
  const appUserResult = await User.findOne({
    supabaseUserId: data.user.id,
  }).lean();
  const appUser = appUserResult as IUser | null;

  if (!appUser) {
    // No app user mapped yet — bounce to login (or a lightweight linkage page)
    redirect("/login?error=no_user");
  }

  // At this point, TypeScript knows appUser is IUser (not null)
  // Optional: if a school admin still pending, force them to /onboard
  // Normalize roles - convert school_admin to school_admin for consistency
  const rawRoles = Array.isArray(appUser.roles) ? appUser.roles : [];
  const roles = rawRoles.map((r) =>
    r === "school_admin" ? "school_admin" : r
  ) as AppRole[];
  const pendingOnboarding = !!appUser.pendingOnboarding;
  const target = routeForRoles(roles, pendingOnboarding);

  // If they’re not allowed to be here, push them to their home
  // (Basic guard; we keep it simple to avoid hard-coding per-route ACL)
  // You can make this smarter later per-route.
  // NOTE: We don't redirect if already on /onboard
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pathname = ""; // derive from headers if you want strict route gating

  // If they're school_admin and pending, force onboarding except on /onboard itself:
  const isSchool_admin = roles.includes("school_admin" as AppRole);
  if (isSchool_admin && pendingOnboarding) {
    if (target !== "/onboard") redirect("/onboard");
  }

  return <>{children}</>;
}
