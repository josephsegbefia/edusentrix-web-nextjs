// src/app/(app)/parent/wards/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  DollarSign,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  BookOpen,
  Award,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useWardDetail, useWardAcademics, useWardFees, useWardAttendance } from "@/hooks/parent";
import { cn } from "@/lib/utils";
import type { FeeStatus, TrendDirection } from "@/hooks/parent/useParentDashboard";

/* --------------------------------------------------------------------------------
   Components
-------------------------------------------------------------------------------- */

function TrendBadge({ trend }: { trend: TrendDirection }) {
  if (trend === "stable") {
    return (
      <Badge variant="outline" className="gap-1 bg-white/5 text-white/60 border-white/10">
        → Stable
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        trend === "up"
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          : "bg-rose-500/20 text-rose-300 border-rose-500/30"
      )}
    >
      {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {trend === "up" ? "Improving" : "Declining"}
    </Badge>
  );
}

function FeeStatusBadge({ status }: { status: FeeStatus }) {
  const config: Record<FeeStatus, { icon: React.ElementType; label: string; className: string }> = {
    clear: {
      icon: CheckCircle2,
      label: "Fees Clear",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    partial: {
      icon: Clock,
      label: "Partial",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    owing: {
      icon: AlertCircle,
      label: "Owing",
      className: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
  };

  const { icon: StatusIcon, label, className } = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <StatusIcon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accent,
  loading = false,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-white/50">
            {label}
          </span>
          <Icon className="h-4 w-4 text-white/40" />
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {subtitle && <p className="text-xs text-white/50 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function getGradeColor(grade: string | null) {
  if (!grade) return "text-white/60";
  if (grade === "A" || grade === "A+" || grade === "A1") return "text-emerald-300";
  if (grade === "B" || grade === "B+" || grade === "B2" || grade === "B3") return "text-blue-300";
  if (grade === "C" || grade === "C+" || grade === "C4" || grade === "C5" || grade === "C6") return "text-amber-300";
  return "text-rose-300";
}

function AttendanceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    present: { className: "bg-emerald-500/20 text-emerald-300", label: "Present" },
    absent: { className: "bg-rose-500/20 text-rose-300", label: "Absent" },
    late: { className: "bg-amber-500/20 text-amber-300", label: "Late" },
    excused: { className: "bg-blue-500/20 text-blue-300", label: "Excused" },
  };
  const { className, label } = config[status] || { className: "bg-white/10 text-white/60", label: status };
  return <Badge className={className}>{label}</Badge>;
}

/* --------------------------------------------------------------------------------
   Tab Content Components
-------------------------------------------------------------------------------- */

function AcademicsTab({ wardId }: { wardId: string }) {
  const { data, isLoading, error } = useWardAcademics(wardId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-white/40 mb-4" />
        <p className="text-white/60">Unable to load academic data</p>
      </div>
    );
  }

  const { summary, subjects } = data;
  const termAverage = summary.overallAverage ?? 0;
  const classRank = summary.classPosition ?? 0;
  const classSize = summary.totalStudents ?? 0;
  const trend = summary.trend || "stable";

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Term Average"
          value={termAverage ? `${termAverage.toFixed(1)}%` : "N/A"}
          icon={Award}
          accent="from-purple-500/20 to-transparent"
        />
        <StatCard
          label="Class Rank"
          value={classRank ? `#${classRank}` : "N/A"}
          subtitle={classSize ? `of ${classSize} students` : undefined}
          icon={TrendingUp}
          accent="from-blue-500/20 to-transparent"
        />
        <StatCard
          label="Subjects"
          value={subjects.length}
          subtitle={summary.performanceTier || undefined}
          icon={BookOpen}
          accent="from-emerald-500/20 to-transparent"
        />
        <StatCard
          label="Trend"
          value={trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          subtitle={trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable"}
          icon={TrendingUp}
          accent={
            trend === "up"
              ? "from-emerald-500/20 to-transparent"
              : trend === "down"
              ? "from-rose-500/20 to-transparent"
              : "from-amber-500/20 to-transparent"
          }
        />
      </div>

      {/* Subjects List */}
      {subjects.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold mb-3">Subject Performance</h3>
          <div className="space-y-2">
            {subjects.map((subject) => {
              const percentage = subject.totalScore ?? 0;
              return (
                <div
                  key={subject.subjectId}
                  className="flex items-center gap-4 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white truncate">{subject.subjectName}</h4>
                      {subject.shortCode && (
                        <Badge variant="outline" className="text-xs bg-white/5">
                          {subject.shortCode}
                        </Badge>
                      )}
                    </div>
                    {subject.teacherName && (
                      <p className="text-xs text-white/50 mt-0.5">{subject.teacherName}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-lg font-bold", getGradeColor(subject.gradeLetter))}>
                        {subject.gradeLetter || "-"}
                      </span>
                      <span className="text-sm text-white/60">
                        {subject.totalScore?.toFixed(1) || "-"}%
                      </span>
                    </div>
                    <Progress value={percentage} className="w-20 h-1.5 mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-white/40 mb-4" />
          <p className="text-white/60">No subject grades available yet</p>
        </div>
      )}

      {/* Strongest/Weakest Subjects */}
      {(data.strongestSubject || data.weakestSubject) && (
        <div className="grid grid-cols-2 gap-4">
          {data.strongestSubject && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <h4 className="text-xs font-medium uppercase text-emerald-300/70 mb-2">Strongest Subject</h4>
              <p className="font-semibold text-emerald-300">{data.strongestSubject.subjectName}</p>
              <p className="text-sm text-emerald-300/80">{data.strongestSubject.score.toFixed(1)}%</p>
            </div>
          )}
          {data.weakestSubject && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <h4 className="text-xs font-medium uppercase text-amber-300/70 mb-2">Needs Improvement</h4>
              <p className="font-semibold text-amber-300">{data.weakestSubject.subjectName}</p>
              <p className="text-sm text-amber-300/80">{data.weakestSubject.score.toFixed(1)}%</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeesTab({ wardId }: { wardId: string }) {
  const { data, isLoading, error } = useWardFees(wardId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-white/40 mb-4" />
        <p className="text-white/60">Unable to load fees data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Fees"
          value={`GH₵ ${data.totalFees.toLocaleString()}`}
          icon={DollarSign}
          accent="from-blue-500/20 to-transparent"
        />
        <StatCard
          label="Amount Paid"
          value={`GH₵ ${data.amountPaid.toLocaleString()}`}
          icon={CheckCircle2}
          accent="from-emerald-500/20 to-transparent"
        />
        <StatCard
          label="Balance Due"
          value={`GH₵ ${data.balanceDue.toLocaleString()}`}
          icon={AlertCircle}
          accent={data.balanceDue > 0 ? "from-rose-500/20 to-transparent" : "from-emerald-500/20 to-transparent"}
        />
        <StatCard
          label="Progress"
          value={`${data.paymentProgress}%`}
          icon={TrendingUp}
          accent="from-purple-500/20 to-transparent"
        />
      </div>

      {/* Payment Progress */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/60">Payment Progress</span>
          <span className="text-sm font-medium text-white">{data.paymentProgress}%</span>
        </div>
        <Progress value={data.paymentProgress} className="h-2" />
        {data.nextDueDate && (
          <p className="text-xs text-white/50 mt-2">
            Next payment due: {new Date(data.nextDueDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Pending Invoices */}
      {data.invoices.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Invoices</h3>
          <div className="space-y-2">
            {data.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
              >
                <div>
                  <h4 className="font-medium text-white">{invoice.title}</h4>
                  <p className="text-xs text-white/50">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-white">
                    GH₵ {invoice.balanceDue.toLocaleString()}
                  </span>
                  <div className="mt-1">
                    <FeeStatusBadge status={invoice.status === "paid" ? "clear" : invoice.status === "partial" ? "partial" : "owing"} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Payments */}
      {data.payments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Payments</h3>
          <div className="space-y-2">
            {data.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                    <CreditCard className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">GH₵ {payment.amount.toLocaleString()}</h4>
                    <p className="text-xs text-white/50">{payment.method} • {payment.reference}</p>
                  </div>
                </div>
                <span className="text-sm text-white/60">
                  {new Date(payment.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ wardId }: { wardId: string }) {
  const { data, isLoading, error } = useWardAttendance(wardId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-white/40 mb-4" />
        <p className="text-white/60">Unable to load attendance data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Attendance Rate"
          value={`${data.rate.toFixed(1)}%`}
          icon={ClipboardCheck}
          accent={data.rate >= 90 ? "from-emerald-500/20 to-transparent" : data.rate >= 75 ? "from-amber-500/20 to-transparent" : "from-rose-500/20 to-transparent"}
        />
        <StatCard
          label="Days Present"
          value={data.daysPresent}
          subtitle={`of ${data.totalDays} days`}
          icon={CheckCircle2}
          accent="from-emerald-500/20 to-transparent"
        />
        <StatCard
          label="Days Absent"
          value={data.daysAbsent}
          icon={AlertCircle}
          accent="from-rose-500/20 to-transparent"
        />
        <StatCard
          label="Days Late"
          value={data.daysLate}
          icon={Clock}
          accent="from-amber-500/20 to-transparent"
        />
      </div>

      {/* Recent Records */}
      {data.recentRecords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Attendance</h3>
          <div className="space-y-2">
            {data.recentRecords.map((record, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-white/40" />
                  <span className="text-white">
                    {new Date(record.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {record.notes && (
                    <span className="text-xs text-white/50">{record.notes}</span>
                  )}
                  <AttendanceStatusBadge status={record.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Breakdown */}
      {data.monthlyBreakdown.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Monthly Breakdown</h3>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-3 text-xs font-medium uppercase text-white/50">Month</th>
                  <th className="text-center p-3 text-xs font-medium uppercase text-white/50">Present</th>
                  <th className="text-center p-3 text-xs font-medium uppercase text-white/50">Absent</th>
                  <th className="text-center p-3 text-xs font-medium uppercase text-white/50">Late</th>
                  <th className="text-right p-3 text-xs font-medium uppercase text-white/50">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyBreakdown.map((month, idx) => (
                  <tr key={idx} className="border-t border-white/10">
                    <td className="p-3 text-white">{month.month}</td>
                    <td className="p-3 text-center text-emerald-300">{month.present}</td>
                    <td className="p-3 text-center text-rose-300">{month.absent}</td>
                    <td className="p-3 text-center text-amber-300">{month.late}</td>
                    <td className="p-3 text-right text-white">
                      {month.total > 0 ? Math.round((month.present / month.total) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Main Component
-------------------------------------------------------------------------------- */

export default function WardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wardId = params.id as string;
  const [activeTab, setActiveTab] = React.useState("academics");

  const { data: ward, isLoading, error } = useWardDetail(wardId);

  const initials = ward
    ? `${ward.firstName?.[0] || ""}${ward.lastName?.[0] || ""}`.toUpperCase()
    : "?";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0 mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {isLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ) : error || !ward ? (
          <div>
            <h1 className="text-2xl font-bold">Ward Not Found</h1>
            <p className="text-muted-foreground">This ward could not be loaded.</p>
          </div>
        ) : (
          <div className="flex items-start gap-4 flex-1">
            {/* Avatar */}
            <div className="relative h-16 w-16 shrink-0">
              {ward.photoUrl ? (
                <img
                  src={ward.photoUrl}
                  alt={ward.name}
                  className="h-16 w-16 rounded-full object-cover border-2 border-white/10"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/20 text-brand font-semibold text-2xl border-2 border-brand/30">
                  {initials}
                </div>
              )}
              {ward.isPrimary && (
                <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-brand flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{ward.name}</h1>
                <Badge variant="outline" className="bg-white/5">
                  {ward.relationship}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                <span>{ward.classGroup?.name || "No class"}</span>
                {ward.grade && (
                  <>
                    <span>•</span>
                    <span>{ward.grade}</span>
                  </>
                )}
                {ward.admissionNo && (
                  <>
                    <span>•</span>
                    <span>Adm: {ward.admissionNo}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
          <TabsTrigger value="academics" className="gap-2 data-[state=active]:bg-brand/20">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Academics</span>
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-2 data-[state=active]:bg-brand/20">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Fees</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2 data-[state=active]:bg-brand/20">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="academics">
          <AcademicsTab wardId={wardId} />
        </TabsContent>

        <TabsContent value="fees">
          <FeesTab wardId={wardId} />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTab wardId={wardId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
