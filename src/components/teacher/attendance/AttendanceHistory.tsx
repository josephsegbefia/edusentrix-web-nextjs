"use client";

import { CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function AttendanceHistory({
  records,
  loading,
}: {
  records: Array<{
    _id: string;
    date: string;
    type: "homeroom" | "period";
    status: "present" | "absent" | "late" | "excused";
    periodNumber: number | null;
  }>;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="h-14 w-full animate-pulse rounded-2xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
        <CalendarDays className="mx-auto mb-3 h-8 w-8 text-white/30" />
        <p>No attendance history yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => {
        const statusTone =
          record.status === "present"
            ? "text-emerald-200"
            : record.status === "absent"
              ? "text-rose-200"
              : record.status === "late"
                ? "text-amber-200"
                : "text-sky-200";
        const dateLabel = new Date(record.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return (
          <div
            key={record._id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="text-sm font-semibold text-white">{dateLabel}</div>
              <div className="text-xs text-white/50">
                {record.type === "homeroom" ? "Homeroom" : "Period"}
                {record.periodNumber ? ` - Period ${record.periodNumber}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <Clock className="h-4 w-4" />
              <span className={cn("rounded-full border border-white/10 bg-white/10 px-3 py-1", statusTone)}>
                {record.status.toUpperCase()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
