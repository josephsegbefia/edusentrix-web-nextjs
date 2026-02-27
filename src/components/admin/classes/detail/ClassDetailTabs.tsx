// src/components/admin/classes/detail/ClassDetailTabs.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  UserCheck,
  BarChart3,
  Receipt,
  Settings,
  Crown,
  Calendar,
} from "lucide-react";

export type ClassDetailTabId =
  | "overview"
  | "students"
  | "subjects"
  | "schedule"
  | "roles"
  | "attendance"
  | "performance"
  | "fees"
  | "settings";

type TabConfig = {
  id: ClassDetailTabId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colors: {
    active: string;
    icon: string;
  };
};

const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    colors: {
      active:
        "border-teal-500/40 bg-teal-500/15 text-teal-200 shadow-teal-500/20",
      icon: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    },
  },
  {
    id: "students",
    label: "Students",
    icon: Users,
    colors: {
      active:
        "border-cyan-500/40 bg-cyan-500/15 text-cyan-200 shadow-cyan-500/20",
      icon: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
  },
  {
    id: "subjects",
    label: "Subjects & Teachers",
    icon: BookOpen,
    colors: {
      active:
        "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-emerald-500/20",
      icon: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: Calendar,
    colors: {
      active:
        "border-blue-500/40 bg-blue-500/15 text-blue-200 shadow-blue-500/20",
      icon: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
  },
  {
    id: "roles",
    label: "Roles",
    icon: Crown,
    colors: {
      active:
        "border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-amber-500/20",
      icon: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: UserCheck,
    colors: {
      active:
        "border-orange-500/40 bg-orange-500/15 text-orange-200 shadow-orange-500/20",
      icon: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    },
  },
  {
    id: "performance",
    label: "Performance",
    icon: BarChart3,
    colors: {
      active:
        "border-violet-500/40 bg-violet-500/15 text-violet-200 shadow-violet-500/20",
      icon: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    },
  },
  {
    id: "fees",
    label: "Fees",
    icon: Receipt,
    colors: {
      active:
        "border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-rose-500/20",
      icon: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    colors: {
      active:
        "border-slate-400/40 bg-slate-500/15 text-slate-200 shadow-slate-500/20",
      icon: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    },
  },
];

type ClassDetailTabsProps = {
  value: ClassDetailTabId;
  onChange: (tab: ClassDetailTabId) => void;
};

export function ClassDetailTabs({ value, onChange }: ClassDetailTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;
        const colors = tab.colors;

        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-medium transition-all duration-200",
              active
                ? cn("shadow-lg", colors.active)
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/15 hover:bg-white/8 hover:text-white/80"
            )}
            aria-pressed={active}
          >
            {active && (
              <span className="absolute -top-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-current opacity-60" />
            )}

            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200",
                active
                  ? colors.icon
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
  );
}

// Utility to get valid tab from URL param
export function getValidClassTab(param: string | null): ClassDetailTabId {
  const validTabs: ClassDetailTabId[] = [
    "overview",
    "students",
    "subjects",
    "schedule",
    "roles",
    "attendance",
    "performance",
    "fees",
    "settings",
  ];
  if (param && validTabs.includes(param as ClassDetailTabId)) {
    return param as ClassDetailTabId;
  }
  return "overview";
}
