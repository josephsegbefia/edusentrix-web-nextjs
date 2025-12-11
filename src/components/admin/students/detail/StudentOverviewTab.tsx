"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  CalendarCheck,
  Wallet,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type StudentOverviewTabProps = {
  student: StudentDetailDTO;
};

function PremiumStatCard({
  icon: Icon,
  label,
  value,
  description,
  gradient,
  iconBg,
  borderColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | React.ReactNode;
  description: string;
  gradient: string;
  iconBg: string;
  borderColor: string;
}) {
  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br",
          gradient
        )}
        aria-hidden="true"
      />
      <CardContent className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  iconBg
                )}
              >
                <Icon className="h-4 w-4 text-white/90" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                {label}
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {value}
            </div>
            <p className="text-[10px] text-muted-foreground/80 line-clamp-1">
              {description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentOverviewTab({ student }: StudentOverviewTabProps) {
  const { academicSummary, feesSummary, attendanceSummary, recentActivity } =
    student;

  const academicAvg = academicSummary?.overallAverage;
  const attendancePercent = attendanceSummary?.presentPercent;
  const feesStatus = feesSummary?.status;
  const feesOutstanding = feesSummary?.totalOutstanding;

  return (
    <div className="mt-4 space-y-6">
      {/* Premium Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PremiumStatCard
          icon={GraduationCap}
          label="Overall Average"
          value={
            academicAvg != null ? `${academicAvg.toFixed(1)}%` : "--"
          }
          description={
            academicSummary?.latestTermLabel ?? "No term data yet"
          }
          gradient="from-blue-500/10 via-blue-500/5 to-transparent"
          iconBg="bg-blue-500/20 border border-blue-400/30"
          borderColor="border-blue-400/20"
        />
        <PremiumStatCard
          icon={CalendarCheck}
          label="Attendance"
          value={
            attendancePercent != null
              ? `${attendancePercent.toFixed(1)}%`
              : "--"
          }
          description={
            attendanceSummary
              ? `${attendanceSummary.absentDays ?? 0} days absent`
              : "No attendance data yet"
          }
          gradient="from-emerald-500/10 via-emerald-500/5 to-transparent"
          iconBg="bg-emerald-500/20 border border-emerald-400/30"
          borderColor="border-emerald-400/20"
        />
        <PremiumStatCard
          icon={Wallet}
          label="Fees Outstanding"
          value={
            feesSummary
              ? `${feesSummary.currency} ${feesOutstanding?.toLocaleString() ?? 0}`
              : "--"
          }
          description={
            feesStatus === "clear"
              ? "All fees cleared"
              : feesStatus === "partial"
              ? "Partially paid"
              : feesStatus === "owing"
              ? "Owing fees"
              : "No fee data yet"
          }
          gradient={
            feesStatus === "clear"
              ? "from-emerald-500/10 via-emerald-500/5 to-transparent"
              : feesStatus === "owing"
              ? "from-red-500/10 via-red-500/5 to-transparent"
              : "from-amber-500/10 via-amber-500/5 to-transparent"
          }
          iconBg={
            feesStatus === "clear"
              ? "bg-emerald-500/20 border border-emerald-400/30"
              : feesStatus === "owing"
              ? "bg-red-500/20 border border-red-400/30"
              : "bg-amber-500/20 border border-amber-400/30"
          }
          borderColor={
            feesStatus === "clear"
              ? "border-emerald-400/20"
              : feesStatus === "owing"
              ? "border-red-400/20"
              : "border-amber-400/20"
          }
        />
      </div>

      {/* Recent Activity */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-purple-500/5 via-purple-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-400/30">
              <Clock className="h-4 w-4 text-purple-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Recent Activity
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-2 text-xs">
          {recentActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground/80 text-sm">
                No activity recorded yet for this student.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3 transition-all hover:border-white/20 hover:bg-black/40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground">
                      {item.description}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/80">
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {item.user && (
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right text-[10px]">
                      <Badge
                        variant="outline"
                        className="border-white/20 bg-white/5 text-[10px]"
                      >
                        {item.user.firstName} {item.user.lastName}
                      </Badge>
                      {item.user.email && (
                        <span className="truncate max-w-[120px] text-muted-foreground/70">
                          {item.user.email}
                        </span>
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
  );
}
