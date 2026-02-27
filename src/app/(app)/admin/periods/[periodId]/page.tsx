"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Calendar } from "lucide-react";
import { usePeriodSummary } from "@/hooks/admin/usePeriodSummary";
import { useSetCurrentPeriod } from "@/hooks/admin/useAcademicPeriods";
import { useGeneratePeriodReport } from "@/hooks/admin/usePeriodReport";
import {
  useGenerateRecurringReport,
  type RecurringReportType,
} from "@/hooks/admin/useRecurringReports";
import { useBusyToast } from "@/hooks/useBusyToast";
import { PeriodDetailHeader } from "@/components/admin/periods/PeriodDetailHeader";
import { PeriodDetailTabs, type PeriodDetailTabId } from "@/components/admin/periods/PeriodDetailTabs";
import { PeriodOverviewTab } from "@/components/admin/periods/PeriodOverviewTab";
import { PeriodReportsTab } from "@/components/admin/periods/PeriodReportsTab";

function getInitialTab(sp: URLSearchParams | null): PeriodDetailTabId {
  if (!sp) return "overview";
  const raw = sp.get("tab");
  if (raw === "overview" || raw === "reports") return raw;
  return "overview";
}

function PeriodDetailContent() {
  const params = useParams<{ periodId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const busy = useBusyToast();

  const periodId = params?.periodId;
  const [activeTab, setActiveTab] = React.useState<PeriodDetailTabId>(() =>
    getInitialTab(searchParams)
  );
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [downloadingReportId, setDownloadingReportId] = React.useState<string | null>(null);

  const { data: summaryData, isLoading, isError } = usePeriodSummary(periodId ?? null);
  const setCurrentMutation = useSetCurrentPeriod();
  const generateReportMutation = useGeneratePeriodReport(periodId ?? null);
  const generateRecurringMutation = useGenerateRecurringReport(periodId ?? null);

  React.useEffect(() => {
    if (!periodId) return;
    const current = new URLSearchParams(searchParams.toString());
    current.set("tab", activeTab);
    const qs = current.toString();
    router.replace(
      qs
        ? `/admin/periods/${encodeURIComponent(periodId)}?${qs}`
        : `/admin/periods/${encodeURIComponent(periodId)}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, periodId]);

  const handleSetCurrent = async () => {
    if (!periodId) return;
    await busy.promise(
      setCurrentMutation.mutateAsync(periodId),
      {
        loading: "Setting current period...",
        success: "Current period updated",
        error: (e) =>
          e instanceof Error ? e.message : "Failed to set current period",
      }
    );
  };

  const handleGenerateReport = async (force?: boolean) => {
    if (!periodId) return;
    await busy.promise(
      generateReportMutation.mutateAsync(force),
      {
        loading: "Generating AI report...",
        success: "Report generated",
        error: (e) =>
          e instanceof Error ? e.message : "Failed to generate report",
      }
    );
  };

  const handleDownloadRecurringPdf = async (reportId: string) => {
    setDownloadingReportId(reportId);
    try {
      await busy.promise(
        (async () => {
          const res = await fetch(`/api/admin/reports/${reportId}/pdf`, {
            cache: "no-store",
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error ?? "Failed to generate PDF");
          }
          const blob = await res.blob();
          const disp = res.headers.get("Content-Disposition");
          const match = /filename="?([^"]+)"?/i.exec(disp || "");
          const name = match?.[1] ?? `report-${reportId}.pdf`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        })(),
        {
          loading: "Generating PDF...",
          success: "PDF downloaded",
          error: (e) =>
            e instanceof Error ? e.message : "Failed to download PDF",
        }
      );
    } finally {
      setDownloadingReportId(null);
    }
  };

  const handleGenerateRecurringReport = async (payload: {
    startDate: string;
    endDate: string;
    reportType: RecurringReportType;
  }) => {
    await busy.promise(
      generateRecurringMutation.mutateAsync(payload),
      {
        loading: "Generating report...",
        success: "Report generated",
        error: (e) =>
          e instanceof Error ? e.message : "Failed to generate report",
      }
    );
  };

  const handleDownloadPdf = async () => {
    if (!periodId) return;
    setDownloadingPdf(true);
    try {
      await busy.promise(
        (async () => {
          const res = await fetch(
            `/api/admin/periods/${periodId}/report/pdf`,
            { cache: "no-store" }
          );
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error ?? "Failed to generate PDF");
          }
          const blob = await res.blob();
          const disp = res.headers.get("Content-Disposition");
          const match = /filename="?([^"]+)"?/i.exec(disp || "");
          const name = match?.[1] ?? `term-report-${periodId}.pdf`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        })(),
        {
          loading: "Generating PDF...",
          success: "PDF downloaded",
          error: (e) =>
            e instanceof Error ? e.message : "Failed to download PDF",
        }
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!periodId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent shadow-2xl shadow-black/40">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Missing period identifier
                </div>
                <p className="text-xs text-red-200/70">
                  The period ID was not provided in the URL.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/periods")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Periods
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <div className="relative z-10 flex items-start gap-4">
            <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
            <div className="space-y-2">
              <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-teal-950/40 to-transparent">
          <CardContent className="flex animate-pulse flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="size-24 rounded-full bg-white/10" />
              <div className="space-y-3">
                <div className="h-6 w-48 rounded bg-white/15" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded-full bg-white/10" />
                  <div className="h-5 w-24 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <div className="hidden w-80 space-y-3 md:block">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-xl bg-white/10" />
                <div className="h-24 rounded-xl bg-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-9 w-28 shrink-0 animate-pulse rounded-xl bg-white/10"
            />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        </div>
      </div>
    );
  }

  if (isError || !summaryData) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent shadow-2xl shadow-black/40">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Unable to load period details
                </div>
                <p className="text-xs text-red-200/70">
                  The period might not exist or you might not have access.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/periods")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Periods
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin/periods")}
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <h1 className="bg-linear-to-r from-teal-200 via-cyan-200 to-sky-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                Period Dashboard
              </h1>
              <p className="text-sm text-white/60">
                View summary, analytics, and generate reports for this period
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/periods")}
              className="gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Calendar className="h-3.5 w-3.5" />
              All Periods
            </Button>
          </div>
        </div>
      </div>

      {/* Period Header */}
      <PeriodDetailHeader
        data={summaryData}
        onSetCurrent={handleSetCurrent}
        isSettingCurrent={setCurrentMutation.isPending}
      />

      {/* Tabs Navigation */}
      <PeriodDetailTabs value={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <div>
        {activeTab === "overview" ? (
          <PeriodOverviewTab data={summaryData} />
        ) : activeTab === "reports" ? (
          <PeriodReportsTab
            periodId={periodId}
            onDownloadPdf={handleDownloadPdf}
            onDownloadRecurringPdf={handleDownloadRecurringPdf}
            onGenerateReport={handleGenerateReport}
            onGenerateRecurringReport={handleGenerateRecurringReport}
            downloadingPdf={downloadingPdf}
            downloadingReportId={downloadingReportId}
            isGeneratingReport={generateReportMutation.isPending}
            isGeneratingRecurring={generateRecurringMutation.isPending}
            periodStartDate={summaryData.period.startDate}
            periodEndDate={summaryData.period.endDate}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function PeriodDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="relative">
            <div className="relative z-10 flex items-start gap-4">
              <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              <div className="space-y-2">
                <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
                <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <PeriodDetailContent />
    </Suspense>
  );
}
