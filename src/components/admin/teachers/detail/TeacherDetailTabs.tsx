"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  TrendingUp,
  Clock,
  FileText,
  StickyNote,
  Activity,
  ClipboardList,
} from "lucide-react";

type TeacherDetailTabId =
  | "overview"
  | "assignments"
  | "my_week"
  | "duties"
  | "performance"
  | "attendance"
  | "documents"
  | "notes"
  | "activity";

type TeacherDetailTabsProps = {
  value: TeacherDetailTabId;
  onChange: (tab: TeacherDetailTabId) => void;
};

const BASE_TABS: {
  id: TeacherDetailTabId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: { active: string; icon: string };
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    color: {
      active: "border-indigo-500/40 bg-indigo-500/15 text-(--ws-violet) shadow-indigo-500/20",
      icon: "bg-indigo-500/20 text-(--ws-violet) border-indigo-500/30",
    },
  },
  {
    id: "assignments",
    label: "Assignments",
    icon: Calendar,
    color: {
      active: "border-purple-500/40 bg-purple-500/15 text-(--ws-violet) shadow-purple-500/20",
      icon: "bg-purple-500/20 text-(--ws-violet) border-purple-500/30",
    },
  },
  {
    id: "duties",
    label: "Duties",
    icon: ClipboardList,
    color: {
      active: "border-orange-500/40 bg-orange-500/15 text-(--ws-amber) shadow-orange-500/20",
      icon: "bg-orange-500/20 text-(--ws-amber) border-orange-500/30",
    },
  },
  {
    id: "performance",
    label: "Performance",
    icon: TrendingUp,
    color: {
      active: "border-emerald-500/40 bg-emerald-500/15 text-(--ws-emerald) shadow-emerald-500/20",
      icon: "bg-emerald-500/20 text-(--ws-emerald) border-emerald-500/30",
    },
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: Clock,
    color: {
      active: "border-cyan-500/40 bg-cyan-500/15 text-(--ws-cyan) shadow-cyan-500/20",
      icon: "bg-cyan-500/20 text-(--ws-cyan) border-cyan-500/30",
    },
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileText,
    color: {
      active: "border-amber-500/40 bg-amber-500/15 text-(--ws-amber) shadow-amber-500/20",
      icon: "bg-amber-500/20 text-(--ws-amber) border-amber-500/30",
    },
  },
  {
    id: "notes",
    label: "Notes",
    icon: StickyNote,
    color: {
      active: "border-rose-500/40 bg-rose-500/15 text-(--ws-rose) shadow-rose-500/20",
      icon: "bg-rose-500/20 text-(--ws-rose) border-rose-500/30",
    },
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    color: {
      active: "border-violet-500/40 bg-violet-500/15 text-(--ws-violet) shadow-violet-500/20",
      icon: "bg-violet-500/20 text-(--ws-violet) border-violet-500/30",
    },
  },
];

const TABS = [
  ...BASE_TABS.slice(0, 2),
  {
    id: "my_week" as TeacherDetailTabId,
    label: "Weekly schedule",
    icon: CalendarDays,
    color: {
      active: "border-cyan-500/40 bg-cyan-500/15 text-(--ws-cyan) shadow-cyan-500/20",
      icon: "bg-cyan-500/20 text-(--ws-cyan) border-cyan-500/30",
    },
  },
  ...BASE_TABS.slice(2),
];

export function TeacherDetailTabs({ value, onChange }: TeacherDetailTabsProps) {
  return (
    <div className="flex w-full items-center px-6 py-4">
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((tab) => {
          const isActive = value === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "group relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-medium transition-all duration-200",
                isActive
                  ? cn("shadow-lg", tab.color.active)
                  : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-60) hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg-80)"
              )}
              aria-pressed={isActive}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-current opacity-60" />
              )}

              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200",
                  isActive
                    ? tab.color.icon
                    : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-50) group-hover:border-(--ws-line-strong) group-hover:bg-(--ws-fill-strong) group-hover:text-(--ws-fg-70)"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { TeacherDetailTabId };
