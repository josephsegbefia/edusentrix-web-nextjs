"use client";

import { Badge } from "@/components/ui/badge";

export function AttendanceSummary({
  summary,
}: {
  summary: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <Badge className="bg-emerald-500/20 text-emerald-200">
        Present {summary.present}
      </Badge>
      <Badge className="bg-rose-500/20 text-rose-200">
        Absent {summary.absent}
      </Badge>
      <Badge className="bg-amber-500/20 text-amber-200">
        Late {summary.late}
      </Badge>
      <Badge className="bg-sky-500/20 text-sky-200">
        Excused {summary.excused}
      </Badge>
      <span className="text-xs text-white/50">Total {summary.total}</span>
    </div>
  );
}
