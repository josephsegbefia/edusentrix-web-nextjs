"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useStudentInsights,
  useGenerateInsights,
  useAskAI,
  type StudentInsightsResponse,
} from "@/hooks/admin/useStudentInsights";
import {
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  GraduationCap,
  CalendarCheck,
  Wallet,
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Users,
  User,
  ChevronRight,
  Info,
  Zap,
} from "lucide-react";
import { LeoIcon } from "@/components/icons/LeoIcon";

type InsightsData = StudentInsightsResponse["data"];
type SectionId = "academic" | "attendance" | "financial" | "behaviour";

// ─── Health Scorecard (Tier 1 — always visible) ───

function HealthScorecard({ data }: { data: InsightsData }) {
  const rb = data.ruleBased;

  const riskConfig = {
    low: {
      color: "emerald",
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/30",
      text: "text-emerald-300",
      icon: CheckCircle2,
    },
    medium: {
      color: "amber",
      bg: "bg-amber-500/15",
      border: "border-amber-500/30",
      text: "text-amber-300",
      icon: AlertTriangle,
    },
    high: {
      color: "red",
      bg: "bg-red-500/15",
      border: "border-red-500/30",
      text: "text-red-300",
      icon: ShieldAlert,
    },
  };

  const risk = riskConfig[rb.riskLevel];
  const RiskIcon = risk.icon;

  const trendIcon =
    rb.trend === "up"
      ? TrendingUp
      : rb.trend === "down"
        ? TrendingDown
        : Minus;
  const trendColor =
    rb.trend === "up"
      ? "text-emerald-300"
      : rb.trend === "down"
        ? "text-red-300"
        : "text-white/50";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Risk */}
      <div
        className={cn(
          "rounded-xl border p-4 backdrop-blur",
          risk.bg,
          risk.border
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <RiskIcon className={cn("h-4 w-4", risk.text)} />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
            Risk Level
          </span>
        </div>
        <div className={cn("text-xl font-bold capitalize", risk.text)}>
          {rb.riskLevel}
        </div>
      </div>

      {/* Trend */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <div className="flex items-center gap-2 mb-2">
          {React.createElement(trendIcon, {
            className: cn("h-4 w-4", trendColor),
          })}
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
            Trend
          </span>
        </div>
        <div className={cn("text-xl font-bold", trendColor)}>
          {rb.trendDelta != null
            ? `${rb.trendDelta > 0 ? "+" : ""}${rb.trendDelta}`
            : "--"}
        </div>
        <p className="text-[10px] text-white/40 mt-1">
          {rb.trend === "up"
            ? "Improving"
            : rb.trend === "down"
              ? "Declining"
              : "Stable"}
        </p>
      </div>

      {/* Attendance */}
      <div
        className={cn(
          "rounded-xl border p-4 backdrop-blur",
          rb.attendanceFlag
            ? "border-red-500/30 bg-red-500/10"
            : "border-white/10 bg-white/5"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <CalendarCheck
            className={cn(
              "h-4 w-4",
              rb.attendanceFlag ? "text-red-300" : "text-cyan-300"
            )}
          />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
            Attendance
          </span>
        </div>
        <div
          className={cn(
            "text-xl font-bold",
            rb.attendanceFlag ? "text-red-300" : "text-white"
          )}
        >
          {rb.attendanceRate != null ? `${rb.attendanceRate}%` : "--"}
        </div>
        {rb.attendanceFlag && (
          <p className="text-[10px] text-red-300/70 mt-1">Below 80%</p>
        )}
      </div>

      {/* Fees */}
      <div
        className={cn(
          "rounded-xl border p-4 backdrop-blur",
          rb.feesStatus === "clear"
            ? "border-emerald-500/30 bg-emerald-500/10"
            : rb.feesStatus === "owing"
              ? "border-red-500/30 bg-red-500/10"
              : "border-amber-500/30 bg-amber-500/10"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Wallet
            className={cn(
              "h-4 w-4",
              rb.feesStatus === "clear"
                ? "text-emerald-300"
                : rb.feesStatus === "owing"
                  ? "text-red-300"
                  : "text-amber-300"
            )}
          />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
            Fees
          </span>
        </div>
        <div
          className={cn(
            "text-xl font-bold capitalize",
            rb.feesStatus === "clear"
              ? "text-emerald-300"
              : rb.feesStatus === "owing"
                ? "text-red-300"
                : "text-amber-300"
          )}
        >
          {rb.feesStatus ?? "--"}
        </div>
        {rb.overdueInvoices > 0 && (
          <p className="text-[10px] text-red-300/70 mt-1">
            {rb.overdueInvoices} overdue
          </p>
        )}
      </div>
    </div>
  );
}

// ─── AI Summary Card ───

function AISummaryCard({
  data,
  onGenerate,
  generating,
  generateError,
}: {
  data: InsightsData;
  onGenerate: () => void;
  generating: boolean;
  generateError: string | null;
}) {
  const ai = data.aiGenerated;

  if (!ai && !data.canGenerate) {
    return (
      <Card className="border-white/10 bg-white/[0.02]">
        <CardContent className="flex items-center gap-3 p-5">
          <Info className="h-5 w-5 shrink-0 text-white/30" />
          <p className="text-sm text-white/50">
            Leo insights have not been generated for this term yet. An
            administrator can generate them.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!ai) {
    return (
      <Card className="border-dashed border-purple-500/30 bg-purple-500/[0.05]">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/20">
            <LeoIcon className="h-6 w-6 text-purple-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/80 mb-1">
              Generate with Leo
            </h3>
            <p className="text-xs text-white/50 max-w-sm">
              Get a comprehensive analysis of this student&apos;s
              academic performance, attendance, fees, and behaviour.
            </p>
          </div>
          {generateError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
              {generateError}
            </div>
          )}
          <Button
            onClick={onGenerate}
            disabled={generating}
            className="gap-2 rounded-xl bg-purple-600 hover:bg-purple-700"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LeoIcon className="h-4 w-4" />
            )}
            {generating ? "Generating..." : "Generate with Leo"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/20 bg-linear-to-br from-purple-500/[0.08] to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/20">
              <LeoIcon className="h-4 w-4 text-purple-300" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Leo Summary
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {data.generatedAt && (
              <span className="text-[10px] text-white/30">
                {new Date(data.generatedAt).toLocaleDateString()}
              </span>
            )}
            {data.canGenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onGenerate}
                disabled={generating}
                className="h-7 gap-1 rounded-lg px-2 text-[10px] text-white/40 hover:text-white/70"
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Regenerate
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-white/80">{ai.summary}</p>
      </CardContent>
    </Card>
  );
}

// ─── Section: Academic ───

function AcademicSection({ data }: { data: InsightsData }) {
  const rb = data.ruleBased;
  const ai = data.aiGenerated?.academic;

  return (
    <div className="space-y-4">
      {ai?.narrative && (
        <p className="text-sm leading-relaxed text-white/70">{ai.narrative}</p>
      )}

      {/* Position + CA vs Exam */}
      <div className="flex flex-wrap gap-3">
        {rb.classPosition != null && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Users className="h-4 w-4 text-cyan-300" />
            <span className="text-xs text-white/70">
              Position{" "}
              <span className="font-bold text-white">
                {rb.classPosition}
              </span>
              {rb.classSize != null && (
                <span className="text-white/40"> of {rb.classSize}</span>
              )}
              {rb.positionMovement != null && rb.positionMovement !== 0 && (
                <span
                  className={cn(
                    "ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold",
                    rb.positionMovement > 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  )}
                >
                  {rb.positionMovement > 0 ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                  {Math.abs(rb.positionMovement)}
                </span>
              )}
            </span>
          </div>
        )}
        {rb.caVsExamGap != null && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <BookOpen className="h-4 w-4 text-amber-300" />
            <span className="text-xs text-white/70">
              CA vs Exam:{" "}
              <span
                className={cn(
                  "font-bold",
                  rb.caVsExamGap > 0 ? "text-emerald-300" : "text-red-300"
                )}
              >
                {rb.caVsExamGap > 0 ? "+" : ""}
                {rb.caVsExamGap}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Strengths */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Strengths
            </h4>
          </div>
          <div className="space-y-2">
            {(ai?.strengths ?? rb.strengths).map((s, i) => (
              <div
                key={i}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-200">
                    {s.subject}
                  </span>
                  <span className="text-xs font-bold text-emerald-300">
                    {s.score}%
                  </span>
                </div>
                {"reason" in s && (
                  <p className="text-[10px] text-emerald-200/60 mt-0.5">
                    {(s as { reason: string }).reason}
                  </p>
                )}
              </div>
            ))}
            {(ai?.strengths ?? rb.strengths).length === 0 && (
              <p className="text-xs text-white/30">No data yet</p>
            )}
          </div>
        </div>

        {/* Weaknesses */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Areas for Improvement
            </h4>
          </div>
          <div className="space-y-2">
            {(ai?.weaknesses ?? rb.weaknesses).map((s, i) => (
              <div
                key={i}
                className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-red-200">
                    {s.subject}
                  </span>
                  <span className="text-xs font-bold text-red-300">
                    {s.score}%
                  </span>
                </div>
                {"reason" in s && (
                  <p className="text-[10px] text-red-200/60 mt-0.5">
                    {(s as { reason: string }).reason}
                  </p>
                )}
              </div>
            ))}
            {(ai?.weaknesses ?? rb.weaknesses).length === 0 && (
              <p className="text-xs text-white/30">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Priority Subjects */}
      {ai?.prioritySubjects && ai.prioritySubjects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70 mb-2">
            Priority Focus Areas
          </h4>
          <div className="flex flex-wrap gap-2">
            {ai.prioritySubjects.map((sub, i) => (
              <span
                key={i}
                className="rounded-full border border-purple-500/30 bg-purple-500/15 px-3 py-1 text-xs font-medium text-purple-200"
              >
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Term History */}
      {data.termHistory.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70 mb-2">
            Term History
          </h4>
          <div className="space-y-1.5">
            {data.termHistory.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <span className="text-xs text-white/60">{t.label}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-white/80 font-medium">
                    {t.averageScore != null ? `${t.averageScore}%` : "–"}
                  </span>
                  {t.classAverage != null && (
                    <span className="text-white/40">
                      Class: {t.classAverage}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Attendance ───

function AttendanceSection({ data }: { data: InsightsData }) {
  const rb = data.ruleBased;
  const att = rb.attendanceBreakdown;
  const ai = data.aiGenerated?.attendance;

  if (!att) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CalendarCheck className="h-8 w-8 text-white/20" />
        <p className="text-sm text-white/40">
          No attendance records found for this term.
        </p>
      </div>
    );
  }

  const stats = [
    { label: "Present", value: att.present, color: "text-emerald-300" },
    { label: "Absent", value: att.absent, color: "text-red-300" },
    { label: "Late", value: att.late, color: "text-amber-300" },
    { label: "Excused", value: att.excused, color: "text-cyan-300" },
  ];

  return (
    <div className="space-y-4">
      {ai?.narrative && (
        <p className="text-sm leading-relaxed text-white/70">{ai.narrative}</p>
      )}

      {/* Breakdown grid */}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-white/10 bg-white/5 p-3 text-center"
          >
            <div className={cn("text-lg font-bold", s.color)}>{s.value}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Extra details */}
      <div className="flex flex-wrap gap-3">
        {rb.mostMissedDay && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-white/40" />
            <span className="text-xs text-white/60">
              Most-missed day:{" "}
              <span className="font-medium text-white/80">
                {rb.mostMissedDay}
              </span>
            </span>
          </div>
        )}
        {rb.avgLateMinutes != null && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-white/40" />
            <span className="text-xs text-white/60">
              Avg. late:{" "}
              <span className="font-medium text-white/80">
                {rb.avgLateMinutes} min
              </span>
            </span>
          </div>
        )}
      </div>

      {/* AI patterns */}
      {ai?.patterns && ai.patterns.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70 mb-2">
            Patterns
          </h4>
          <ul className="space-y-1">
            {ai.patterns.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cyan-400 mt-0.5" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ai?.correlationWithGrades && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-white/60">
            <span className="font-medium text-white/80">
              Grades correlation:{" "}
            </span>
            {ai.correlationWithGrades}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Section: Financial ───

function FinancialSection({ data }: { data: InsightsData }) {
  const rb = data.ruleBased;
  const fees = data.feesDetail;
  const ai = data.aiGenerated?.financial;

  if (!fees) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Wallet className="h-8 w-8 text-white/20" />
        <p className="text-sm text-white/40">No fee records found.</p>
      </div>
    );
  }

  const fmt = (minor: number) =>
    `${fees.currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {ai?.narrative && (
        <p className="text-sm leading-relaxed text-white/70">{ai.narrative}</p>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-xs text-white/40 mb-1">Billed</div>
          <div className="text-sm font-bold text-white/80">
            {fmt(fees.totalBilledMinor)}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-xs text-white/40 mb-1">Paid</div>
          <div className="text-sm font-bold text-emerald-300">
            {fmt(fees.totalPaidMinor)}
          </div>
        </div>
        <div
          className={cn(
            "rounded-lg border p-3 text-center",
            fees.outstandingMinor > 0
              ? "border-red-500/30 bg-red-500/10"
              : "border-emerald-500/30 bg-emerald-500/10"
          )}
        >
          <div className="text-xs text-white/40 mb-1">Outstanding</div>
          <div
            className={cn(
              "text-sm font-bold",
              fees.outstandingMinor > 0 ? "text-red-300" : "text-emerald-300"
            )}
          >
            {fmt(fees.outstandingMinor)}
          </div>
        </div>
      </div>

      {/* Extra details */}
      <div className="flex flex-wrap gap-3">
        {rb.paymentConsistency != null && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-xs text-white/60">
              Payment consistency:{" "}
              <span className="font-medium text-white/80">
                {rb.paymentConsistency}% on-time
              </span>
            </span>
          </div>
        )}
        {rb.overdueInvoices > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
            <span className="text-xs text-red-200">
              {rb.overdueInvoices} overdue invoice
              {rb.overdueInvoices > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {ai?.riskAssessment && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-white/60">
            <span className="font-medium text-white/80">
              Risk assessment:{" "}
            </span>
            {ai.riskAssessment}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Section: Behaviour ───

function BehaviourSection({ data }: { data: InsightsData }) {
  const rb = data.ruleBased;
  const ai = data.aiGenerated?.behaviour;

  return (
    <div className="space-y-4">
      {ai?.narrative && (
        <p className="text-sm leading-relaxed text-white/70">{ai.narrative}</p>
      )}

      {/* Teacher comments */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-white/40" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Teacher Comments ({rb.teacherCommentCount})
          </h4>
        </div>
        {data.recentComments.length > 0 ? (
          <div className="space-y-2">
            {data.recentComments.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <p className="text-xs text-white/70 leading-relaxed">
                  &ldquo;{c.comment}&rdquo;
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/40">
                  {c.teacherName && <span>{c.teacherName}</span>}
                  <span className="capitalize">{c.type}</span>
                  <span>{c.date.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/30">
            No teacher comments for this term.
          </p>
        )}
      </div>

      {ai?.observations && ai.observations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70 mb-2">
            Observations
          </h4>
          <ul className="space-y-1">
            {ai.observations.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Recommendations Card ───

function RecommendationsCard({ data }: { data: InsightsData }) {
  const recs = data.aiGenerated?.recommendations;
  const [activeTab, setActiveTab] = React.useState<
    "student" | "parent" | "teacher"
  >("student");

  if (!recs) return null;

  const tabs = [
    { id: "student" as const, label: "Student", icon: User },
    { id: "parent" as const, label: "Parent", icon: Users },
    { id: "teacher" as const, label: "Teacher", icon: GraduationCap },
  ];

  return (
    <Card className="border-white/10 bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/20">
            <Zap className="h-4 w-4 text-amber-300" />
          </div>
          <CardTitle className="text-sm font-semibold text-white/80">
            Recommended Actions
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1 border-b border-white/10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors -mb-px",
                  activeTab === tab.id
                    ? "border-purple-500 text-purple-300"
                    : "border-transparent text-white/40 hover:text-white/60"
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {recs[activeTab]?.map((action, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm text-white/70"
            >
              <span className="text-purple-400 mt-0.5">•</span>
              <span>{action}</span>
            </div>
          ))}
          {(!recs[activeTab] || recs[activeTab].length === 0) && (
            <p className="text-xs text-white/30">No recommendations yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Additional Insights ───

function AdditionalInsightsCard({ data }: { data: InsightsData }) {
  const extra = data.aiGenerated?.additionalInsights;
  if (!extra) return null;

  const items = [
    { label: "Overall Trend", value: extra.overallTrend },
    { label: "CA vs Exam", value: extra.examVsCA },
    { label: "Class Comparison", value: extra.classComparison },
    { label: "Learning Style", value: extra.learningStyle },
  ].filter((i) => i.value);

  if (items.length === 0) return null;

  return (
    <Card className="border-white/10 bg-white/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Additional Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => (
          <p key={i} className="text-xs text-white/50">
            <span className="font-medium text-white/70">{item.label}: </span>
            {item.value}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Ask AI Chat ───

function AskAIChat({
  studentId,
  canGenerate,
}: {
  studentId: string;
  canGenerate: boolean;
}) {
  const [question, setQuestion] = React.useState("");
  const [messages, setMessages] = React.useState<
    Array<{ role: "user" | "ai"; text: string }>
  >([]);
  const chatRef = React.useRef<HTMLDivElement>(null);
  const askAI = useAskAI(studentId);

  if (!canGenerate) return null;

  function handleSend() {
    const q = question.trim();
    if (!q || askAI.isPending) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");

    const aiIdx = messages.length + 1;
    setMessages((prev) => [...prev, { role: "ai", text: "" }]);

    askAI.mutate(
      {
        question: q,
        onChunk: (fullText) => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[aiIdx] = { role: "ai", text: fullText };
            return copy;
          });
          chatRef.current?.scrollTo({
            top: chatRef.current.scrollHeight,
            behavior: "smooth",
          });
        },
      },
      {
        onError: (err) => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[aiIdx] = {
              role: "ai",
              text: `Error: ${err.message}`,
            };
            return copy;
          });
        },
      }
    );
  }

  return (
    <Card className="border-white/10 bg-white/[0.02]">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <LeoIcon className="h-4 w-4 text-purple-300" />
          <CardTitle className="text-sm font-semibold text-white/80">
            Ask Leo
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length > 0 && (
          <div
            ref={chatRef}
            className="max-h-60 space-y-3 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-3"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "text-xs leading-relaxed",
                  m.role === "user"
                    ? "text-purple-200 font-medium"
                    : "text-white/70"
                )}
              >
                {m.role === "user" ? (
                  <span className="text-purple-400 mr-1">You:</span>
                ) : (
                  <span className="text-purple-400 mr-1">Leo:</span>
                )}
                {m.text || (
                  <Loader2 className="inline h-3 w-3 animate-spin text-purple-400" />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask a follow-up about this student..."
            disabled={askAI.isPending}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!question.trim() || askAI.isPending}
            className="rounded-lg bg-purple-600 px-3 hover:bg-purple-700"
          >
            {askAI.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Tab Component ───

export function StudentInsightsTab({ studentId }: { studentId: string }) {
  const { data: response, isLoading, isError } = useStudentInsights(studentId);
  const generateMutation = useGenerateInsights(studentId);
  const [activeSection, setActiveSection] =
    React.useState<SectionId>("academic");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
        <span className="ml-3 text-sm text-white/50">
          Loading insights...
        </span>
      </div>
    );
  }

  if (isError || !response?.data) {
    return (
      <Card className="border-red-500/30 bg-red-500/[0.05]">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-red-300" />
          <p className="text-sm text-red-200/70">
            Failed to load insights. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = response.data;

  const sections: Array<{
    id: SectionId;
    label: string;
    icon: React.ElementType;
  }> = [
    { id: "academic", label: "Academic", icon: GraduationCap },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "financial", label: "Financial", icon: Wallet },
    { id: "behaviour", label: "Behaviour", icon: MessageSquare },
  ];

  function handleGenerate() {
    generateMutation.mutate(undefined);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/20">
          <LeoIcon className="h-5 w-5 text-purple-300" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white/90">
            Leo Insights & Recommendations
          </h2>
          {data.currentPeriodLabel && (
            <p className="text-xs text-white/40">{data.currentPeriodLabel}</p>
          )}
        </div>
      </div>

      {/* Tier 1: Health Scorecard */}
      <HealthScorecard data={data} />

      {/* Tier 2: AI Summary */}
      <AISummaryCard
        data={data}
        onGenerate={handleGenerate}
        generating={generateMutation.isPending}
        generateError={
          generateMutation.isError
            ? generateMutation.error?.message ?? "Failed to generate insights"
            : null
        }
      />

      {/* Section Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors -mb-px",
                activeSection === sec.id
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-white/40 hover:text-white/60"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {sec.label}
            </button>
          );
        })}
      </div>

      {/* Active Section Content */}
      <Card className="border-white/10 bg-white/[0.02]">
        <CardContent className="p-5">
          {activeSection === "academic" ? (
            <AcademicSection data={data} />
          ) : activeSection === "attendance" ? (
            <AttendanceSection data={data} />
          ) : activeSection === "financial" ? (
            <FinancialSection data={data} />
          ) : (
            <BehaviourSection data={data} />
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <RecommendationsCard data={data} />

      {/* Additional Insights */}
      <AdditionalInsightsCard data={data} />

      {/* Ask AI */}
      <AskAIChat studentId={studentId} canGenerate={data.canGenerate} />
    </div>
  );
}
