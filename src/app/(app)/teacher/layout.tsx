// src/app/(app)/teacher/layout.tsx
import { ReactNode } from "react";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { AdminMainContent } from "@/components/nav/sidebars/admin-main-content";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireTeacher({ mode: "page" });

  return (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <TeacherSidebar />
        <AdminMainContent isBursar={false}>{children}</AdminMainContent>
      </div>
    </SidebarProvider>
  );
}
