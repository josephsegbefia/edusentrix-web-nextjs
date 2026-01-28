// src/app/(app)/teacher/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import TeacherSidebar from "@/components/nav/sidebars/teacher-sidebar";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["teacher"]);
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <TeacherSidebar />
      <main className="flex-1 p-4 pt-16 md:pt-4 md:ml-64">{children}</main>
    </div>
  );
}
