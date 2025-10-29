"use client";
import { RoleGate } from "@/components/auth/role-gate";
import ParentSidebar from "@/components/nav/sidebars/parent-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["parent"]}>
      <div className="flex min-h-dvh">
        <ParentSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </RoleGate>
  );
}
