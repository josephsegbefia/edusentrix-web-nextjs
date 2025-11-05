"use client";
import { RoleGate } from "@/components/auth/role-gate";
import AppsentrixSidebar from "@/components/nav/sidebars/appsesntrix-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["platform_admin"]}>
      <div className="flex min-h-dvh">
        <AppsentrixSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </RoleGate>
  );
}
