// src/app/(app)/admin/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import SchoolAdminSidebar from "@/components/nav/sidebars/school-admin-sidebar";
import BursarSidebar from "@/components/nav/sidebars/bursar-sidebar";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import { AdminRolePathGuard } from "@/components/auth/admin-role-path-guard";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["school_admin", "bursar"]);
  const isBursar = user.role === "bursar";

  return (
    <>
      <AuthRefreshHandler />
      <AdminRolePathGuard role={user.role} />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {isBursar ? <BursarSidebar /> : <SchoolAdminSidebar />}
        <main className="flex-1 p-4 pt-16 md:pt-4 md:ml-64">{children}</main>
      </div>
    </>
  );
}
