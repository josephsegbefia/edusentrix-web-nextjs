// src/app/(app)/teacher/layout.tsx
import { ReactNode } from "react";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireTeacher({ mode: "page" });
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <TeacherSidebar />
      <main className="flex-1 p-4 pt-16 md:pt-4 md:ml-64">{children}</main>
    </div>
  );
}
