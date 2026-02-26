"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  Users,
  Calendar,
  FileDown,
} from "lucide-react";

export type GradeDetailTabId =
  | "overview"
  | "fees"
  | "students"
  | "timetable"
  | "export";

type GradeDetailTabsProps = {
  value: GradeDetailTabId;
  onChange: (tab: GradeDetailTabId) => void;
};

type TabConfig = {
  id: GradeDetailTabId;
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
    id: "fees",
    label: "Fees",
    icon: DollarSign,
    colors: {
      active:
        "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-emerald-500/20",
      icon: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
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
    id: "timetable",
    label: "Timetable",
    icon: Calendar,
    colors: {
      active:
        "border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-amber-500/20",
      icon: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
  },
  {
    id: "export",
    label: "Export",
    icon: FileDown,
    colors: {
      active:
        "border-violet-500/40 bg-violet-500/15 text-violet-200 shadow-violet-500/20",
      icon: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    },
  },
];

export function GradeDetailTabs({
  value,
  onChange,
}: GradeDetailTabsProps) {
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
            {/* Active indicator dot */}
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
