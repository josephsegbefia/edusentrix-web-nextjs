// src/app/(app)/admin/reports/page.tsx
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  Activity as ActivityIcon,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  DownloadCloud,
  FileText,
  Lightbulb,
  Loader2,
  Mail,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/custom-date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import {
  useGenerateRecurringReport,
  type GeneratedRecurringReport,
  type RecurringReportType,
} from "@/hooks/admin/useRecurringReports";
import {
  useCreateReportExport,
  useReportExports,
  useReportsCharts,
  useReportsSummary,
  type CreateReportExportInput,
  type ReportExportItem,
} from "@/hooks/admin/useReports";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { useBusyToast } from "@/hooks/useBusyToast";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  REPORT_DEFINITION_LIST,
  type ReportCategory,
  type ReportKey,
  type ReportRangeMode,
} from "@/constants/reports";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DAY_MS = 24 * 60 * 60 * 1000;

type ReportScope = "range" | "period";
type ChartTone =
  | "emerald"
  | "sky"
  | "violet"
  | "amber"
  | "cyan"
  | "rose"
  | "slate";
type ReportDefinition = (typeof REPORT_DEFINITION_LIST)[number];

type TooltipEntry = {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
};

type TooltipRenderProps = {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
};

type ChartInterval = "day" | "week" | "month";

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const FEES_COLORS = [
  "hsl(162, 73%, 52%)",
  "hsl(173, 72%, 46%)",
  "hsl(152, 63%, 48%)",
  "hsl(142, 70%, 45%)",
  "hsl(160, 84%, 39%)",
];

const STUDENT_COLORS = [
  "hsl(199, 89%, 48%)",
  "hsl(212, 95%, 68%)",
  "hsl(188, 86%, 53%)",
  "hsl(221, 83%, 53%)",
  "hsl(206, 90%, 64%)",
];

const TEACHER_COLORS = [
  "hsl(262, 83%, 58%)",
  "hsl(270, 91%, 65%)",
  "hsl(252, 87%, 72%)",
  "hsl(280, 84%, 67%)",
  "hsl(290, 70%, 60%)",
];

const ATTENDANCE_COLORS = [
  "hsl(43, 96%, 56%)",
  "hsl(32, 94%, 61%)",
  "hsl(48, 96%, 62%)",
  "hsl(20, 90%, 54%)",
  "hsl(35, 91%, 58%)",
  "hsl(12, 76%, 61%)",
];

const INVITATION_COLORS = [
  "hsl(189, 94%, 43%)",
  "hsl(180, 84%, 46%)",
  "hsl(196, 90%, 50%)",
  "hsl(171, 72%, 47%)",
  "hsl(188, 82%, 52%)",
];

const ACADEMIC_COLORS = [
  "hsl(280, 84%, 67%)",
  "hsl(292, 84%, 55%)",
  "hsl(260, 90%, 66%)",
];

const ACTIVITY_COLORS = [
  "hsl(220, 14%, 60%)",
  "hsl(215, 16%, 52%)",
  "hsl(210, 18%, 46%)",
  "hsl(225, 12%, 40%)",
  "hsl(230, 11%, 36%)",
];

const TONE_STYLES: Record<
  ChartTone,
  {
    gradient: string;
    iconBg: string;
    iconColor: string;
    badge: string;
    button: string;
  }
> = {
  emerald: {
    gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/20 border-emerald-500/30",
    iconColor: "text-emerald-300",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    button: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  sky: {
    gradient: "from-sky-500/15 via-sky-500/5 to-transparent",
    iconBg: "bg-sky-500/20 border-sky-500/30",
    iconColor: "text-sky-300",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    button: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  violet: {
    gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
    iconBg: "bg-violet-500/20 border-violet-500/30",
    iconColor: "text-violet-300",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-200",
    button: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  },
  amber: {
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/20 border-amber-500/30",
    iconColor: "text-amber-200",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    button: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  cyan: {
    gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
    iconBg: "bg-cyan-500/20 border-cyan-500/30",
    iconColor: "text-cyan-300",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    button: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  },
  rose: {
    gradient: "from-rose-500/15 via-rose-500/5 to-transparent",
    iconBg: "bg-rose-500/20 border-rose-500/30",
    iconColor: "text-rose-300",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    button: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  },
  slate: {
    gradient: "from-slate-500/15 via-slate-500/5 to-transparent",
    iconBg: "bg-slate-500/20 border-slate-500/30",
    iconColor: "text-slate-200",
    badge: "border-slate-500/30 bg-slate-500/10 text-slate-200",
    button: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  },
};

const CATEGORY_META: Array<{
  key: ReportCategory;
  label: string;
  description: string;
  icon: React.ElementType;
  tone: ChartTone;
}> = [
  {
    key: "fees",
    label: "Fees",
    description: "Revenue, billing, and collections insights.",
    icon: TrendingUp,
    tone: "emerald",
  },
  {
    key: "students",
    label: "Students",
    description: "Enrollment movement and cohort health.",
    icon: Users,
    tone: "sky",
  },
  {
    key: "teachers",
    label: "Teachers",
    description: "Staff coverage, workload, and assignments.",
    icon: UserCheck,
    tone: "violet",
  },
  {
    key: "attendance",
    label: "Attendance",
    description: "Daily presence and status breakdowns.",
    icon: ClipboardCheck,
    tone: "amber",
  },
  {
    key: "invitations",
    label: "Invitations",
    description: "Onboarding velocity and outcomes.",
    icon: Mail,
    tone: "cyan",
  },
  {
    key: "academics",
    label: "Academics",
    description: "Scores, pass rates, and mastery signals.",
    icon: BookOpen,
    tone: "rose",
  },
  {
    key: "activity",
    label: "Activity",
    description: "System events and audit volume.",
    icon: ActivityIcon,
    tone: "slate",
  },
];

const EXPORT_STATUS_STYLES: Record<string, string> = {
  queued: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  processing: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

function formatDateLabel(value: string | Date | null | undefined) {
  if (!value) return "N/A";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "N/A";
  return format(date, "MMM d, yyyy");
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return compactNumberFormatter.format(value);
}

function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString();
}

function humanizeLabel(value: string) {
  return value
    .replaceAll(/[_.-]/g, " ")
    .replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

function formatRangeModeLabel(mode: ReportRangeMode) {
  if (mode === "period") return "Academic period";
  if (mode === "all_time") return "All time";
  return "Date range";
}

function formatIntervalLabel(interval?: ChartInterval) {
  if (interval === "day") return "Daily";
  if (interval === "week") return "Weekly";
  if (interval === "month") return "Monthly";
  return "Interval";
}

function parseChartDate(label: string, interval: "day" | "week" | "month") {
  const iso =
    interval === "month" ? `${label}-01T00:00:00` : `${label}T00:00:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatAxisLabel(label: string, interval: ChartInterval) {
  const date = parseChartDate(label, interval);
  if (!date) return label;
  if (interval === "month") return format(date, "MMM yyyy");
  return format(date, "MMM d");
}

function formatExportRangeLabel(item: ReportExportItem) {
  if (item.rangeMode === "all_time") return "All time";
  if (item.range.periodLabel) return item.range.periodLabel;
  return `${formatDateLabel(item.range.startDate)} - ${formatDateLabel(
    item.range.endDate
  )}`;
}

function getPayloadNumber(
  payload: Record<string, unknown> | undefined,
  key: string
) {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPayloadString(
  payload: Record<string, unknown> | undefined,
  key: string
) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function buildTooltip(
  {
    labelFormatter,
    valueFormatter,
  }: {
    labelFormatter?: (label: string | number | undefined, payload: readonly TooltipEntry[]) => string;
    valueFormatter?: (value: number, entry: TooltipEntry) => string;
  } = {}
) {
  const formatLabel = labelFormatter;
  const formatValue = valueFormatter;
  const TooltipContent = ({ active, payload, label }: TooltipRenderProps) => {
    if (!active || !payload?.length) return null;
    const header = formatLabel ? formatLabel(label, payload) : label;

    return (
      <div className="rounded-lg border border-white/20 bg-slate-950/95 px-3 py-2 shadow-lg">
        {header ? (
          <p className="text-[11px] font-semibold text-white/60">{header}</p>
        ) : null}
        <div className="mt-1 space-y-1">
          {(() => {
            const rows: React.ReactNode[] = [];
            for (let index = 0; index < payload.length; index += 1) {
              const entry = payload[index];
              if (entry.value === undefined || entry.value === null) continue;
              const name = entry.name ?? entry.dataKey ?? "Value";
              const display = formatValue
                ? formatValue(entry.value, entry)
                : formatCount(entry.value);
              rows.push(
                <p
                  key={`${name}-${index}`}
                  className="text-xs font-medium"
                  style={{ color: entry.color ?? "white" }}
                >
                  {humanizeLabel(String(name))}: {display}
                </p>
              );
            }
            return rows;
          })()}
        </div>
      </div>
    );
  };

  TooltipContent.displayName = "ChartTooltip";

  return TooltipContent;
}

function buildAttendanceTooltip(formatDateTick: (label: string | number) => string) {
  const AttendanceTooltip = ({ active, payload, label }: TooltipRenderProps) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    const data = entry.payload;
    const presentRate =
      typeof entry.value === "number" && Number.isFinite(entry.value)
        ? entry.value
        : 0;
    const present = getPayloadNumber(data, "present") ?? 0;
    const absent = getPayloadNumber(data, "absent") ?? 0;
    const total = getPayloadNumber(data, "total") ?? 0;

    return (
      <div className="rounded-lg border border-white/20 bg-slate-950/95 px-3 py-2 shadow-lg">
        <p className="text-[11px] font-semibold text-white/60">
          {label ? formatDateTick(label) : "Attendance"}
        </p>
        <div className="mt-1 space-y-1 text-xs text-white/80">
          <p>Present rate: {presentRate.toFixed(1)}%</p>
          <p>Present: {formatCount(present)}</p>
          <p>Absent: {formatCount(absent)}</p>
          <p>Total: {formatCount(total)}</p>
        </div>
      </div>
    );
  };
  AttendanceTooltip.displayName = "AttendanceTooltip";
  return AttendanceTooltip;
}

function buildAcademicsTooltip() {
  const AcademicsTooltip = ({ active, payload, label }: TooltipRenderProps) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    const data = entry.payload;
    const displayLabel =
      getPayloadString(data, "label") ||
      entry.name ||
      (typeof label === "string" ? label : null) ||
      "Subject";
    const average =
      typeof entry.value === "number" && Number.isFinite(entry.value)
        ? entry.value
        : 0;
    const passRate = getPayloadNumber(data, "passRate") ?? 0;
    const count = getPayloadNumber(data, "count") ?? 0;

    return (
      <div className="rounded-lg border border-white/20 bg-slate-950/95 px-3 py-2 shadow-lg">
        <p className="text-[11px] font-semibold text-white/60">
          {humanizeLabel(displayLabel)}
        </p>
        <div className="mt-1 space-y-1 text-xs text-white/80">
          <p>Average score: {average.toFixed(1)}</p>
          <p>Pass rate: {passRate.toFixed(1)}%</p>
          <p>Records: {formatCount(count)}</p>
        </div>
      </div>
    );
  };
  AcademicsTooltip.displayName = "AcademicsTooltip";
  return AcademicsTooltip;
}

function getSelectedTone(selectedReport: ReportDefinition | null): ChartTone {
  if (!selectedReport) return "slate";
  return CATEGORY_META.find((category) => category.key === selectedReport.category)?.tone ?? "slate";
}

function getRangeLabel(
  range: { period?: { label?: string } | null; startDate?: string; endDate?: string } | undefined,
  fallbackRangeLabel: string
): string {
  if (range?.period?.label) return range.period.label;
  if (range) return `${formatDateLabel(range.startDate)} - ${formatDateLabel(range.endDate)}`;
  return fallbackRangeLabel;
}

function getFallbackRangeLabel(
  scope: ReportScope,
  currentPeriod: { term: string; yearLabel: string } | null,
  startDate: Date | null,
  endDate: Date | null
): string {
  if (scope === "period" && currentPeriod) {
    return `${currentPeriod.term} ${currentPeriod.yearLabel}`;
  }
  if (startDate && endDate) {
    return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
  }
  return "Custom Range";
}

function getModalRangeHint(
  selectedReport: ReportDefinition | null,
  periodReady: boolean,
  canUseRange: boolean
): string | null {
  if (!selectedReport) return null;
  if (selectedReport.rangeMode === "period" && !periodReady) {
    return "Switch to Academic Period to enable this report.";
  }
  if (selectedReport.rangeMode === "range" && !canUseRange) {
    return "Select a start and end date to continue.";
  }
  return null;
}

function getModalRangeLabel(
  selectedReport: ReportDefinition | null,
  range: { period?: { label?: string } | null } | undefined,
  currentPeriod: { term: string; yearLabel: string } | null,
  rangeLabel: string
): string {
  if (!selectedReport) return "";
  if (selectedReport.rangeMode === "all_time") return "All time";
  if (selectedReport.rangeMode === "period") {
    return (
      range?.period?.label ||
      (currentPeriod
        ? `${currentPeriod.term} ${currentPeriod.yearLabel}`
        : "Select academic period")
    );
  }
  return rangeLabel;
}

function getReportDisabledMessage(
  isPeriodLocked: boolean,
  isRangeLocked: boolean
): string | null {
  if (isPeriodLocked) return "Period required";
  if (isRangeLocked) return "Select dates";
  return null;
}

function getReportRangeHint(
  rangeMode: ReportRangeMode,
  isPeriodLocked: boolean,
  rangeLabel: string
): string {
  if (rangeMode === "all_time") return "All time export across the entire school.";
  if (isPeriodLocked) return "Switch to Academic Period to enable.";
  return `Uses ${rangeLabel}`;
}

function renderExportItemStatus(
  status: string,
  onDownload: () => void
): React.ReactNode {
  if (status === "completed") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
        onClick={onDownload}
      >
        <DownloadCloud className="h-4 w-4" />
        Download
      </Button>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200">
        Failed
      </Badge>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-white/60">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Preparing
    </div>
  );
}

function RecentExportsCard({
  exportsQuery,
  onDownload,
}: {
  exportsQuery: {
    isLoading: boolean;
    isError: boolean;
    data?: { data: ReportExportItem[] };
  };
  onDownload: (item: ReportExportItem) => void;
}) {
  const renderExportsContent = () => {
    if (exportsQuery.isLoading) {
      return (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
      );
    }
    if (exportsQuery.isError) {
      return (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          We could not load recent exports. Please try refreshing.
        </div>
      );
    }
    if ((exportsQuery.data?.data.length ?? 0) === 0) {
      return (
        <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-6 text-center">
          <p className="text-xs text-white/60">
            No exports generated yet. Start with the report library.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {(exportsQuery.data?.data ?? []).map((item) => {
          const rangeText = formatExportRangeLabel(item);
          const timestamp = item.completedAt ?? item.createdAt;
          const timeLabel = item.completedAt ? "Completed" : "Requested";
          const timeAgo = formatDistanceToNow(new Date(timestamp), {
            addSuffix: true,
          });
          const requester = item.requestedBy
            ? [item.requestedBy.firstName, item.requestedBy.lastName]
                .filter(Boolean)
                .join(" ") || item.requestedBy.email || "User"
            : "System";

          return (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner shadow-black/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      {item.reportLabel}
                    </p>
                    <Badge
                      variant="secondary"
                      className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70"
                    >
                      {item.format.toUpperCase()}
                    </Badge>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-white/50">
                    {rangeText} - {timeLabel} {timeAgo}
                  </p>
                  <p className="text-[11px] text-white/40">
                    Requested by {requester}
                    {item.rowCount !== null && item.rowCount !== undefined
                      ? ` - ${formatCount(item.rowCount)} rows`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {renderExportItemStatus(item.status, () => onDownload(item))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">Recent Exports</CardTitle>
          <p className="text-xs text-white/50">
            Keep track of the latest report downloads.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70"
        >
          {exportsQuery.isLoading
            ? "Loading"
            : `${exportsQuery.data?.data.length ?? 0} exports`}
        </Badge>
      </CardHeader>
      <CardContent className="relative z-10 space-y-3">
        {renderExportsContent()}
      </CardContent>
    </Card>
  );
}

function groupReportDefinitions(definitions: ReportDefinition[]) {
  const groups: Record<ReportCategory, ReportDefinition[]> = {
    fees: [],
    students: [],
    teachers: [],
    attendance: [],
    invitations: [],
    academics: [],
    activity: [],
  };

  for (const definition of definitions) {
    groups[definition.category].push(definition);
  }

  Object.values(groups).forEach((group) =>
    group.sort((a, b) => a.label.localeCompare(b.label))
  );

  return groups;
}

function StatCard({
  label,
  value,
  subtitle,
  loading,
}: {
  label: string;
  value: string;
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-24" />
      ) : (
        <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      )}
      {subtitle ? (
        <p className="mt-1 text-xs text-white/50">{subtitle}</p>
      ) : null}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  tone,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  tone: ChartTone;
  badge?: string;
}) {
  const style = TONE_STYLES[tone];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border",
            style.iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", style.iconColor)} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description ? (
            <p className="text-xs text-white/50">{description}</p>
          ) : null}
        </div>
      </div>
      {badge ? (
        <Badge
          variant="secondary"
          className={cn(
            "border text-[10px] uppercase tracking-[0.2em]",
            style.badge
          )}
        >
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  description,
  icon: Icon,
  tone,
  meta,
  loading,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  tone: ChartTone;
  meta?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  const style = TONE_STYLES[tone];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-[180px] w-full" />
        </div>
      );
    }
    if (empty) {
      return (
        <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
          <p className="text-xs text-white/60">
            {emptyLabel ?? "No data available yet."}
          </p>
        </div>
      );
    }
    return children;
  };

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className={cn("pointer-events-none absolute inset-0 bg-linear-to-br", style.gradient)}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border",
                style.iconBg
              )}
            >
              <Icon className={cn("h-4 w-4", style.iconColor)} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-white/90">
                {title}
              </CardTitle>
              {description ? (
                <p className="text-[11px] text-white/50">{description}</p>
              ) : null}
            </div>
          </div>
          {meta ? <div className="shrink-0">{meta}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="relative z-10">{renderContent()}</CardContent>
    </Card>
  );
}

function DistributionLegend({
  data,
  colors,
  valueFormatter,
}: {
  data: Array<{ label: string; value: number }>;
  colors: string[];
  valueFormatter?: (value: number) => string;
}) {
  if (!data.length) return null;
  const total = data.reduce((sum, item) => sum + (item.value ?? 0), 0);

  return (
    <div className="mt-4 space-y-2">
      {data.map((item, index) => {
        const percent =
          total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
        return (
          <div
            key={`${item.label}-${index}`}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-xs text-white/80 truncate">
                {humanizeLabel(item.label)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span>{percent}%</span>
              <span className="min-w-10 text-right text-xs font-semibold text-white/80">
                {valueFormatter ? valueFormatter(item.value) : formatCount(item.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const className =
    EXPORT_STATUS_STYLES[key] ?? "border-white/10 bg-white/10 text-white/70";

  return (
    <Badge
      variant="secondary"
      className={cn("border text-[10px] uppercase tracking-[0.2em]", className)}
    >
      {humanizeLabel(key)}
    </Badge>
  );
}

function ReportTemplateCard({
  definition,
  tone,
  rangeHint,
  disabled,
  disabledMessage,
  onSelect,
}: {
  definition: ReportDefinition;
  tone: ChartTone;
  rangeHint: string;
  disabled: boolean;
  disabledMessage?: string | null;
  onSelect: (key: ReportKey) => void;
}) {
  const style = TONE_STYLES[tone];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border border-white/10 bg-white/5 shadow-lg shadow-black/20 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl",
        disabled && "opacity-70"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-70 transition-opacity duration-300 group-hover:opacity-100",
          style.gradient
        )}
        aria-hidden="true"
      />
      <CardContent className="relative z-10 space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{definition.label}</p>
            <p className="text-[11px] text-white/60">
              {definition.description ?? "Detailed export for this report."}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10">
            <ArrowUpRight className="h-4 w-4 text-white/60" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70"
          >
            {formatRangeModeLabel(definition.rangeMode)}
          </Badge>
          {definition.formats.map((format) => (
            <Badge
              key={format}
              variant="secondary"
              className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70"
            >
              {format.toUpperCase()}
            </Badge>
          ))}
          {disabled && disabledMessage ? (
            <Badge className="border border-amber-500/30 bg-amber-500/10 text-[10px] uppercase tracking-[0.2em] text-amber-200">
              {disabledMessage}
            </Badge>
          ) : null}
        </div>

        <p className="text-[11px] text-white/50">{rangeHint}</p>

        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-center gap-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
            style.button
          )}
          onClick={() => onSelect(definition.key)}
          disabled={disabled}
        >
          <DownloadCloud className="h-4 w-4" />
          Generate Export
        </Button>
      </CardContent>
    </Card>
  );
}

function buildExportPayload(
  definition: ReportDefinition,
  context: {
    periodReady: boolean;
    activePeriodId: string | null;
    rangeStart: string | null;
    rangeEnd: string | null;
  }
): CreateReportExportInput | null {
  const { periodReady, activePeriodId, rangeStart, rangeEnd } = context;
  const payload: CreateReportExportInput = {
    reportKey: definition.key,
    format: definition.formats[0] ?? "csv",
    label: definition.label,
  };

  if (definition.rangeMode === "period") {
    if (!periodReady || !activePeriodId) return null;
    payload.periodId = activePeriodId;
    return payload;
  }

  if (definition.rangeMode === "range") {
    if (!rangeStart || !rangeEnd) return null;
    payload.startDate = rangeStart;
    payload.endDate = rangeEnd;
    return payload;
  }

  if (rangeStart && rangeEnd) {
    payload.startDate = rangeStart;
    payload.endDate = rangeEnd;
  }

  return payload;
}

function getSuggestedRecurringType(
  days: number | null | undefined
): RecurringReportType {
  if (!days || days <= 9) return "weekly";
  if (days <= 18) return "biweekly";
  return "monthly";
}

function ExportDialog({
  selectedReport,
  selectedTone,
  modalRangeLabel,
  modalRangeHint,
  isPending,
  onClose,
  onGenerate,
}: {
  selectedReport: ReportDefinition | null;
  selectedTone: ChartTone;
  modalRangeLabel: string;
  modalRangeHint: string | null;
  isPending: boolean;
  onClose: () => void;
  onGenerate: (report: ReportDefinition) => void;
}) {
  return (
    <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => { if (!open) onClose(); }}>
      {selectedReport ? (
        <DialogContent className="max-w-2xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-0 text-white shadow-2xl">
          <div className="border-b border-white/10 p-6 pb-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Export {selectedReport.label}
              </DialogTitle>
              <DialogDescription className="text-sm text-white/60">
                {selectedReport.description ??
                  "Prepare a downloadable export for this report."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Scope
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {formatRangeModeLabel(selectedReport.rangeMode)}
                </p>
                <p className="text-xs text-white/50">{modalRangeLabel}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Format
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {selectedReport.formats.map((format) => format.toUpperCase()).join(", ")}
                </p>
                <p className="text-xs text-white/50">
                  CSV downloads are available immediately.
                </p>
              </div>
            </div>

            {modalRangeHint ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                {modalRangeHint}
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 border-t border-white/10 p-4">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-white/70 hover:text-white"
            >
              Close
            </Button>
            <Button
              variant="outline"
              className={cn(
                "gap-2 border",
                TONE_STYLES[selectedTone].button,
                "hover:bg-white/10"
              )}
              disabled={Boolean(modalRangeHint) || isPending}
              onClick={() => onGenerate(selectedReport)}
            >
              {isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <DownloadCloud className="h-4 w-4" />
              )}
              Generate Export
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function LeoExecutiveBriefCard({
  scope,
  periodId,
  periodLabel,
  rangeStart,
  rangeEnd,
  rangeLabel,
  rangeDays,
}: {
  scope: ReportScope;
  periodId: string | null;
  periodLabel: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  rangeLabel: string;
  rangeDays: number | null;
}) {
  const {
    mutateAsync: generateLeoBrief,
    isPending: isGeneratingLeo,
    isError: isLeoError,
    error: leoError,
    reset: resetLeo,
  } = useGenerateRecurringReport(periodId);
  const suggestedType = React.useMemo(
    () => getSuggestedRecurringType(rangeDays),
    [rangeDays]
  );
  const [reportType, setReportType] =
    React.useState<RecurringReportType>(suggestedType);
  const [brief, setBrief] = React.useState<GeneratedRecurringReport | null>(null);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReportType(suggestedType);
  }, [suggestedType]);

  React.useEffect(() => {
    setBrief(null);
    setPdfError(null);
    resetLeo();
  }, [periodId, rangeStart, rangeEnd, reportType, resetLeo]);

  const canGenerate = Boolean(periodId && rangeStart && rangeEnd);
  const helperText = !periodId
    ? "Leo needs an academic period context before it can generate a report brief."
    : scope === "range"
      ? `Leo will analyze ${rangeLabel} using ${periodLabel ?? "the current academic period"} as academic context.`
      : `Leo will analyze the selected period window for ${periodLabel ?? "this academic period"}.`;

  const handleGenerate = async (force = false) => {
    if (!periodId || !rangeStart || !rangeEnd) return;
    try {
      const data = await generateLeoBrief({
        startDate: rangeStart,
        endDate: rangeEnd,
        reportType,
        force,
      });
      setBrief(data);
    } catch {
      // The mutation state renders the error message.
    }
  };

  const handleDownloadPdf = async () => {
    if (!brief?.id) return;
    setDownloadingPdf(true);
    setPdfError(null);
    try {
      const res = await fetch(`/api/admin/reports/${brief.id}/pdf`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to generate PDF");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = /filename=\"?([^\"]+)\"?/i.exec(disp || "");
      const name = match?.[1] ?? `leo-report-${brief.id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : "Failed to generate PDF"
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-purple-500/20 bg-linear-to-r from-purple-500/10 via-indigo-500/5 to-transparent p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-purple-400/30 bg-purple-500/20 p-1.5">
            <LeoIcon className="h-4 w-4 text-purple-200" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Leo Executive Brief</p>
            <p className="text-xs text-white/60">
              AI-generated summary and next actions for {rangeLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-purple-400/30 bg-purple-500/10 text-[10px] uppercase tracking-[0.2em] text-purple-100">
            {reportType}
          </Badge>
          <Badge className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70">
            Recommended {suggestedType}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Leo Context
          </p>
          <p className="text-sm text-white/80">{helperText}</p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Brief Cadence
          </p>
          <Select
            value={reportType}
            onValueChange={(value) => setReportType(value as RecurringReportType)}
            disabled={!periodId}
          >
            <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => void handleGenerate(Boolean(brief))}
          disabled={!canGenerate || isGeneratingLeo}
          className="gap-2 rounded-xl bg-purple-600 hover:bg-purple-700"
        >
          {isGeneratingLeo ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LeoIcon className="h-4 w-4" />
          )}
          {brief ? "Regenerate with Leo" : "Generate with Leo"}
        </Button>
      </div>

      {isLeoError ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
          {leoError.message}
        </div>
      ) : null}
      {pdfError ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
          {pdfError}
        </div>
      ) : null}

      <div className="mt-4">
        {!periodId ? (
          <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/10 px-6 py-8 text-center">
            <p className="text-sm text-amber-100">
              No academic periods are available yet.
            </p>
            <p className="mt-2 text-xs text-amber-100/70">
              Leo uses an academic period as the school context for this report window.
            </p>
          </div>
        ) : isGeneratingLeo && !brief ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-purple-400/30 bg-purple-500/5 px-6 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            <span className="text-sm text-white/60">Leo is analyzing this window...</span>
          </div>
        ) : !brief ? (
          <div className="rounded-xl border border-dashed border-purple-400/30 bg-purple-500/5 px-6 py-8 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/20">
                <LeoIcon className="h-6 w-6 text-purple-300" />
              </div>
            </div>
            <p className="text-sm text-white/70">
              Generate an operator-ready brief that explains what changed, what matters, and what to do next.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-400/20 bg-purple-500/10 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-white/60">
                  <Clock3 className="h-3.5 w-3.5" />
                  Generated {formatDistanceToNow(new Date(brief.generatedAt), { addSuffix: true })}
                </span>
                <Badge className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70">
                  {brief.source === "cache" ? "Saved Brief" : "Fresh Run"}
                </Badge>
                {periodLabel ? (
                  <Badge className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70">
                    {periodLabel}
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleGenerate(true)}
                  disabled={isGeneratingLeo}
                  className="h-8 gap-1 text-xs text-purple-200 hover:bg-purple-500/20"
                >
                  {isGeneratingLeo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Refresh Brief
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDownloadPdf()}
                  disabled={downloadingPdf}
                  className="h-8 gap-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                >
                  {downloadingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <DownloadCloud className="h-3.5 w-3.5" />
                  )}
                  Download PDF
                </Button>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-300" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                    Executive Summary
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-white/90">
                  {brief.content.summary}
                </p>
              </div>

              {brief.content.sections.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-3">
                  {brief.content.sections.map((section, index) => (
                    <div
                      key={`${section.title}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                        {section.title}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-white/80">
                        {section.content}
                      </p>
                      {section.highlights?.length ? (
                        <ul className="mt-3 space-y-1.5">
                          {section.highlights.map((highlight, highlightIndex) => (
                            <li
                              key={`${section.title}-${highlightIndex}`}
                              className="flex items-start gap-2 text-xs text-white/65"
                            >
                              <span className="mt-0.5 text-purple-300">•</span>
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {brief.content.suggestions.length > 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-300" />
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                      Recommended Actions
                    </p>
                  </div>
                  <div className="space-y-2">
                    {brief.content.suggestions.map((suggestion, index) => (
                      <div
                        key={`${suggestion.text}-${index}`}
                        className="flex items-start gap-2 text-sm text-white/80"
                      >
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                        <div className="min-w-0">
                          <p>{suggestion.text}</p>
                          {suggestion.category ? (
                            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/40">
                              {humanizeLabel(suggestion.category)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ReportsPage() {
  const busy = useBusyToast();
  const [scope, setScope] = React.useState<ReportScope>("range");
  const [startDate, setStartDate] = React.useState<Date | null>(() => {
    const end = new Date();
    return new Date(end.getTime() - 29 * DAY_MS);
  });
  const [endDate, setEndDate] = React.useState<Date | null>(() => new Date());
  const [periodId, setPeriodId] = React.useState<string | null>(null);
  const [selectedReportKey, setSelectedReportKey] = React.useState<ReportKey | null>(
    null
  );

  const { data: periodsData, isLoading: periodsLoading } =
    useAcademicPeriods();
  const periods = periodsData?.periods ?? [];
  const currentPeriod = periods.find((period) => period.isCurrent) ?? null;

  const activePeriodId =
    scope === "period" ? periodId ?? currentPeriod?._id ?? null : null;
  const leoContextPeriod = React.useMemo(() => {
    if (activePeriodId) {
      return periods.find((period) => period._id === activePeriodId) ?? null;
    }
    return currentPeriod ?? periods[0] ?? null;
  }, [activePeriodId, currentPeriod, periods]);

  const summaryQuery = useReportsSummary({
    periodId: activePeriodId,
    startDate: scope === "range" ? startDate : null,
    endDate: scope === "range" ? endDate : null,
  });

  const chartsQuery = useReportsCharts({
    periodId: activePeriodId,
    startDate: scope === "range" ? startDate : null,
    endDate: scope === "range" ? endDate : null,
  });

  const exportsQuery = useReportExports({ limit: 6 });
  const createExport = useCreateReportExport();

  const curriculumQuery = useQuery({
    queryKey: ["admin-curriculum"],
    queryFn: async () => {
      const res = await fetch("/api/admin/curriculum");
      if (!res.ok) throw new Error("Failed to load curriculum");
      return res.json() as Promise<{
        success: boolean;
        data?: { lighthouseExportAvailable?: boolean };
      }>;
    },
    staleTime: 60_000,
  });
  const lighthouseExportAvailable =
    curriculumQuery.data?.data?.lighthouseExportAvailable === true;

  const summary = summaryQuery.data?.categories;
  const range = summaryQuery.data?.range;
  const charts = chartsQuery.data?.charts;
  const interval = chartsQuery.data?.interval ?? "month";
  const intervalLabel = formatIntervalLabel(chartsQuery.data?.interval);

  const rangeStart = range?.startDate ?? (startDate ? startDate.toISOString() : null);
  const rangeEnd = range?.endDate ?? (endDate ? endDate.toISOString() : null);
  const canUseRange = Boolean(rangeStart && rangeEnd);
  const periodReady = scope === "period" && Boolean(activePeriodId);

  const fallbackRangeLabel = getFallbackRangeLabel(scope, currentPeriod, startDate, endDate);

  const rangeLabel = getRangeLabel(range, fallbackRangeLabel);
  const selectedRangeDays =
    range?.days ??
    (rangeStart && rangeEnd
      ? Math.max(
          1,
          Math.floor(
            (new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) /
              DAY_MS
          ) + 1
        )
      : null);

  const reportGroups = groupReportDefinitions(REPORT_DEFINITION_LIST);

  const selectedReport =
    REPORT_DEFINITION_LIST.find(
      (definition) => definition.key === selectedReportKey
    ) ?? null;

  const selectedTone = getSelectedTone(selectedReport);

  const revenueTrend = (charts?.fees.revenueTrend.points ?? []).map((point) => ({
    ...point,
    amount: point.value / 100,
    amountMinor: point.value,
  }));

  const enrollmentTrend = charts?.students.enrollmentTrend.points ?? [];
  const attendanceTrend = charts?.attendance.attendanceTrend.points ?? [];
  const invitationsTrend = charts?.invitations.sentTrend.points ?? [];
  const activityTrend = charts?.activity.volumeTrend.points ?? [];

  const formatDateTick = (label: string | number) =>
    formatAxisLabel(String(label), interval);

  const handleRefresh = () =>
    busy.promise(
      Promise.all([
        summaryQuery.refetch(),
        chartsQuery.refetch(),
        exportsQuery.refetch(),
      ]),
      {
        loading: "Refreshing reports...",
        success: "Reports updated",
        error: "Failed to refresh reports",
      }
    );

  const downloadExport = async (downloadUrl: string, fileName?: string | null) => {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error("Failed to generate export");

    const blob = await res.blob();
    const objectUrl = globalThis.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName || "report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    globalThis.URL.revokeObjectURL(objectUrl);
    await exportsQuery.refetch();
  };

  const exportContext = {
    periodReady,
    activePeriodId,
    rangeStart,
    rangeEnd,
  };

  const handleGenerateReport = async (definition: ReportDefinition) => {
    const payload = buildExportPayload(definition, exportContext);
    if (!payload) {
      if (definition.rangeMode === "period") {
        busy.warning("Select an academic period to export this report.");
        return;
      }
      busy.warning("Select a start and end date to export this report.");
      return;
    }

    try {
      await busy.promise(
        (async () => {
          const response = await createExport.mutateAsync(payload);
          await downloadExport(response.data.downloadUrl, response.data.fileName);
        })(),
        {
          loading: "Generating report...",
          success: "Report export ready",
          error: (err) =>
            err instanceof Error ? err.message : "Failed to generate report",
        }
      );
      setSelectedReportKey(null);
    } catch {
      // Keep the modal open if the export fails.
    }
  };

  const handleDownloadExport = async (item: ReportExportItem) => {
    try {
      await busy.promise(
        downloadExport(
          `/api/admin/reports/export?exportId=${item.id}`,
          item.fileName ?? `${item.reportKey}.${item.format}`
        ),
        {
          loading: "Preparing export...",
          success: "Export downloaded",
          error: "Failed to download export",
        }
      );
    } catch {
      // Errors are surfaced by toast.
    }
  };

  const handleCurriculumSnapshotDownload = async () => {
    try {
      await busy.promise(
        (async () => {
          const res = await fetch("/api/admin/reports/curriculum-snapshot/export");
          const contentType = res.headers.get("Content-Type") || "";
          if (!res.ok) {
            if (contentType.includes("application/json")) {
              const j = (await res.json()) as { error?: string };
              throw new Error(j.error || "Export not available");
            }
            throw new Error("Export not available");
          }
          const cd = res.headers.get("Content-Disposition");
          let fileName = "cambridge-curriculum-snapshot.csv";
          const m = cd?.match(/filename="([^"]+)"/);
          if (m?.[1]) fileName = m[1];
          const blob = await res.blob();
          const objectUrl = globalThis.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = objectUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          globalThis.URL.revokeObjectURL(objectUrl);
        })(),
        {
          loading: "Preparing curriculum snapshot...",
          success: "Curriculum snapshot downloaded",
          error: (err) =>
            err instanceof Error ? err.message : "Failed to download snapshot",
        }
      );
    } catch {
      // Errors surfaced by toast.
    }
  };

  const isRefreshing =
    summaryQuery.isFetching || chartsQuery.isFetching || exportsQuery.isFetching;

  const attendanceTooltip = buildAttendanceTooltip(formatDateTick);
  const academicsTooltip = buildAcademicsTooltip();

  const modalRangeHint = getModalRangeHint(selectedReport, periodReady, canUseRange);
  const modalRangeLabel = getModalRangeLabel(selectedReport, range, currentPeriod, rangeLabel);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Reports</h1>
          <p className="text-muted">
            Analytics and exports across your entire school
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-sky-500/15 via-sky-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Report Filters
            </CardTitle>
            <p className="text-xs text-white/50">
              Set the time window that powers every chart and export.
            </p>
          </div>
          <Badge
            variant="secondary"
            className="w-fit border border-white/10 bg-white/10 text-white/70"
          >
            <CalendarClock className="mr-2 h-3.5 w-3.5" />
            {rangeLabel}
          </Badge>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Scope
                </p>
                <Select
                  value={scope}
                  onValueChange={(value) => setScope(value as ReportScope)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="range">Custom Range</SelectItem>
                    <SelectItem value="period">Academic Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Period
                </p>
                <Select
                  value={activePeriodId ?? undefined}
                  onValueChange={(value) => setPeriodId(value)}
                  disabled={scope !== "period" || periodsLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        periodsLoading ? "Loading periods..." : "Select period"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {periods.length === 0 && (
                      <SelectItem value="no-periods" disabled>
                        No periods available
                      </SelectItem>
                    )}
                    {periods.map((period) => (
                      <SelectItem key={period._id} value={period._id}>
                        {period.term} {period.yearLabel}
                        {period.isCurrent ? " (current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Date Range
              </p>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                disabled={scope === "period"}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <LeoExecutiveBriefCard
        scope={scope}
        periodId={leoContextPeriod?._id ?? null}
        periodLabel={
          leoContextPeriod
            ? `${leoContextPeriod.term} ${leoContextPeriod.yearLabel}`
            : null
        }
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        rangeLabel={rangeLabel}
        rangeDays={selectedRangeDays}
      />

      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold">
            Snapshot Preview
          </CardTitle>
          <p className="text-xs text-white/50">
            Quick read on the selected reporting window.
          </p>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue"
              value={formatMoney(summary?.fees.revenueInRangeMinor ?? 0)}
              subtitle={`${summary?.fees.paymentsCount ?? 0} payments`}
              loading={summaryQuery.isLoading}
            />
            <StatCard
              label="Collection Rate"
              value={`${summary?.fees.collectionRate?.toFixed(1) ?? "0.0"}%`}
              subtitle={`${summary?.fees.overdueCount ?? 0} overdue`}
              loading={summaryQuery.isLoading}
            />
            <StatCard
              label="Outstanding"
              value={formatMoney(summary?.fees.outstandingMinor ?? 0)}
              subtitle={`${summary?.fees.invoicesInRange ?? 0} invoices`}
              loading={summaryQuery.isLoading}
            />
            <StatCard
              label="Students"
              value={`${summary?.students.total ?? 0}`}
              subtitle={`${summary?.students.newInRange ?? 0} new`}
              loading={summaryQuery.isLoading}
            />
            <StatCard
              label="Teachers"
              value={`${summary?.teachers.total ?? 0}`}
              subtitle={`${summary?.teachers.homeroomCount ?? 0} homerooms`}
              loading={summaryQuery.isLoading}
            />
            <StatCard
              label="Attendance Rate"
              value={`${summary?.attendance.presentRate?.toFixed(1) ?? "0.0"}%`}
              subtitle={`${summary?.attendance.totalRecords ?? 0} entries`}
              loading={summaryQuery.isLoading}
            />
            <StatCard
              label="Invitations"
              value={`${summary?.invitations.total ?? 0}`}
              subtitle={`${summary?.invitations.status.pending ?? 0} pending`}
              loading={summaryQuery.isLoading}
            />
            <StatCard
              label="Academics"
              value={`${summary?.academics.averageScore?.toFixed(1) ?? "0.0"} avg`}
              subtitle={`${summary?.academics.passRate?.toFixed(1) ?? "0.0"}% pass`}
              loading={summaryQuery.isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {summaryQuery.isError ? (
        <Card className="border border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-rose-100">
            We could not load the reports summary. Please try refreshing.
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10">
              <BarChart3 className="h-5 w-5 text-sky-200" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Insights and Charts</h2>
              <p className="text-xs text-white/50">
                Live analytics for every category in your reporting window.
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70"
          >
            {intervalLabel} interval
          </Badge>
        </div>

        {chartsQuery.isError ? (
          <Card className="border border-rose-500/30 bg-rose-500/10">
            <CardContent className="p-4 text-sm text-rose-100">
              We could not load the charts. Please try refreshing.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <SectionHeader
                icon={TrendingUp}
                title="Fees and Billing"
                description="Revenue velocity, payment methods, and invoice status."
                tone="emerald"
              />
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartCard
                  title="Revenue Trend"
                  description="Completed payments over time."
                  icon={TrendingUp}
                  tone="emerald"
                  loading={chartsQuery.isLoading}
                  empty={revenueTrend.length === 0}
                  emptyLabel="No payments recorded in this range."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={revenueTrend} margin={{ left: 0, right: 16 }}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        minTickGap={18}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (label) =>
                            label ? formatDateTick(label) : "Revenue",
                          valueFormatter: (value, entry) => {
                            const amount =
                              getPayloadNumber(entry.payload, "amountMinor") ??
                              Math.round(value * 100);
                            return formatMoney(amount);
                          },
                        })}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#34d399"
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Payment Methods"
                  description="Volume by payment channel."
                  icon={TrendingUp}
                  tone="emerald"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.fees.paymentMethods ?? []).length === 0}
                  emptyLabel="No payment method data yet."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={charts?.fees.paymentMethods ?? []}
                      layout="vertical"
                      margin={{ left: 10, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        type="number"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={90}
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={(value) => humanizeLabel(String(value))}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Payment method";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {(charts?.fees.paymentMethods ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={FEES_COLORS[index % FEES_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Invoice Status"
                  description="Distribution across invoice lifecycle."
                  icon={TrendingUp}
                  tone="emerald"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.fees.invoiceStatus ?? []).length === 0}
                  emptyLabel="No invoice data yet."
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={charts?.fees.invoiceStatus ?? []}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="rgba(255,255,255,0.1)"
                      >
                        {(charts?.fees.invoiceStatus ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={FEES_COLORS[index % FEES_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Invoice status";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <DistributionLegend
                    data={charts?.fees.invoiceStatus ?? []}
                    colors={FEES_COLORS}
                  />
                </ChartCard>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={Users}
                title="Students"
                description="Enrollment momentum and student status mix."
                tone="sky"
              />
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartCard
                  title="Enrollment Trend"
                  description="New enrollments across the range."
                  icon={Users}
                  tone="sky"
                  loading={chartsQuery.isLoading}
                  empty={enrollmentTrend.length === 0}
                  emptyLabel="No enrollments recorded in this range."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={enrollmentTrend} margin={{ left: 0, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        minTickGap={18}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (label) =>
                            label ? formatDateTick(label) : "Enrollment",
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Grade Distribution"
                  description="Student count by grade."
                  icon={Users}
                  tone="sky"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.students.gradeDistribution ?? []).length === 0}
                  emptyLabel="No student distribution data yet."
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={charts?.students.gradeDistribution ?? []}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="rgba(255,255,255,0.1)"
                      >
                        {(charts?.students.gradeDistribution ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={STUDENT_COLORS[index % STUDENT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Grade";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <DistributionLegend
                    data={charts?.students.gradeDistribution ?? []}
                    colors={STUDENT_COLORS}
                  />
                </ChartCard>

                <ChartCard
                  title="Student Status"
                  description="Active vs inactive mix."
                  icon={Users}
                  tone="sky"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.students.statusDistribution ?? []).length === 0}
                  emptyLabel="No student status data yet."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={charts?.students.statusDistribution ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={(value) => humanizeLabel(String(value))}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Status";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {(charts?.students.statusDistribution ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={STUDENT_COLORS[index % STUDENT_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={UserCheck}
                title="Teachers"
                description="Staff status, departments, and workload focus."
                tone="violet"
              />
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartCard
                  title="Staff Status"
                  description="Active vs leave and inactive counts."
                  icon={UserCheck}
                  tone="violet"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.teachers.statusDistribution ?? []).length === 0}
                  emptyLabel="No teacher status data yet."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={charts?.teachers.statusDistribution ?? []}
                      layout="vertical"
                      margin={{ left: 10, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        type="number"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={90}
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={(value) => humanizeLabel(String(value))}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Status";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {(charts?.teachers.statusDistribution ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={TEACHER_COLORS[index % TEACHER_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Departments"
                  description="Top department distribution."
                  icon={UserCheck}
                  tone="violet"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.teachers.departmentDistribution ?? []).length === 0}
                  emptyLabel="No department data yet."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={charts?.teachers.departmentDistribution ?? []}
                      layout="vertical"
                      margin={{ left: 10, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        type="number"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={100}
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={(value) => humanizeLabel(String(value))}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Department";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {(charts?.teachers.departmentDistribution ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={TEACHER_COLORS[index % TEACHER_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Assignments by Subject"
                  description="Active assignments per subject."
                  icon={UserCheck}
                  tone="violet"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.teachers.assignmentsBySubject ?? []).length === 0}
                  emptyLabel="No assignments recorded yet."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={charts?.teachers.assignmentsBySubject ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        angle={-25}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Subject";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {(charts?.teachers.assignmentsBySubject ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={TEACHER_COLORS[index % TEACHER_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={ClipboardCheck}
                title="Attendance"
                description="Presence coverage and status distribution."
                tone="amber"
              />
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title="Attendance Rate"
                  description="Present rate across the range."
                  icon={ClipboardCheck}
                  tone="amber"
                  loading={chartsQuery.isLoading}
                  empty={attendanceTrend.length === 0}
                  emptyLabel="No attendance data recorded in this range."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={attendanceTrend} margin={{ left: 0, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        minTickGap={18}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip content={attendanceTooltip} />
                      <Line
                        type="monotone"
                        dataKey="presentRate"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Attendance Status"
                  description="Breakdown by status."
                  icon={ClipboardCheck}
                  tone="amber"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.attendance.statusDistribution ?? []).length === 0}
                  emptyLabel="No attendance status data yet."
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={charts?.attendance.statusDistribution ?? []}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="rgba(255,255,255,0.1)"
                      >
                        {(charts?.attendance.statusDistribution ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={ATTENDANCE_COLORS[index % ATTENDANCE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Status";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <DistributionLegend
                    data={charts?.attendance.statusDistribution ?? []}
                    colors={ATTENDANCE_COLORS}
                  />
                </ChartCard>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={Mail}
                title="Invitations"
                description="Invitation activity, status, and role mix."
                tone="cyan"
              />
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartCard
                  title="Invitations Sent"
                  description="Volume of invites by day."
                  icon={Mail}
                  tone="cyan"
                  loading={chartsQuery.isLoading}
                  empty={invitationsTrend.length === 0}
                  emptyLabel="No invitations sent in this range."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={invitationsTrend} margin={{ left: 0, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        minTickGap={18}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (label) =>
                            label ? formatDateTick(label) : "Invitations",
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Invitation Status"
                  description="Acceptance and expiry mix."
                  icon={Mail}
                  tone="cyan"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.invitations.statusDistribution ?? []).length === 0}
                  emptyLabel="No invitation status data yet."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={charts?.invitations.statusDistribution ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={(value) => humanizeLabel(String(value))}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Status";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {(charts?.invitations.statusDistribution ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={INVITATION_COLORS[index % INVITATION_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Invitation Roles"
                  description="Role distribution for invites."
                  icon={Mail}
                  tone="cyan"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.invitations.roleDistribution ?? []).length === 0}
                  emptyLabel="No role data yet."
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={charts?.invitations.roleDistribution ?? []}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="rgba(255,255,255,0.1)"
                      >
                        {(charts?.invitations.roleDistribution ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={INVITATION_COLORS[index % INVITATION_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Role";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <DistributionLegend
                    data={charts?.invitations.roleDistribution ?? []}
                    colors={INVITATION_COLORS}
                  />
                </ChartCard>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={BookOpen}
                title="Academics"
                description="Subject averages and pass rate distribution."
                tone="rose"
                badge={charts?.academics.scope ? `${humanizeLabel(charts.academics.scope)} scope` : undefined}
              />
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title="Average by Subject"
                  description="Top subject averages in the period."
                  icon={BookOpen}
                  tone="rose"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.academics.averageBySubject ?? []).length === 0}
                  emptyLabel="No academic performance data yet."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={charts?.academics.averageBySubject ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        angle={-25}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip content={academicsTooltip} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {(charts?.academics.averageBySubject ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={ACADEMIC_COLORS[index % ACADEMIC_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Pass Rate"
                  description="Overall pass vs fail distribution."
                  icon={BookOpen}
                  tone="rose"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.academics.passRateDistribution ?? []).length === 0}
                  emptyLabel="No pass rate data yet."
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={charts?.academics.passRateDistribution ?? []}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="rgba(255,255,255,0.1)"
                      >
                        {(charts?.academics.passRateDistribution ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={ACADEMIC_COLORS[index % ACADEMIC_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Pass rate";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <DistributionLegend
                    data={charts?.academics.passRateDistribution ?? []}
                    colors={ACADEMIC_COLORS}
                  />
                </ChartCard>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={ActivityIcon}
                title="Activity"
                description="System events and top activity types."
                tone="slate"
              />
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title="Activity Volume"
                  description="System activity over time."
                  icon={ActivityIcon}
                  tone="slate"
                  loading={chartsQuery.isLoading}
                  empty={activityTrend.length === 0}
                  emptyLabel="No activity logged in this range."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={activityTrend} margin={{ left: 0, right: 16 }}>
                      <defs>
                        <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        minTickGap={18}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (label) =>
                            label ? formatDateTick(label) : "Activity",
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        fill="url(#activityGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Top Activity Types"
                  description="Most frequent system events."
                  icon={ActivityIcon}
                  tone="slate"
                  loading={chartsQuery.isLoading}
                  empty={(charts?.activity.topTypes ?? []).length === 0}
                  emptyLabel="No activity types recorded yet."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={charts?.activity.topTypes ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        angle={-20}
                        textAnchor="end"
                        height={60}
                        interval={0}
                        tickFormatter={(value) => humanizeLabel(String(value))}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <Tooltip
                        content={buildTooltip({
                          labelFormatter: (_label, payload) => {
                            const entry = payload[0];
                            const raw = getPayloadString(entry?.payload, "label");
                            return raw ? humanizeLabel(raw) : "Activity";
                          },
                          valueFormatter: (value) => formatCount(value),
                        })}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {(charts?.activity.topTypes ?? []).map((entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>
          </div>
        )}
      </section>

      {lighthouseExportAvailable ? (
        <section>
          <Card className="border border-cyan-500/20 bg-linear-to-br from-cyan-500/10 to-transparent backdrop-blur">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
                  <Lightbulb className="h-5 w-5 text-cyan-200" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-cyan-50">
                    Cambridge curriculum snapshot
                  </h2>
                  <p className="text-sm text-white/60">
                    Read-only CSV: profile labels, report preset name, and your
                    configured academic periods. Does not include learner grades or
                    lesson content.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 gap-2 border border-cyan-500/30 bg-cyan-500/15 text-cyan-50 hover:bg-cyan-500/25"
                onClick={() => void handleCurriculumSnapshotDownload()}
              >
                <DownloadCloud className="h-4 w-4" />
                Download CSV
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                <DownloadCloud className="h-5 w-5 text-white/80" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Report Library</h2>
                <p className="text-xs text-white/50">
                  Generate exports using the current reporting window.
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.2em] text-white/70"
            >
              {rangeLabel}
            </Badge>
          </div>

          <div className="space-y-6">
            {CATEGORY_META.map((category) => {
              const reports = reportGroups[category.key];
              if (!reports.length) return null;

              return (
                <div key={category.key} className="space-y-3">
                  <SectionHeader
                    icon={category.icon}
                    title={category.label}
                    description={category.description}
                    tone={category.tone}
                    badge={`${reports.length} report${reports.length === 1 ? "" : "s"}`}
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    {reports.map((definition) => {
                      const isPeriodLocked =
                        definition.rangeMode === "period" && !periodReady;
                      const isRangeLocked =
                        definition.rangeMode === "range" && !canUseRange;
                      const disabled =
                        createExport.isPending || isPeriodLocked || isRangeLocked;
                      const disabledMessage = getReportDisabledMessage(isPeriodLocked, isRangeLocked);
                      const rangeHint = getReportRangeHint(definition.rangeMode, isPeriodLocked, rangeLabel);

                      return (
                        <ReportTemplateCard
                          key={definition.key}
                          definition={definition}
                          tone={category.tone}
                          rangeHint={rangeHint}
                          disabled={disabled}
                          disabledMessage={disabledMessage}
                          onSelect={(key) => setSelectedReportKey(key)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <RecentExportsCard
            exportsQuery={exportsQuery}
            onDownload={handleDownloadExport}
          />
        </div>
      </section>

      <ExportDialog
        selectedReport={selectedReport}
        selectedTone={selectedTone}
        modalRangeLabel={modalRangeLabel}
        modalRangeHint={modalRangeHint}
        isPending={createExport.isPending}
        onClose={() => setSelectedReportKey(null)}
        onGenerate={handleGenerateReport}
      />
    </div>
  );
}
