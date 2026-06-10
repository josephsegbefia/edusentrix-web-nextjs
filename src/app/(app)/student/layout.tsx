// src/app/(app)/student/layout.tsx
import { ReactNode } from "react";
import { requireStudent } from "@/lib/auth/requireStudent";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import StudentSidebar from "@/components/nav/sidebars/student-sidebar";

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireStudent({ mode: "page" });

  return (
    <>
      <AuthRefreshHandler />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <StudentSidebar />
        <main className="flex-1 p-4 pt-16 md:pt-4 md:ml-72">
          {children}
        </main>
      </div>
    </>
  );
}
