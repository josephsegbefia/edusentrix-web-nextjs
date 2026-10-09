"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/providers/sidebar-provider";

export function AdminMainContent({
  children,
  isBursar,
}: {
  children: React.ReactNode;
  isBursar: boolean;
}) {
  const { collapsed } = useSidebar();
  const pathname = usePathname() || "";
  const workspacePage =
    pathname === "/admin" ||
    pathname === "/admin/students" ||
    pathname.startsWith("/admin/students/") ||
    pathname === "/admin/fees" ||
    pathname === "/admin/teachers" ||
    pathname === "/admin/classes" ||
    pathname === "/admin/grades" ||
    pathname === "/admin/academics/assessment-plans" ||
    pathname === "/admin/academics/grading" ||
    pathname === "/admin/periods" ||
    pathname === "/admin/communications" ||
    pathname === "/admin/promotions" ||
    pathname === "/admin/reports/cards/view" ||
    pathname === "/admin/background-tasks" ||
    pathname === "/admin/subscription" ||
    pathname === "/admin/notifications" ||
    pathname.startsWith("/admin/library") ||
    pathname === "/admin/exams/analytics" ||
    pathname === "/admin/exams/sessions" ||
    pathname === "/admin/exams/venues" ||
    pathname === "/admin/lessons/analytics" ||
    pathname === "/admin/lessons/sessions" ||
    pathname.startsWith("/admin/lessons/sessions/") ||
    pathname.startsWith("/admin/learn") ||
    pathname.startsWith("/admin/community") ||
    pathname === "/admin/examinations" ||
    pathname === "/admin/question-bank" ||
    pathname === "/admin/admissions" ||
    pathname === "/admin/curricula" ||
    pathname.startsWith("/admin/curricula/") ||
    pathname === "/admin/lessons/audit" ||
    pathname === "/admin/invitations" ||
    pathname === "/admin/docs" ||
    pathname === "/admin/store" ||
    pathname === "/admin/supplies" ||
    pathname === "/admin/overdue-report" ||
    pathname === "/admin/teachers/reports" ||
    pathname === "/admin/lesson-notes" ||
    pathname.startsWith("/admin/lesson-notes/") ||
    pathname === "/admin/schemes" ||
    pathname.startsWith("/admin/schemes/") ||
    pathname === "/admin/reports/report-runs" ||
    pathname.startsWith("/admin/reports/report-runs/") ||
    pathname === "/admin/expenses" ||
    pathname.startsWith("/admin/expenses/") ||
    pathname === "/admin/fees/invoices" ||
    pathname.startsWith("/admin/fees/invoices/") ||
    pathname === "/admin/fees/structures" ||
    pathname === "/admin/fees/payments/record" ||
    pathname === "/admin/reconciliation" ||
    pathname === "/admin/documents" ||
    pathname === "/admin/email" ||
    pathname === "/admin/tasks" ||
    pathname === "/admin/delegations" ||
    pathname.startsWith("/admin/admissions/") ||
    pathname.startsWith("/admin/periods/") ||
    pathname.startsWith("/admin/classes/") ||
    pathname.startsWith("/admin/teachers/") ||
    pathname.startsWith("/admin/subjects/") ||
    pathname.startsWith("/admin/finance") ||
    pathname.startsWith("/admin/grades/") ||
    pathname === "/admin/meetings" ||
    pathname.startsWith("/admin/meetings/") ||
    pathname === "/admin/reports" ||
    pathname === "/admin/academic-calendar" ||
    pathname.startsWith("/admin/examinations/") ||
    pathname.startsWith("/admin/exams/sessions/");

  return (
    <main
      className={cn(
        "min-w-0 max-w-full flex-1 bg-background p-4 pt-16 text-foreground transition-[margin-left] duration-200 ease-in-out md:pt-4",
        workspacePage ? "workspace students-workspace-main" : "dark",
        isBursar ? "md:ml-72" : collapsed ? "md:ml-16" : "md:ml-72"
      )}
    >
      {children}
    </main>
  );
}
