"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { STUDENT_TABS, type StudentsTabId } from "@/constants/students";
import { Users, Grid3X3, AlertCircle, Star, Clock, GraduationCap } from "lucide-react";

const tabIcons: Record<
  StudentsTabId,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  all: Users,
  "by-class": Grid3X3,
  "fee-defaulters": AlertCircle,
  "top-performers": Star,
  recent: Clock,
  alumni: GraduationCap,
};

const tabColors: Record<StudentsTabId, { active: string; icon: string }> = {
  all: {
    active: "border-teal-500/40 bg-teal-500/15 text-(--ws-teal) shadow-teal-500/20",
    icon: "bg-teal-500/20 text-(--ws-teal) border-teal-500/30",
  },
  "by-class": {
    active: "border-cyan-500/40 bg-cyan-500/15 text-(--ws-cyan) shadow-cyan-500/20",
    icon: "bg-cyan-500/20 text-(--ws-cyan) border-cyan-500/30",
  },
  "fee-defaulters": {
    active: "border-rose-500/40 bg-rose-500/15 text-(--ws-rose) shadow-rose-500/20",
    icon: "bg-rose-500/20 text-(--ws-rose) border-rose-500/30",
  },
  "top-performers": {
    active: "border-amber-500/40 bg-amber-500/15 text-(--ws-amber) shadow-amber-500/20",
    icon: "bg-amber-500/20 text-(--ws-amber) border-amber-500/30",
  },
  recent: {
    active: "border-emerald-500/40 bg-emerald-500/15 text-(--ws-emerald) shadow-emerald-500/20",
    icon: "bg-emerald-500/20 text-(--ws-emerald) border-emerald-500/30",
  },
  alumni: {
    active: "border-slate-500/40 bg-slate-500/15 text-(--ws-fg-80) shadow-slate-500/20",
    icon: "bg-slate-500/20 text-(--ws-fg-60) border-slate-500/30",
  },
};

type StudentsTabsNavProps = {
  value: StudentsTabId;
  onChange: (tab: StudentsTabId) => void;
};

export function StudentsTabsNav({ value, onChange }: StudentsTabsNavProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {STUDENT_TABS.map((tab) => {
        const Icon = tabIcons[tab.id];
        const active = tab.id === value;
        const colors = tabColors[tab.id];

        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-medium transition-all duration-200",
              active
                ? cn("shadow-lg", colors.active)
                : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-60) hover:border-(--ws-line) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg-80)"
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
                  : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-50) group-hover:border-(--ws-line) group-hover:bg-(--ws-fill-strong) group-hover:text-(--ws-fg-70)"
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
