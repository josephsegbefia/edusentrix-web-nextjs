"use client";
import { RoleGate } from "@/components/auth/role-gate";
import TeacherSidebar from "@/components/nav/sidebars/teacher-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["teacher"]}>
      <div className="flex min-h-dvh">
        <TeacherSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </RoleGate>
  );
}
