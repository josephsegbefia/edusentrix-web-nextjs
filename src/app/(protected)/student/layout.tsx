"use client";
import { RoleGate } from "@/components/auth/role-gate";
import StudentSidebar from "@/components/nav/sidebars/student-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["student"]}>
      <div className="flex min-h-dvh">
        <StudentSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </RoleGate>
  );
}
