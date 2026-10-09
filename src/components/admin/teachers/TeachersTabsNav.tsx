// src/components/admin/teachers/TeachersTabsNav.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TEACHERS_TABS, type TeachersTabId } from "@/constants/teachers";
import {
  Clock,
  Home,
  UserCheck,
  UserMinus,
  UserX,
  Users,
} from "lucide-react";

const tabIcons: Record<
  TeachersTabId,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  all: Users,
  active: UserCheck,
  inactive: UserX,
  on_leave: Clock,
  terminated: UserMinus,
  homeroom: Home,
};

const tabColors: Record<TeachersTabId, { active: string; icon: string }> = {
  all: {
    active: "border-indigo-500/40 bg-indigo-500/15 text-(--ws-violet) shadow-indigo-500/20",
    icon: "bg-indigo-500/20 text-(--ws-violet) border-indigo-500/30",
  },
  active: {
    active: "border-emerald-500/40 bg-emerald-500/15 text-(--ws-emerald) shadow-emerald-500/20",
    icon: "bg-emerald-500/20 text-(--ws-emerald) border-emerald-500/30",
  },
  inactive: {
    active: "border-slate-400/40 bg-slate-500/15 text-(--ws-fg-80) shadow-slate-500/20",
    icon: "bg-slate-500/20 text-(--ws-fg-70) border-slate-500/30",
  },
  on_leave: {
    active: "border-amber-500/40 bg-amber-500/15 text-(--ws-amber) shadow-amber-500/20",
    icon: "bg-amber-500/20 text-(--ws-amber) border-amber-500/30",
  },
  terminated: {
    active: "border-rose-500/40 bg-rose-500/15 text-(--ws-rose) shadow-rose-500/20",
    icon: "bg-rose-500/20 text-(--ws-rose) border-rose-500/30",
  },
  homeroom: {
    active: "border-purple-500/40 bg-purple-500/15 text-(--ws-violet) shadow-purple-500/20",
    icon: "bg-purple-500/20 text-(--ws-violet) border-purple-500/30",
  },
};

export function TeachersTabsNav({
  value,
  onChange,
}: {
  value: TeachersTabId;
  onChange: (v: TeachersTabId) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {TEACHERS_TABS.map((t) => {
        const active = t.id === value;
        const Icon = tabIcons[t.id];
        const colors = tabColors[t.id];

        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "group relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-medium transition-all duration-200",
              active
                ? cn("shadow-lg", colors.active)
                : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-60) hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg-80)"
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
                  : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-50) group-hover:border-(--ws-line-strong) group-hover:bg-(--ws-fill-strong) group-hover:text-(--ws-fg-70)"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
