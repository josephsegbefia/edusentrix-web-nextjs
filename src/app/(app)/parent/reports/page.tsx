// src/app/(app)/parent/reports/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import {
  FileText,
  AlertTriangle,
  Download,
  Users,
  Calendar,
  Award,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import { useParentReports } from "@/hooks/parent/useParentReports";
import type { AvailableReport, ReportStatus } from "@/hooks/parent/useParentReports";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/useToast";

/* --------------------------------------------------------------------------------
   Helpers
-------------------------------------------------------------------------------- */
function getStatusConfig(status: ReportStatus) {
  const configs: Record<ReportStatus, { icon: React.ElementType; label: string; className: string }> = {
    available: {
      icon: CheckCircle2,
      label: "Available",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    not_available: {
      icon: XCircle,
      label: "Not Available",
      className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    },
  };
  return configs[status];
}

/* --------------------------------------------------------------------------------
   Report Card Component
-------------------------------------------------------------------------------- */
function ReportCard({
  report,
  onView,
  isDownloading = false,
}: {
  report: AvailableReport;
  onView: () => void;
  isDownloading?: boolean;
}) {
  const statusConfig = getStatusConfig(report.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-4 transition-all duration-200",
        report.status === "available"
          ? "border-white/15 bg-gradient-to-br from-white/5 to-transparent hover:border-white/25 hover:shadow-lg"
          : "border-white/10 bg-white/2 opacity-70"
      )}
    >
      {/* Decorative gradient for available reports */}
      {report.status === "available" && (
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
                report.status === "available"
                  ? "bg-emerald-500/20 border-emerald-500/30"
                  : "bg-slate-500/20 border-slate-500/30"
              )}
            >
              <FileText
                className={cn(
                  "h-6 w-6",
                  report.status === "available" ? "text-emerald-300" : "text-slate-400"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{report.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] bg-white/5 text-white/60 border-white/20">
                  {report.wardName}
                </Badge>
                <span className="text-xs text-white/40">{report.classGroup}</span>
              </div>
              {report.generatedAt && (
                <p className="text-xs text-white/40 mt-2">
                  Generated: {format(parseISO(report.generatedAt), "MMM d, yyyy")}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={statusConfig.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>

            {report.status === "available" && report.averageScore != null && (
              <div className="text-right">
                <p className="text-lg font-bold text-emerald-300">{report.averageScore.toFixed(1)}%</p>
                {report.classPosition && (
                  <p className="text-[10px] text-white/40">#{report.classPosition} in class</p>
                )}
              </div>
            )}
          </div>
        </div>

        {report.status === "available" && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              onClick={onView}
              disabled={isDownloading}
              size="sm"
              className="gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              {isDownloading ? "Downloading..." : "Download Report"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function parseDownloadFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) return decodeURIComponent(encodedMatch[1]);
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
}

/* --------------------------------------------------------------------------------
   Summary Cards
-------------------------------------------------------------------------------- */
function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: "emerald" | "blue" | "purple";
}) {
  const tones = {
    emerald: {
      gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20 border-emerald-500/30",
      iconColor: "text-emerald-300",
    },
    blue: {
      gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
      iconBg: "bg-blue-500/20 border-blue-500/30",
      iconColor: "text-blue-300",
    },
    purple: {
      gradient: "from-purple-500/15 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/20 border-purple-500/30",
      iconColor: "text-purple-300",
    },
  };

  const style = tones[tone];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-lg">
      <div className={cn("pointer-events-none absolute inset-0 bg-linear-to-br opacity-60", style.gradient)} />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", style.iconBg)}>
            <Icon className={cn("h-5 w-5", style.iconColor)} />
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-white/50">{label}</span>
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Main Content
-------------------------------------------------------------------------------- */
function ReportsPageContent() {
  const [selectedWard, setSelectedWard] = React.useState<string>("all");
  const [downloadingReportId, setDownloadingReportId] = React.useState<string | null>(null);
  const { error: toastError, success: toastSuccess } = useToast();

  const wardId = selectedWard !== "all" ? selectedWard : undefined;
  const { data, isLoading, error } = useParentReports({ wardId });

  const handleDownloadReport = async (report: AvailableReport) => {
    setDownloadingReportId(report.id);
    try {
      const params = new URLSearchParams({
        wardId: report.wardId,
        periodId: report.periodId,
        type: report.type,
      });

      const res = await fetch(`/api/parent/reports/download?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Failed to download report" }));
        throw new Error(json.error || "Failed to download report");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        parseDownloadFileName(res.headers.get("Content-Disposition")) ||
        `${report.wardName.replace(/\s+/g, "-").toLowerCase()}-${report.periodLabel.replace(/\s+/g, "-").toLowerCase()}-${report.type}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toastSuccess("Report downloaded");
    } catch (downloadError) {
      toastError("Download failed", {
        description:
          downloadError instanceof Error
            ? downloadError.message
            : "Failed to download report",
      });
    } finally {
      setDownloadingReportId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Failed to load reports. Please try again.</p>
      </Card>
    );
  }

  const { wards = [], reports = [], periods = [] } = data || {};

  const availableCount = reports.filter((r) => r.status === "available").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="bg-linear-to-r from-indigo-200 via-purple-200 to-pink-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                Academic Reports
              </h1>
              {availableCount > 0 && (
                <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  {availableCount} Available
                </div>
              )}
            </div>
            <p className="text-sm text-white/60">
              Download term reports and report cards for your children
            </p>
          </div>

          {/* Ward Filter */}
          {wards.length > 1 && (
            <PremiumSelect value={selectedWard} onValueChange={setSelectedWard}>
              <PremiumSelectTrigger
                className="h-10 w-48 rounded-xl text-sm border-white/15 bg-white/5"
                icon={<Users className="h-4 w-4" />}
              >
                <PremiumSelectValue placeholder="Filter by child" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All Children</PremiumSelectItem>
                {wards.map((w) => (
                  <PremiumSelectItem key={w.id} value={w.id}>
                    {w.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={FileText}
          label="Total Reports"
          value={reports.length}
          tone="purple"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Available"
          value={availableCount}
          tone="emerald"
        />
        <SummaryCard
          icon={Calendar}
          label="Terms Covered"
          value={periods.length}
          tone="blue"
        />
      </div>

      {/* Reports Grid */}
      {reports.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-white/60" />
              Term Reports
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onView={() => handleDownloadReport(report)}
                isDownloading={downloadingReportId === report.id}
              />
            ))}
          </div>
        </div>
      ) : (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-2xl p-12 text-center">
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-indigo-500/20 to-purple-500/20">
              <FileText className="h-8 w-8 text-indigo-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">No Reports Available</h3>
              <p className="text-sm text-white/60 max-w-md">
                Term reports will appear here once the school generates them at the end of each term.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-4 gap-2 rounded-xl">
              <Link href="/parent/academics">
                <TrendingUp className="h-4 w-4" />
                View Academic Progress
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30">
            <Award className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <h4 className="font-medium text-indigo-200">About Reports</h4>
            <p className="text-sm text-indigo-200/70 mt-1">
              Term reports are generated at the end of each academic term and include grades, 
              teacher comments, attendance summary, and class rankings. Click on &quot;Download Report&quot; 
              to view detailed academic information.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Page Export
-------------------------------------------------------------------------------- */
export default function ParentReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <ReportsPageContent />
    </Suspense>
  );
}
