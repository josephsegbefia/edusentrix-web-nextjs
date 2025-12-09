"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { StudentDetailTabId } from "@/hooks/admin/useStudentDetail";

type StudentDetailTabsProps = {
  value: StudentDetailTabId;
  onChange: (tab: StudentDetailTabId) => void;
};

const TABS: { id: StudentDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "academics", label: "Academics" },
  { id: "fees", label: "Fees & Accounts" },
  { id: "behaviour", label: "Behaviour & Attendance" },
  { id: "relationships", label: "Relationships & Docs" },
  { id: "activity", label: "Activity Log" },
];

export function StudentDetailTabs({ value, onChange }: StudentDetailTabsProps) {
  return (
    <div className="flex w-full items-center justify-between gap-2 border-b border-white/10">
      <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const isActive = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                "border border-transparent text-muted-foreground hover:border-white/15 hover:bg-white/5 hover:text-foreground",
                isActive &&
                  "border-white/60 bg-white/10 text-foreground shadow-sm shadow-black/20"
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 translate-y-1 rounded-full bg-primary/70" />
              )}
            </button>
          );
        })}
      </div>
      <div className="hidden text-[10px] text-muted-foreground md:inline-flex">
        Full student profile: academics, fees, attendance & more.
      </div>
    </div>
  );
}
