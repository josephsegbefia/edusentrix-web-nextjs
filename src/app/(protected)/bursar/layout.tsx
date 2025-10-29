"use client";
import { RoleGate } from "@/components/auth/role-gate";
import BursarSidebar from "@/components/nav/sidebars/bursar-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["bursar"]}>
      <div className="flex min-h-dvh">
        <BursarSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </RoleGate>
  );
}
