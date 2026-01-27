export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

function routeFor(user: { role?: string | null; pendingOnboarding?: boolean }) {
  if (user.pendingOnboarding) return "/onboarding";

  const r = (user.role || "").toLowerCase();

  // Platform admin -> /platform
  if (r === "platform_admin" || r === "platformadmin") return "/platform";

  // School admin -> /admin
  if (r === "school_admin" || r === "schooladmin" || r === "admin") {
    return "/admin";
  }

  // Other roles -> their respective routes
  if (r === "teacher") return "/teacher";
  if (r === "parent") return "/parent";
  if (r === "student") return "/student";
  if (r === "bursar") return "/bursar";

  // Default to onboarding if role is unknown
  return "/onboarding";
}

export default async function DashboardHub() {
  const appUser = await getCurrentUser();

  if (!appUser) {
    redirect("/sign-in");
  }

  redirect(
    routeFor({
      role: appUser.role,
      pendingOnboarding: appUser.pendingOnboarding,
    })
  );
}
