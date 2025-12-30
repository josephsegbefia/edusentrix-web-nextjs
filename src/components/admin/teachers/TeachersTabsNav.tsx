// src/components/admin/teachers/TeachersTabsNav.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TEACHER_TABS, type TeachersTabId } from "@/constants/teachers";

export function TeachersTabsNav({
  value,
  onChange,
}: {
  value: TeachersTabId;
  onChange: (v: TeachersTabId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TEACHER_TABS.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              active
                ? "border-white/20 bg-white/10 text-foreground"
                : "border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
            aria-pressed={active}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
