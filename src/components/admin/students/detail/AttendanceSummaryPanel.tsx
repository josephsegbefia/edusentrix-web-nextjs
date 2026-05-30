"use client";

import * as React from "react";
import { CalendarCheck, CalendarX } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buildAttendanceSummaryPanelModel } from "@/lib/academics/profile/attendance-summary-panel-utils";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import { cn } from "@/lib/utils";

type Props = {
  profile: StudentAcademicProfileDTO;
};

const SOURCE_BADGE_CLASS: Record<string, string> = {
  live_homeroom_attendance: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
  report_snapshot: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
  none: "border-white/10 bg-white/5 text-white/50",
};

export function AttendanceSummaryPanel({ profile }: Props) {
  const model = React.useMemo(
    () =>
      buildAttendanceSummaryPanelModel({
        attendance: profile.attendance,
        canViewReadiness: profile.permissions.canViewReadiness,
        attendanceReady: profile.reportStatus.readiness?.attendanceReady ?? null,
        isReleasedPeriod: profile.reportStatus.isReleased,
      }),
    [profile]
  );

  return (
    <GlassPanel className="p-4 sm:p-5" glow="teal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20">
            <CalendarCheck className="h-5 w-5 text-teal-300" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">Attendance</h3>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                SOURCE_BADGE_CLASS[model.source] ?? SOURCE_BADGE_CLASS.none
              )}
            >
              Source: {model.sourceLabel}
            </span>
          </div>
        </div>
        {model.calculatedAtLabel ? (
          <p className="text-[11px] text-white/45">{model.calculatedAtLabel}</p>
        ) : null}
      </div>

      {model.showCompileWarning ? (
        <p
          className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90"
          role="status"
        >
          {model.compileWarningMessage}
        </p>
      ) : null}

      {model.hasData ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {model.stats.map((stat) => (
            <div key={stat.key} className={cn(glassInsetClass, "px-3 py-2.5")}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
                {stat.label}
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums text-white",
                  stat.key === "rate" && "text-teal-200"
                )}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            glassInsetClass,
            "mt-4 flex flex-col items-center gap-3 px-4 py-8 text-center"
          )}
        >
          <CalendarX className="h-8 w-8 text-white/25" />
          <p className="max-w-md text-sm text-white/60">{model.emptyMessage}</p>
          <p className="text-[11px] text-white/40">
            Attendance is read-only on this tab. Record it from homeroom attendance
            workflows.
          </p>
        </div>
      )}
    </GlassPanel>
  );
}

export function AttendanceSummaryPanelSkeleton() {
  return (
    <GlassPanel className="p-5" glow="none">
      <div className="h-28 animate-pulse rounded-xl bg-white/5" />
    </GlassPanel>
  );
}
