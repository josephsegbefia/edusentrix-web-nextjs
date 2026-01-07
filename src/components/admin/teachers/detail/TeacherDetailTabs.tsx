"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TeacherDetailTabId =
  | "overview"
  | "assignments"
  | "performance"
  | "attendance"
  | "documents"
  | "notes"
  | "activity";

type TeacherDetailTabsProps = {
  value: TeacherDetailTabId;
  onChange: (tab: TeacherDetailTabId) => void;
};

const TABS: { id: TeacherDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "assignments", label: "Assignments" },
  { id: "performance", label: "Performance" },
  { id: "attendance", label: "Attendance" },
  { id: "documents", label: "Documents" },
  { id: "notes", label: "Notes" },
  { id: "activity", label: "Activity Log" },
];

export function TeacherDetailTabs({ value, onChange }: TeacherDetailTabsProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4 px-4 py-3">
      <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const isActive = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                "border border-transparent text-muted-foreground",
                "hover:scale-105 hover:border-white/20 hover:bg-white/10 hover:text-foreground hover:shadow-sm hover:shadow-black/20",
                "active:scale-95",
                isActive &&
                  "border-white/20 bg-white/10 text-foreground shadow-sm shadow-black/20"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="hidden text-[10px] text-muted-foreground/80 md:inline-flex">
        Full teacher profile: assignments, performance, attendance & more.
      </div>
    </div>
  );
}

export type { TeacherDetailTabId };
