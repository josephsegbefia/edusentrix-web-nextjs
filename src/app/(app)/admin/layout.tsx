// src/app/(app)/admin/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import SchoolAdminSidebar from "@/components/nav/sidebars/school-admin-sidebar";
import BursarSidebar from "@/components/nav/sidebars/bursar-sidebar";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import { AdminRolePathGuard } from "@/components/auth/admin-role-path-guard";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { AdminMainContent } from "@/components/nav/sidebars/admin-main-content";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";
import TrialBanner from "@/components/billing/TrialBanner";
import SuspendedOverlay from "@/components/billing/SuspendedOverlay";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["school_admin", "bursar"]);
  const isBursar = user.role === "bursar";
  const snapshot = user.schoolId
    ? await getSchoolSubscriptionSnapshot(user.schoolId)
    : null;

  if (
    snapshot &&
    (snapshot.subscription.status === "suspended" ||
      snapshot.subscription.status === "cancelled")
  ) {
    return <SuspendedOverlay status={snapshot.subscription.status} />;
  }

  return (
    <>
      <AuthRefreshHandler />
      <AdminRolePathGuard role={user.role} />
      {snapshot?.subscription.status === "trial" ? (
        <TrialBanner endsAt={snapshot.subscription.pilotEndsAt || null} />
      ) : null}
      <SidebarProvider>
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          {isBursar ? <BursarSidebar /> : <SchoolAdminSidebar />}
          <AdminMainContent isBursar={isBursar}>{children}</AdminMainContent>
        </div>
      </SidebarProvider>
    </>
  );
}
