"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarCheck2, Clock3, ShieldAlert, Sparkles, CalendarDays } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useClassAttendanceAnalytics, type AttendanceStudentRow } from "@/hooks/admin/useClassAnalytics";
import {
  AnalyticsStatCard,
  EmptyAnalyticsState,
  LeoSignalsCard,
  StudentIdentity,
  prettyDate,
} from "./ClassAnalyticsPrimitives";

type Props = {
  classId: string;
  className: string;
};

function statusTone(status: string) {
  if (status === "present") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "late") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "absent") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
}

function bucketLabel(bucket: AttendanceStudentRow["bucket"]) {
  if (bucket === "habitual_latecomer") return "Habitual latecomer";
  if (bucket === "truant") return "Truant risk";
  if (bucket === "regular") return "Regular";
  if (bucket === "watch") return "Watch";
  return "Steady";
}

export function ClassAttendanceTab({ classId, className }: Props) {
  const { data: periodsData } = useAcademicPeriods();
  const periods = periodsData?.periods ?? [];
  const [academicPeriodId, setAcademicPeriodId] = React.useState<string | null>(null);
  const [fromDate, setFromDate] = React.useState<Date | null>(null);
  const [toDate, setToDate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (academicPeriodId || periods.length === 0) return;
    setAcademicPeriodId(periods.find((period) => period.isCurrent)?._id ?? periods[periods.length - 1]?._id ?? null);
  }, [academicPeriodId, periods]);

  const attendanceQuery = useClassAttendanceAnalytics(classId, {
    academicPeriodId,
    from: fromDate ? fromDate.toISOString().slice(0, 10) : null,
    to: toDate ? toDate.toISOString().slice(0, 10) : null,
  });

  const analytics = attendanceQuery.data?.data;
  const effectiveFromDate = fromDate ?? (analytics?.filters.from ? new Date(analytics.filters.from) : null);
  const effectiveToDate = toDate ?? (analytics?.filters.to ? new Date(analytics.filters.to) : null);

  const segmentCards = analytics
    ? [
        {
          title: "Habitual Latecomers",
          tone: "border-amber-500/20 bg-amber-500/8",
          rows: analytics.segments.habitualLatecomers,
          empty: "No persistent latecomers in the selected window.",
        },
        {
          title: "Truants",
          tone: "border-rose-500/20 bg-rose-500/8",
          rows: analytics.segments.truants,
          empty: "No students currently match the truant threshold.",
        },
        {
          title: "Regular Students",
          tone: "border-emerald-500/20 bg-emerald-500/8",
          rows: analytics.segments.regularStudents,
          empty: "No students have enough records to be classified as regular yet.",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-emerald-500/18 via-cyan-500/8 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">
                Attendance Overview
              </CardTitle>
              <p className="text-xs text-white/50">
                Habitual latecomers, truants, steady attenders, and class trends for {className}.
              </p>
            </div>
          </div>
          {analytics?.filters.academicPeriodLabel ? (
            <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              {analytics.filters.academicPeriodLabel}
            </Badge>
          ) : null}
        </CardHeader>
      </Card>

      <Card className="border border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Academic Period
            </label>
            <PremiumSelect
              value={academicPeriodId ?? undefined}
              onValueChange={(value) => {
                setAcademicPeriodId(value);
                setFromDate(null);
                setToDate(null);
              }}
            >
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Select academic period" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {periods.map((period) => (
                  <PremiumSelectItem key={period._id} value={period._id}>
                    {period.yearLabel} • {period.term}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <CustomDatePicker
            label="From"
            value={effectiveFromDate}
            onChange={(date) => setFromDate(date)}
            maxDate={effectiveToDate ?? undefined}
            placeholder="Start date"
          />
          <CustomDatePicker
            label="To"
            value={effectiveToDate}
            onChange={(date) => setToDate(date)}
            minDate={effectiveFromDate ?? undefined}
            placeholder="End date"
          />
        </CardContent>
      </Card>

      {attendanceQuery.isLoading && !analytics ? (
        <div className="flex items-center justify-center gap-3 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
          <p className="text-sm text-white/60">Loading class attendance analytics...</p>
        </div>
      ) : attendanceQuery.isError ? (
        <EmptyAnalyticsState
          icon={ShieldAlert}
          title="Unable to load attendance analytics"
          description="The attendance overview could not be loaded right now. Try again in a moment."
        />
      ) : analytics && analytics.summary.totalRecords === 0 ? (
        <EmptyAnalyticsState
          icon={CalendarDays}
          title="No attendance records yet"
          description="Homeroom attendance has not been recorded for the selected period and date range yet."
        />
      ) : analytics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsStatCard
              label="Attendance Rate"
              value={`${analytics.summary.attendanceRate}%`}
              subLabel={`${analytics.summary.presentCount + analytics.summary.lateCount + analytics.summary.excusedCount} attended records`}
              icon={CalendarCheck2}
              tone="emerald"
            />
            <AnalyticsStatCard
              label="Punctuality"
              value={`${analytics.summary.punctualityRate}%`}
              subLabel={`${analytics.summary.lateCount} late record${analytics.summary.lateCount === 1 ? "" : "s"}`}
              icon={Clock3}
              tone="amber"
            />
            <AnalyticsStatCard
              label="Truant Risk"
              value={analytics.segments.truants.length}
              subLabel={`${analytics.summary.absentCount} absences recorded`}
              icon={ShieldAlert}
              tone="rose"
            />
            <AnalyticsStatCard
              label="Recorded Days"
              value={analytics.summary.recordedDays}
              subLabel={`${analytics.summary.studentCount} active students`}
              icon={Sparkles}
              tone="teal"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <LeoSignalsCard leo={analytics.leo} title="Leo Attendance Signals" />

            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-white">
                  Attendance Buckets
                </CardTitle>
                <p className="text-xs text-white/45">
                  Quick class segmentation based on the selected attendance window.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                {segmentCards.map((segment) => (
                  <div key={segment.title} className={`rounded-2xl border ${segment.tone} p-3.5`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{segment.title}</p>
                      <Badge className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[10px] text-white/70">
                        {segment.rows.length}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {segment.rows.length > 0 ? (
                        segment.rows.slice(0, 3).map((row) => (
                          <div key={row.studentId} className="flex items-center justify-between gap-3">
                            <StudentIdentity
                              fullName={row.fullName}
                              photoUrl={row.photoUrl}
                              secondary={row.admissionNo ? `Adm. ${row.admissionNo}` : null}
                            />
                            <span className="text-xs text-white/55">
                              {segment.title === "Regular Students"
                                ? `${row.attendanceRate}%`
                                : segment.title === "Habitual Latecomers"
                                ? `${row.lateCount} late`
                                : `${row.absentCount} absent`}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/45">{segment.empty}</p>
                      )}
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Recent Daily Pulse</p>
                    <p className="text-[11px] text-white/45">Latest recorded days</p>
                  </div>
                  <div className="space-y-2">
                    {analytics.dailySummary.slice(0, 5).map((day) => (
                      <div key={day.date} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5">
                        <div>
                          <p className="text-sm text-white">{prettyDate(day.date)}</p>
                          <p className="text-[11px] text-white/45">
                            {day.presentCount} present, {day.lateCount} late, {day.absentCount} absent
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-emerald-300">
                          {day.attendanceRate}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-base font-semibold text-white">
                Student Attendance Drilldown
              </CardTitle>
              <p className="text-xs text-white/45">
                Detailed attendance behaviour for every active student in {className}.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/5 text-left text-[11px] uppercase tracking-[0.18em] text-white/45">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Bucket</th>
                      <th className="px-4 py-3 text-right">Attendance</th>
                      <th className="px-4 py-3 text-right">Late</th>
                      <th className="px-4 py-3 text-right">Absent</th>
                      <th className="px-4 py-3">Recent Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.students.map((row) => (
                      <tr key={row.studentId} className="border-b border-white/6 last:border-0">
                        <td className="px-4 py-3.5">
                          <StudentIdentity
                            fullName={row.fullName}
                            photoUrl={row.photoUrl}
                            secondary={row.admissionNo ? `Adm. ${row.admissionNo}` : null}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75">
                            {bucketLabel(row.bucket)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-white">
                          {row.attendanceRate}%
                        </td>
                        <td className="px-4 py-3.5 text-right text-amber-200">
                          {row.lateCount}
                          {row.lateCount > 0 ? (
                            <span className="ml-1 text-[11px] text-white/40">
                              ({row.averageLateMinutes}m avg)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 text-right text-rose-200">{row.absentCount}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {row.recentStatuses.length > 0 ? (
                              row.recentStatuses.map((status) => (
                                <span
                                  key={`${row.studentId}-${status.date}-${status.status}`}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${statusTone(status.status)}`}
                                >
                                  {status.status}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-white/40">No records yet</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
