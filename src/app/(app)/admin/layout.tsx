// src/app/(app)/admin/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import { resolveAdminShellAccess } from "@/lib/auth/resolveAdminShellAccess";
import SchoolAdminSidebar from "@/components/nav/sidebars/school-admin-sidebar";
import BursarSidebar from "@/components/nav/sidebars/bursar-sidebar";
import BillingOwnerSidebar from "@/components/nav/sidebars/billing-owner-sidebar";
import DelegatedAdminSidebar from "@/components/nav/sidebars/delegated-admin-sidebar";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import { AdminRolePathGuard } from "@/components/auth/admin-role-path-guard";
import { AdminDelegatePathGuard } from "@/components/auth/admin-delegate-path-guard";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { AdminMainContent } from "@/components/nav/sidebars/admin-main-content";
import { AdminContextualDelegateBar } from "@/components/delegations/AdminContextualDelegateBar";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";
import { AdminTrialBanner } from "@/components/billing/AdminTrialBanner";
import { AdminLeoEntry } from "@/components/leo/AdminLeoEntry";
import SuspendedOverlay from "@/components/billing/SuspendedOverlay";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const shell = await resolveAdminShellAccess(user);

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

  if (shell.kind === "delegated_admin") {
    return (
      <>
        <AuthRefreshHandler />
        <AdminDelegatePathGuard
          allowedPrefixes={shell.allowedPathPrefixes}
          homeHref={shell.homeHref}
        />
        {snapshot?.subscription.status === "trial" ? (
          <AdminTrialBanner endsAt={snapshot.subscription.pilotEndsAt || null} />
        ) : null}
        <SidebarProvider>
          <div className="flex min-h-[calc(100vh-3.5rem)]">
            <DelegatedAdminSidebar
              navItems={shell.navItems}
              homeHref={shell.homeHref}
            />
            <AdminMainContent isBursar={false}>
              <AdminContextualDelegateBar canManageDelegations={false} />
              {children}
            </AdminMainContent>
          </div>
        </SidebarProvider>
      </>
    );
  }

  assertRole(user, ["school_admin", "bursar", "billing_owner"]);
  const isBursar = user.role === "bursar";
  const isBillingOwner = user.role === "billing_owner";
  const isSchoolAdmin = user.role === "school_admin";

  return (
    <>
      <AuthRefreshHandler />
      <AdminRolePathGuard
        role={user.role}
        bursarExtraAllowedPrefixes={
          shell.kind === "bursar" ? shell.delegatedAdminPrefixes : []
        }
      />
      {snapshot?.subscription.status === "trial" ? (
        <AdminTrialBanner endsAt={snapshot.subscription.pilotEndsAt || null} />
      ) : null}
      <SidebarProvider>
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          {isBillingOwner ? (
            <BillingOwnerSidebar />
          ) : isBursar ? (
            <BursarSidebar
              delegatedNavItems={
                shell.kind === "bursar" ? shell.delegatedNavItems : []
              }
            />
          ) : (
            <SchoolAdminSidebar />
          )}
          <AdminMainContent isBursar={isBursar || isBillingOwner}>
            <AdminContextualDelegateBar canManageDelegations={isSchoolAdmin} />
            {children}
          </AdminMainContent>
        </div>
        <AdminLeoEntry />
      </SidebarProvider>
    </>
  );
}
