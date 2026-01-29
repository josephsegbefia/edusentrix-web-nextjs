"use client";

import * as React from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttendanceStatus, AttendanceStatusPicker } from "./AttendanceStatusPicker";
import { Input } from "@/components/ui/input";

export type AttendanceRowData = {
  studentId: string;
  name: string;
  admissionNo?: string;
  photoUrl?: string;
  status: AttendanceStatus;
  lateMinutes: number | null;
  reason: string | null;
};

type StudentAttendanceRowProps = {
  data: AttendanceRowData;
  onChange: (next: AttendanceRowData) => void;
};

export function StudentAttendanceRow({
  data,
  onChange,
}: StudentAttendanceRowProps) {
  const showReason = data.status !== "present";
  const showLateMinutes = data.status === "late";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/40">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt={data.name} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <User className="h-4 w-4" />
          )}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{data.name}</div>
          {data.admissionNo && (
            <div className="text-xs text-white/40">{data.admissionNo}</div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 sm:items-end">
        <AttendanceStatusPicker
          value={data.status}
          onChange={(status) =>
            onChange({
              ...data,
              status,
              lateMinutes: status === "late" ? data.lateMinutes : null,
              reason: status === "present" ? null : data.reason,
            })
          }
        />
        {showReason && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {showLateMinutes && (
              <Input
                type="number"
                min={0}
                placeholder="Late (mins)"
                value={data.lateMinutes ?? ""}
                onChange={(event) =>
                  onChange({
                    ...data,
                    lateMinutes: event.target.value ? Number(event.target.value) : null,
                  })
                }
                className="h-8 w-28 border-white/10 bg-white/5 text-xs text-white/80"
              />
            )}
            <Input
              type="text"
              placeholder="Reason (optional)"
              value={data.reason ?? ""}
              onChange={(event) =>
                onChange({ ...data, reason: event.target.value })
              }
              className={cn(
                "h-8 w-full border-white/10 bg-white/5 text-xs text-white/80",
                showLateMinutes ? "sm:w-56" : "sm:w-64"
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
