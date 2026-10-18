"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  ListChecks,
  ScanLine,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AssessWorkflowFocus } from "@/lib/assess/assessment-ux-guidance";

type Audience = "admin" | "teacher";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  focus?: AssessWorkflowFocus;
};

const ADMIN_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/admin/assessments",
    icon: BarChart3,
    description: "See what needs attention",
  },
  {
    label: "Create examination",
    href: "/admin/examinations",
    icon: GraduationCap,
    description: "Author questions in Core examinations",
  },
  {
    label: "Prepare paper",
    href: "/admin/assessments/paper",
    focus: "paper-delivery",
    icon: FileCheck2,
    description: "Choose an examination and publish its paper version",
  },
  {
    label: "Print and assign",
    href: "/admin/assessments/paper",
    focus: "packets",
    icon: FileCheck2,
    description: "Generate secure papers and assign students",
  },
  {
    label: "Review scans",
    href: "/admin/assessments/paper",
    focus: "evidence",
    icon: ScanLine,
    description: "Resolve evidence before marking",
  },
  {
    label: "Mark and approve",
    href: "/admin/assessments/paper",
    focus: "marking",
    icon: ClipboardCheck,
    description: "Mark, moderate and approve results",
  },
];

const TEACHER_ITEMS: NavItem[] = [
  {
    label: "Assigned marking",
    href: "/teacher/assess/marking",
    icon: ClipboardCheck,
    description: "Open scripts assigned to you",
  },
  {
    label: "My Core examinations",
    href: "/teacher/exams",
    icon: ListChecks,
    description: "Open your ordinary examination work",
  },
];

function focusHref(item: NavItem, deliveryId: string | null) {
  if (!item.focus) return item.href;
  const query = new URLSearchParams({ focus: item.focus });
  if (deliveryId) query.set("delivery", deliveryId);
  return `${item.href}?${query.toString()}#${item.focus}`;
}

export function AssessWorkspaceNav({
  audience = "admin",
  deliveryId = null,
}: {
  audience?: Audience;
  deliveryId?: string | null;
}) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const items = audience === "admin" ? ADMIN_ITEMS : TEACHER_ITEMS;
  const requestedFocus = searchParams.get("focus") as AssessWorkflowFocus | null;
  const effectiveFocus = requestedFocus ?? (deliveryId ? "packets" : "paper-delivery");

  return (
    <nav
      aria-label={audience === "admin" ? "Assess workspace navigation" : "Teacher Assess navigation"}
      className="-mx-1 overflow-x-auto px-1 pb-1"
    >
      <div className="flex min-w-max gap-2" role="list">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.focus
            ? pathname === item.href && effectiveFocus === item.focus
            : pathname === item.href;
          return (
            <Link
              key={`${item.href}:${item.focus ?? "page"}`}
              href={focusHref(item, deliveryId)}
              aria-current={active ? "page" : undefined}
              title={item.description}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan) focus-visible:ring-offset-2 focus-visible:ring-offset-(--ws-panel-to)",
                active
                  ? "border-(--ws-violet)/50 bg-(--ws-fill-strong) text-(--ws-violet) shadow-sm"
                  : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70) hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
