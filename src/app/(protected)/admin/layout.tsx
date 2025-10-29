"use client";
import { RoleGate } from "@/components/auth/role-gate";
import SchoolAdminSidebar from "@/components/nav/sidebars/school-admin-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["schoolAdmin"]}>
      <div className="flex min-h-dvh">
        <SchoolAdminSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </RoleGate>
  );
}
