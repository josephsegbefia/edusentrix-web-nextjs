"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Copy, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/fees/money";

type VerificationPayload = {
  verificationId: string;
  reportType: string;
  status: "issued" | "revoked";
  schoolName: string;
  reportLabel: string;
  issuedAt: string | null;
  revokedAt: string | null;
  range: {
    startDate: string | null;
    endDate: string | null;
    source: string | null;
    periodLabel: string | null;
  };
  meta: {
    categories: string[];
    version: number;
    rowCount: number | null;
    totalOutstandingMinor: number | null;
    overdueInvoiceCount: number | null;
  };
  createdAt: string | null;
};

function fmtDate(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function labelizeReportType(type: string) {
  if (type === "simple_snapshot") return "Simple Report Snapshot";
  if (type === "overdue_report") return "Overdue Risk Report";
  if (type === "term_report") return "Academic Term Report";
  if (type === "weekly_report") return "Weekly Report";
  if (type === "monthly_report") return "Monthly Report";
  if (type === "biweekly_report") return "Biweekly Report";
  return type;
}

function formatMoneyMinor(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return formatCurrency(value);
}

export default function ReportVerificationPage() {
  const params = useParams();
  const verificationId = String(params.verificationId || "").trim();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<VerificationPayload | null>(null);

  React.useEffect(() => {
    if (!verificationId) return;

    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/public/reports/verify/${encodeURIComponent(verificationId)}`,
          {
            cache: "no-store",
          }
        );
        const payload = (await res.json()) as
          | { success: true; data: VerificationPayload }
          | { error?: string };

        if (!res.ok || !("success" in payload) || !payload.success) {
          const message =
            "error" in payload && payload.error
              ? payload.error
              : "Verification record not found";
          throw new Error(message);
        }
        if (!cancelled) {
          setData(payload.data);
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "Verification failed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [verificationId]);

  const isValid = data?.status === "issued";

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">
                EduSentrix Verification
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                Report Authenticity Check
              </h1>
            </div>
            <ShieldCheck className="h-7 w-7 text-sky-300" />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/70">
              Validating document...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5">
              <div className="flex items-center gap-2 text-rose-200">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Unable to verify this document</span>
              </div>
              <p className="mt-2 text-sm text-rose-100/90">{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div
                className={`rounded-2xl border p-5 ${
                  isValid
                    ? "border-emerald-400/35 bg-emerald-500/10"
                    : "border-amber-300/35 bg-amber-500/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isValid ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-200" />
                  )}
                  <p
                    className={`text-sm font-semibold ${
                      isValid ? "text-emerald-100" : "text-amber-100"
                    }`}
                  >
                    {isValid
                      ? "This report is authentic and currently valid."
                      : "This verification record exists but is not active."}
                  </p>
                </div>
                <p className="mt-2 text-xs text-white/75">
                  This page confirms issuance metadata only. It intentionally does
                  not expose report contents.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">School</p>
                  <p className="mt-1 text-sm font-medium text-white">{data.schoolName}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">Report Type</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {labelizeReportType(data.reportType)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">Issued</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {fmtDate(data.issuedAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">Range</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {fmtDate(data.range.startDate)} to {fmtDate(data.range.endDate)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
                  <p className="text-xs text-white/50">Verification ID</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{data.verificationId}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(data.verificationId);
                        toast.success("Verification ID copied");
                      }}
                      className="h-7 border-white/15 bg-white/5 px-2 text-white hover:bg-white/10"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/50">Context</p>
                <p className="mt-1 text-sm text-white/80">
                  Label: {data.reportLabel} | Source: {data.range.source || "N/A"}
                  {data.range.periodLabel ? ` | Period: ${data.range.periodLabel}` : ""}
                </p>
                <p className="mt-1 text-xs text-white/55">
                  Template version {data.meta.version}. Included sections:{" "}
                  {data.meta.categories.join(", ")}.
                </p>
                {data.meta.rowCount !== null ||
                data.meta.totalOutstandingMinor !== null ||
                data.meta.overdueInvoiceCount !== null ? (
                  <p className="mt-1 text-xs text-white/55">
                    Records:{" "}
                    {data.meta.rowCount !== null ? data.meta.rowCount : "N/A"} | Overdue
                    invoices:{" "}
                    {data.meta.overdueInvoiceCount !== null
                      ? data.meta.overdueInvoiceCount
                      : "N/A"}{" "}
                    | Outstanding:{" "}
                    {formatMoneyMinor(data.meta.totalOutstandingMinor)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
