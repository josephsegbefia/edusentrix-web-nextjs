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
    active: "border-indigo-500/40 bg-indigo-500/15 text-indigo-200 shadow-indigo-500/20",
    icon: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
  active: {
    active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-emerald-500/20",
    icon: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  inactive: {
    active: "border-slate-400/40 bg-slate-500/15 text-slate-200 shadow-slate-500/20",
    icon: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
  on_leave: {
    active: "border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-amber-500/20",
    icon: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  terminated: {
    active: "border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-rose-500/20",
    icon: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  },
  homeroom: {
    active: "border-purple-500/40 bg-purple-500/15 text-purple-200 shadow-purple-500/20",
    icon: "bg-purple-500/20 text-purple-300 border-purple-500/30",
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
            <span className="font-medium">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
