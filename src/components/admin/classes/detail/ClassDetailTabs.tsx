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
} from "lucide-react";

export type ClassDetailTabId =
  | "overview"
  | "students"
  | "subjects"
  | "attendance"
  | "performance"
  | "fees"
  | "settings";

type TabConfig = {
  id: ClassDetailTabId;
  label: string;
  icon: React.ElementType;
  description?: string;
};

const tabs: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Quick stats and class information",
  },
  {
    id: "students",
    label: "Students",
    icon: Users,
    description: "Enrolled students and management",
  },
  {
    id: "subjects",
    label: "Subjects & Teachers",
    icon: BookOpen,
    description: "Subject assignments and teachers",
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: UserCheck,
    description: "Class attendance tracking",
  },
  {
    id: "performance",
    label: "Performance",
    icon: BarChart3,
    description: "Academic performance metrics",
  },
  {
    id: "fees",
    label: "Fees",
    icon: Receipt,
    description: "Fee status and payments",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Class settings and configuration",
  },
];

type ClassDetailTabsProps = {
  value: ClassDetailTabId;
  onChange: (tab: ClassDetailTabId) => void;
};

export function ClassDetailTabs({ value, onChange }: ClassDetailTabsProps) {
  return (
    <div className="relative">
      {/* Scrollable tabs container */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = value === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 shadow-lg shadow-emerald-500/10"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
              )}

              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  isActive ? "text-emerald-400" : "text-white/40 group-hover:text-white/60"
                )}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom border */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

// Utility to get valid tab from URL param
export function getValidClassTab(param: string | null): ClassDetailTabId {
  const validTabs: ClassDetailTabId[] = [
    "overview",
    "students",
    "subjects",
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
