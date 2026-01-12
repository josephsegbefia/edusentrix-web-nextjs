"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  CalendarCheck,
  Wallet,
  Clock,
  AlertCircle,
  TrendingUp,
  User,
  BookOpen,
  Activity as ActivityIcon,
  FileText,
  DollarSign,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type StudentOverviewTabProps = {
  student: StudentDetailDTO;
};

// Stat Card Component
function OverviewStatCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | React.ReactNode;
  description: string;
  tone: "teal" | "cyan" | "emerald" | "amber" | "red" | "purple";
}) {
  const tones = {
    teal: {
      gradient: "from-teal-500/10 via-teal-500/5 to-transparent",
      iconBg: "bg-teal-500/20 border-teal-500/30",
      iconColor: "text-teal-300",
    },
    cyan: {
      gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
      iconBg: "bg-cyan-500/20 border-cyan-500/30",
      iconColor: "text-cyan-300",
    },
    emerald: {
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20 border-emerald-500/30",
      iconColor: "text-emerald-300",
    },
    amber: {
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
      iconBg: "bg-amber-500/20 border-amber-500/30",
      iconColor: "text-amber-300",
    },
    red: {
      gradient: "from-red-500/10 via-red-500/5 to-transparent",
      iconBg: "bg-red-500/20 border-red-500/30",
      iconColor: "text-red-300",
    },
    purple: {
      gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/20 border-purple-500/30",
      iconColor: "text-purple-300",
    },
  };

  const style = tones[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover:opacity-100",
          style.gradient
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border",
                style.iconBg
              )}
            >
              <Icon className={cn("h-5 w-5", style.iconColor)} />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">
              {label}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white">
            {value}
          </div>
          <p className="text-[11px] text-white/40">{description}</p>
        </div>
      </div>
    </div>
  );
}

function getActivityIcon(type: string) {
  const iconMap: Record<string, React.ElementType> = {
    enrollment: GraduationCap,
    payment: DollarSign,
    incident: Shield,
    document: FileText,
    default: ActivityIcon,
  };
  return iconMap[type.toLowerCase()] || iconMap.default;
}

function getActivityColors(type: string) {
  const colorMap: Record<
    string,
    { bg: string; border: string; text: string; gradient: string }
  > = {
    enrollment: {
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      text: "text-cyan-300",
      gradient: "from-cyan-500 to-teal-500",
    },
    payment: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-300",
      gradient: "from-emerald-500 to-emerald-600",
    },
    incident: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      gradient: "from-red-500 to-red-600",
    },
    document: {
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      text: "text-violet-300",
      gradient: "from-violet-500 to-violet-600",
    },
    default: {
      bg: "bg-teal-500/10",
      border: "border-teal-500/30",
      text: "text-teal-300",
      gradient: "from-teal-500 to-cyan-500",
    },
  };
  return colorMap[type.toLowerCase()] || colorMap.default;
}

export function StudentOverviewTab({ student }: StudentOverviewTabProps) {
  const { academicSummary, feesSummary, attendanceSummary, recentActivity } =
    student;

  const academicAvg = academicSummary?.overallAverage;
  const attendancePercent = attendanceSummary?.presentPercent;
  const feesStatus = feesSummary?.status;
  const feesOutstanding = feesSummary?.totalOutstanding;
  const activityCount = recentActivity.length;

  const groupedActivities = React.useMemo(() => {
    const groups: Record<string, typeof recentActivity> = {};
    recentActivity.forEach((item) => {
      const date = new Date(item.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });
    return groups;
  }, [recentActivity]);

  return (
    <div className="space-y-6">
      {/* Premium Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewStatCard
          icon={GraduationCap}
          label="Overall Average"
          value={academicAvg != null ? `${academicAvg.toFixed(1)}%` : "--"}
          description={academicSummary?.latestTermLabel ?? "No term data yet"}
          tone="teal"
        />
        <OverviewStatCard
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
          tone="cyan"
        />
        <OverviewStatCard
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
          tone={
            feesStatus === "clear"
              ? "emerald"
              : feesStatus === "owing"
                ? "red"
                : "amber"
          }
        />
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Academic Performance Card */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />

          <CardHeader className="relative z-10 border-b border-white/5 pb-0">
            <div className="flex items-center gap-3 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/20">
                <BookOpen className="h-5 w-5 text-teal-300" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-white">
                  Academic Performance
                </CardTitle>
                <p className="text-xs text-white/50">
                  Current term performance overview
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 p-6">
            {academicSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Performance Tier
                    </div>
                    <div className="mt-2 text-lg font-bold text-white capitalize">
                      {academicSummary.performanceTier ?? "N/A"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Latest Term
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">
                      {academicSummary.latestTermLabel ?? "N/A"}
                    </div>
                  </div>
                </div>

                {academicSummary.overallAverage != null && (
                  <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-white/50">Overall Progress</span>
                      <span className="font-semibold text-white">
                        {academicSummary.overallAverage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          academicSummary.overallAverage >= 70
                            ? "bg-emerald-500"
                            : academicSummary.overallAverage >= 50
                              ? "bg-amber-500"
                              : "bg-red-500"
                        )}
                        style={{
                          width: `${Math.min(academicSummary.overallAverage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/2 px-4 py-8 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-white/30" />
                <p className="text-sm text-white/50">
                  No academic data available yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary Card */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />

          <CardHeader className="relative z-10 border-b border-white/5 pb-0">
            <div className="flex items-center gap-3 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/20">
                <CalendarCheck className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-white">
                  Attendance Summary
                </CardTitle>
                <p className="text-xs text-white/50">
                  Current term attendance record
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 p-6">
            {attendanceSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                    <div className="text-xl font-bold text-emerald-200">
                      {attendanceSummary.presentDays ?? 0}
                    </div>
                    <div className="text-[10px] text-emerald-200/70">
                      Present
                    </div>
                  </div>
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                    <div className="text-xl font-bold text-red-200">
                      {attendanceSummary.absentDays ?? 0}
                    </div>
                    <div className="text-[10px] text-red-200/70">Absent</div>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                    <div className="text-xl font-bold text-amber-200">
                      {attendanceSummary.lateDays ?? 0}
                    </div>
                    <div className="text-[10px] text-amber-200/70">Late</div>
                  </div>
                </div>

                {attendanceSummary.presentPercent != null && (
                  <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-white/50">Attendance Rate</span>
                      <span className="font-semibold text-white">
                        {attendanceSummary.presentPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          attendanceSummary.presentPercent >= 90
                            ? "bg-emerald-500"
                            : attendanceSummary.presentPercent >= 75
                              ? "bg-amber-500"
                              : "bg-red-500"
                        )}
                        style={{
                          width: `${Math.min(attendanceSummary.presentPercent, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/2 px-4 py-8 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-white/30" />
                <p className="text-sm text-white/50">
                  No attendance data available yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-inner shadow-white/5">
              <ActivityIcon className="h-5 w-5 text-teal-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Recent Activity
              </CardTitle>
              <p className="text-xs text-white/50">
                {activityCount} {activityCount === 1 ? "event" : "events"}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10">
          {recentActivity.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                  <ActivityIcon className="h-7 w-7 text-teal-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No activity logged yet
                  </p>
                  <p className="text-sm text-white/50">
                    As admins and teachers make changes (enrolment, class
                    assignments, payments, incidents), those actions will appear
                    here.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([date, activities]) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                      {date}
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className="space-y-3">
                    {activities.map((item) => {
                      const Icon = getActivityIcon(item.type);
                      const colors = getActivityColors(item.type);

                      return (
                        <div
                          key={item.id}
                          className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-4 transition-all duration-200 hover:border-teal-500/30 hover:bg-white/5"
                        >
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 w-1 bg-linear-to-b",
                              colors.gradient
                            )}
                            aria-hidden="true"
                          />

                          <div className="flex items-start gap-4 pl-3">
                            <div
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                                colors.bg,
                                colors.border
                              )}
                            >
                              <Icon className={cn("h-4 w-4", colors.text)} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-white">
                                    {item.description}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] font-medium",
                                        colors.bg,
                                        colors.border,
                                        colors.text.replace("text-", "text-")
                                      )}
                                    >
                                      {item.type}
                                    </Badge>
                                    {item.user && (
                                      <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                                        <User className="h-3 w-3" />
                                        <span>
                                          {item.user.firstName}{" "}
                                          {item.user.lastName}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/50">
                                  <Clock className="h-3 w-3" />
                                  <span className="whitespace-nowrap">
                                    {new Date(
                                      item.createdAt
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
