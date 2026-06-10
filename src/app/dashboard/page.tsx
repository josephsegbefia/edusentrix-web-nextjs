export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

export default async function DashboardHub() {
  const active = await resolveActiveSchoolContext();

  if (active.ok) {
    redirect(active.context.homePath);
  }

  const appUser = await getCurrentUser();
  if (!appUser) {
    redirect("/sign-in");
  }

  if (appUser.pendingOnboarding) {
    redirect("/launch");
  }

  if (appUser.role === "platform_admin") {
    redirect("/platform");
  }

  if (active.reason === "needs_school_selection") {
    redirect("/auth/switch");
  }

  if (active.reason === "no_memberships") {
    redirect("/launch");
  }

  redirect("/auth/switch");
}
