"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  DownloadCloud,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOverdueRisk } from "@/hooks/admin/useOverdueRisk";
import { useBusyToast } from "@/hooks/useBusyToast";
import { formatCurrency } from "@/lib/fees/money";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function resolveFileName(headerValue: string | null, fallback: string) {
  if (!headerValue) return fallback;
  const fileNameMatch = /filename="?([^"]+)"?/i.exec(headerValue);
  const extracted = fileNameMatch?.[1]?.trim();
  return extracted || fallback;
}

export default function OverdueReportPage() {
  const busy = useBusyToast();
  const [downloading, setDownloading] = React.useState(false);

  const overdueRiskQuery = useOverdueRisk({ limit: 250, topLimit: 6 });
  const snapshot = overdueRiskQuery.data?.data;
  const summary = snapshot?.summary;
  const rows = snapshot?.rows ?? [];

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await busy.promise(
        (async () => {
          const res = await fetch("/api/admin/fees/overdue-report/pdf?limit=250", {
            method: "GET",
            cache: "no-store",
          });

          if (!res.ok) {
            const payload = (await res.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(payload?.error || "Failed to generate overdue report PDF");
          }

          const blob = await res.blob();
          const fileName = resolveFileName(
            res.headers.get("Content-Disposition"),
            `overdue-report-${new Date().toISOString().slice(0, 10)}.pdf`
          );

          const url = globalThis.URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          globalThis.URL.revokeObjectURL(url);
        })(),
        {
          loading: "Generating verified overdue report...",
          success: "Overdue report downloaded",
          error: (error: unknown) =>
            error instanceof Error && error.message
              ? error.message
              : "Failed to generate overdue report PDF",
        }
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Finance</p>
          <h1 className="text-2xl font-semibold text-white">Overdue Report</h1>
          <p className="text-sm text-white/60">
            Verified snapshot of outstanding overdue invoices and risk exposure.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void overdueRiskQuery.refetch()}
            disabled={overdueRiskQuery.isFetching}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${overdueRiskQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading || (summary?.overdueInvoiceCount ?? 0) === 0}
            className="bg-brand text-black hover:bg-brand/90"
          >
            <DownloadCloud className="mr-2 h-4 w-4" />
            Download Verified PDF
          </Button>
        </div>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-rose-300" />
            Overdue Exposure
          </CardTitle>
          <Badge className="border border-white/10 bg-white/10 text-white/70">
            As of {formatDate(snapshot?.asOf ?? null)}
          </Badge>
        </CardHeader>
        <CardContent>
          {overdueRiskQuery.isLoading ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Loading overdue report data...
            </div>
          ) : overdueRiskQuery.isError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              Failed to load overdue report data. Please refresh.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55">Total Overdue</div>
                  <div className="mt-1 text-lg font-semibold text-rose-200">
                    {formatCurrency(summary?.totalOutstandingMinor ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55">Overdue Invoices</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {summary?.overdueInvoiceCount ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55">Students Affected</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {summary?.overdueStudentCount ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55">Aging 30+ Days</div>
                  <div className="mt-1 text-lg font-semibold text-rose-300">
                    {summary?.buckets["30_plus"]?.invoiceCount ?? 0}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="text-sm font-medium text-white">Overdue Students</div>
                  <div className="flex items-center gap-2 text-xs text-white/55">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    PDF includes verification ID and QR
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.12em] text-white/45">
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Guardian Contact</th>
                        <th className="px-4 py-3">Days Overdue</th>
                        <th className="px-4 py-3">Invoices</th>
                        <th className="px-4 py-3 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-sm text-white/60"
                            colSpan={5}
                          >
                            No overdue records found.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr
                            key={row.studentId}
                            className="border-b border-white/5 text-white/85"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium">{row.studentName}</div>
                              <div className="text-xs text-white/50">
                                {row.admissionNo || "No admission no."}
                                {row.classGroupName ? ` • ${row.classGroupName}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-white/70">
                              {row.primaryGuardian ? (
                                <div>
                                  <div>{row.primaryGuardian.name}</div>
                                  <div>
                                    {row.primaryGuardian.email || "No email"} •{" "}
                                    {row.primaryGuardian.phone || "No phone"}
                                  </div>
                                </div>
                              ) : (
                                "No guardian contact"
                              )}
                            </td>
                            <td className="px-4 py-3">{row.oldestDaysOverdue}</td>
                            <td className="px-4 py-3">{row.overdueInvoiceCount}</td>
                            <td className="px-4 py-3 text-right font-semibold text-rose-200">
                              {formatCurrency(row.totalOutstandingMinor)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {snapshot?.truncated ? (
                  <div className="border-t border-white/10 px-4 py-2 text-xs text-white/55">
                    Showing {rows.length} of {snapshot.totalRows} overdue students.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-white/55">
        Need broader analytics? Open{" "}
        <Link href="/admin/reports" className="text-brand hover:opacity-90">
          Reports
        </Link>{" "}
        for full export options.
      </div>
    </div>
  );
}
