"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { isTimetableRoleReadViewsEnabled } from "@/lib/timetable/feature-flags";
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

const TIMETABLE_ROLE_VIEWS_ENABLED = isTimetableRoleReadViewsEnabled();

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
      active: "border-indigo-500/40 bg-indigo-500/15 text-indigo-200 shadow-indigo-500/20",
      icon: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    },
  },
  {
    id: "assignments",
    label: "Assignments",
    icon: Calendar,
    color: {
      active: "border-purple-500/40 bg-purple-500/15 text-purple-200 shadow-purple-500/20",
      icon: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    },
  },
  {
    id: "duties",
    label: "Duties",
    icon: ClipboardList,
    color: {
      active: "border-orange-500/40 bg-orange-500/15 text-orange-200 shadow-orange-500/20",
      icon: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    },
  },
  {
    id: "performance",
    label: "Performance",
    icon: TrendingUp,
    color: {
      active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-emerald-500/20",
      icon: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: Clock,
    color: {
      active: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200 shadow-cyan-500/20",
      icon: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileText,
    color: {
      active: "border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-amber-500/20",
      icon: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
  },
  {
    id: "notes",
    label: "Notes",
    icon: StickyNote,
    color: {
      active: "border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-rose-500/20",
      icon: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    color: {
      active: "border-violet-500/40 bg-violet-500/15 text-violet-200 shadow-violet-500/20",
      icon: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    },
  },
];

const TABS = TIMETABLE_ROLE_VIEWS_ENABLED
  ? [
      ...BASE_TABS.slice(0, 2),
      {
        id: "my_week" as TeacherDetailTabId,
        label: "My Week",
        icon: CalendarDays,
        color: {
          active: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200 shadow-cyan-500/20",
          icon: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        },
      },
      ...BASE_TABS.slice(2),
    ]
  : BASE_TABS;

export function TeacherDetailTabs({ value, onChange }: TeacherDetailTabsProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4 px-6 py-4">
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
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/15 hover:bg-white/8 hover:text-white/80"
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
                    : "border-white/10 bg-white/5 text-white/50 group-hover:border-white/15 group-hover:bg-white/8 group-hover:text-white/70"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Helper text */}
      <div className="hidden items-center gap-2 text-[10px] text-white/40 lg:flex">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
          {TABS.length} sections
        </span>
      </div>
    </div>
  );
}

export type { TeacherDetailTabId };
