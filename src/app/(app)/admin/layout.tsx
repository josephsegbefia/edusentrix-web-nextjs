// src/app/(app)/admin/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
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
import { AdminLeoEntry } from "@/components/leo/AdminLeoEntry";
import { AssistedAccessBanner } from "@/components/platform/assisted-access/AssistedAccessBanner";
import type { AppRole } from "@/lib/roles";

function shellRoleForPathGuard(
  kind: Awaited<ReturnType<typeof resolveAdminShellAccess>>["kind"]
): AppRole | undefined {
  if (kind === "full_school_admin") return "school_admin";
  if (kind === "bursar") return "bursar";
  if (kind === "billing_owner") return "billing_owner";
  return undefined;
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser();
  const shell = await resolveAdminShellAccess();

  if (shell.kind === "delegated_admin") {
    return (
      <>
        <AuthRefreshHandler />
        <AssistedAccessBanner />
        <AdminDelegatePathGuard
          allowedPrefixes={shell.allowedPathPrefixes}
          homeHref={shell.homeHref}
        />
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

  const isBursar = shell.kind === "bursar";
  const isBillingOwner = shell.kind === "billing_owner";
  const isSchoolAdmin = shell.kind === "full_school_admin";

  return (
    <>
      <AuthRefreshHandler />
      <AssistedAccessBanner />
      <AdminRolePathGuard
        role={shellRoleForPathGuard(shell.kind)}
        bursarExtraAllowedPrefixes={
          shell.kind === "bursar" ? shell.delegatedAdminPrefixes : []
        }
      />
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
