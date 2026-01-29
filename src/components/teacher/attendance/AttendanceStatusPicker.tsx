"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

type StatusOption = {
  value: AttendanceStatus;
  label: string;
  short: string;
  activeClass: string;
  idleClass: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "present",
    label: "Present",
    short: "P",
    activeClass: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
    idleClass: "text-emerald-200/60 hover:bg-emerald-500/10",
  },
  {
    value: "absent",
    label: "Absent",
    short: "A",
    activeClass: "bg-rose-500/20 text-rose-200 border-rose-500/40",
    idleClass: "text-rose-200/60 hover:bg-rose-500/10",
  },
  {
    value: "late",
    label: "Late",
    short: "L",
    activeClass: "bg-amber-500/20 text-amber-200 border-amber-500/40",
    idleClass: "text-amber-200/60 hover:bg-amber-500/10",
  },
  {
    value: "excused",
    label: "Excused",
    short: "E",
    activeClass: "bg-sky-500/20 text-sky-200 border-sky-500/40",
    idleClass: "text-sky-200/60 hover:bg-sky-500/10",
  },
];

type AttendanceStatusPickerProps = {
  value: AttendanceStatus;
  onChange: (value: AttendanceStatus) => void;
};

export function AttendanceStatusPicker({
  value,
  onChange,
}: AttendanceStatusPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-8 min-w-8 rounded-full border border-white/10 bg-white/5 px-2 text-xs font-semibold",
              isActive ? option.activeClass : option.idleClass
            )}
            onClick={() => onChange(option.value)}
            title={option.label}
          >
            {option.short}
          </Button>
        );
      })}
    </div>
  );
}
