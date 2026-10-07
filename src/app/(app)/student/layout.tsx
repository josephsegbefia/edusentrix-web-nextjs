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
        <main className="dark flex-1 bg-background p-4 pt-16 text-foreground md:ml-72 md:pt-4">
          {children}
        </main>
      </div>
    </>
  );
}
