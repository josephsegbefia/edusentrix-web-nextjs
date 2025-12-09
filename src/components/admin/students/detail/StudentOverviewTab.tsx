"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type StudentOverviewTabProps = {
  student: StudentDetailDTO;
};

export function StudentOverviewTab({ student }: StudentOverviewTabProps) {
  const { academicSummary, feesSummary, attendanceSummary, recentActivity } =
    student;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
      {/* Left column */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Academic & Attendance Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 grid gap-3 text-xs md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">
                Overall Average
              </div>
              <div className="mt-1 text-base font-semibold">
                {academicSummary?.overallAverage != null
                  ? `${academicSummary.overallAverage.toFixed(1)}%`
                  : "--"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                {academicSummary?.latestTermLabel ?? "No term data yet"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">
                Attendance
              </div>
              <div className="mt-1 text-base font-semibold">
                {attendanceSummary?.presentPercent != null
                  ? `${attendanceSummary.presentPercent.toFixed(1)}%`
                  : "--"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                {attendanceSummary
                  ? `${attendanceSummary.absentDays ?? 0} days absent`
                  : "No attendance data yet"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Fees</div>
              <div className="mt-1 text-base font-semibold">
                {feesSummary
                  ? `${
                      feesSummary.currency
                    } ${feesSummary.totalOutstanding.toLocaleString()}`
                  : "--"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                {feesSummary?.status
                  ? feesSummary.status === "clear"
                    ? "All cleared"
                    : feesSummary.status === "partial"
                    ? "Partially paid"
                    : "Owing fees"
                  : "No fee data yet"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-2 text-xs">
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground/80">
                No activity recorded yet for this student.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {recentActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <div>
                      <p className="text-[11px] text-foreground">
                        {item.description}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {item.user && (
                      <div className="text-right text-[10px] text-muted-foreground/70">
                        <div>
                          {item.user.firstName} {item.user.lastName}
                        </div>
                        {item.user.email && (
                          <div className="truncate">{item.user.email}</div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
