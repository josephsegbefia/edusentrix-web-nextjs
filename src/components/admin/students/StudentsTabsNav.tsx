"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { STUDENT_TABS, type StudentsTabId } from "@/constants/students";
import { Users, Grid3X3, AlertCircle, Star, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { px } from "framer-motion";
import { text } from "stream/consumers";

const tabIcons: Record<
  StudentsTabId,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  all: Users,
  "by-class": Grid3X3,
  "fee-defaulters": AlertCircle,
  "top-performers": Star,
  recent: Clock,
};

type StudentsTabsNavProps = {
  value: StudentsTabId;
  onChange: (tab: StudentsTabId) => void;
};

export function StudentsTabsNav({ value, onChange }: StudentsTabsNavProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {STUDENT_TABS.map((tab) => {
        const Icon = tabIcons[tab.id];
        const active = tab.id === value;
        return (
          <Button
            type="button"
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "bg-primary/10 border-primary text-primary shadow-sm"
                : "bg-muted/40 border-muted-foreground/10 text-muted-foreground hover:bg-muted/70"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
