"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { glassPanelClass, glassInsetClass, glassPrimaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type ConsistencyIssue = {
  code: string;
  schoolId: string;
  schoolName: string;
  severity: "critical" | "warning" | "informational";
  description: string;
  metadata?: Record<string, unknown>;
};

type ScanReport = {
  scannedSchools: number;
  issueCount: number;
  issues: ConsistencyIssue[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  scanDurationMs: number;
  scannedAt: string;
};

const SEVERITY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  informational: Info,
};

const SEVERITY_PILL: Record<string, string> = {
  critical: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  informational: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
};

export default function LeakageDashboardPage() {
  const [loading, setLoading] = React.useState(false);
  const [report, setReport] = React.useState<ScanReport | null>(null);
  const [limit, setLimit] = React.useState("100");
  const [filterSeverity, setFilterSeverity] = React.useState<string>("all");

  async function runScan() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/platform/subscriptions/consistency-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: parseInt(limit, 10) || 100 }),
      });
      const json = await res.json();
      if (json.success) {
        setReport(json.data);
        toast.success(`Scanned ${json.data.scannedSchools} schools in ${json.data.scanDurationMs}ms.`);
      } else {
        toast.error("Scan failed.");
      }
    } catch { toast.error("Network error."); }
    finally { setLoading(false); }
  }

  const filteredIssues = React.useMemo(() => {
    if (!report) return [];
    if (filterSeverity === "all") return report.issues;
    return report.issues.filter((i) => i.severity === filterSeverity);
  }, [report, filterSeverity]);

  return (
    <div className="space-y-5 p-2 md:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/platform/subscriptions" className="mb-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
            <ChevronLeft className="h-3 w-3" /> Subscriptions
          </Link>
          <h1 className="text-xl font-semibold text-white">Entitlement leakage scanner</h1>
          <p className="text-xs text-white/40">
            Identify inconsistencies between plan entitlements and actual access states.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PremiumSelect
            value={limit}
            onValueChange={setLimit}
          >
            <PremiumSelectTrigger className="h-9 w-[130px] rounded-xl border-white/10 bg-white/5 text-xs text-white/60">
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="50">50 schools</PremiumSelectItem>
              <PremiumSelectItem value="100">100 schools</PremiumSelectItem>
              <PremiumSelectItem value="200">200 schools</PremiumSelectItem>
              <PremiumSelectItem value="500">500 schools</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
          <button
            type="button"
            onClick={runScan}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium",
              glassPrimaryButtonClass,
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Run scan
          </button>
        </div>
      </div>

      {!report && !loading && (
        <div className={cn(glassInsetClass, "flex items-center gap-3 px-5 py-8")}>
          <ScanLine className="h-5 w-5 text-white/20" />
          <div>
            <p className="text-sm text-white/50">No scan run yet.</p>
            <p className="text-xs text-white/30">Click "Run scan" to check entitlement consistency across schools.</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          <p className="text-xs text-white/40">Scanning… this may take a few seconds.</p>
        </div>
      )}

      {report && (
        <>
          {/* Summary metrics */}
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Schools scanned", value: String(report.scannedSchools), tone: "text-white/60" },
              { label: "Critical issues", value: String(report.criticalCount), tone: report.criticalCount > 0 ? "text-rose-300" : "text-emerald-300" },
              { label: "Warnings", value: String(report.warningCount), tone: report.warningCount > 0 ? "text-amber-300" : "text-emerald-300" },
              { label: "Informational", value: String(report.infoCount), tone: "text-cyan-300" },
            ].map(({ label, value, tone }) => (
              <div key={label} className={cn(glassInsetClass, "px-4 py-3")}>
                <p className="text-[10px] text-white/40">{label}</p>
                <p className={cn("text-2xl font-bold", tone)}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">
              {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""} shown
              {" · "}scanned at {new Date(report.scannedAt).toLocaleTimeString("en-GH")}
              {" · "}{report.scanDurationMs}ms
            </p>
            <PremiumSelect
              value={filterSeverity}
              onValueChange={setFilterSeverity}
            >
              <PremiumSelectTrigger className="h-9 w-[160px] rounded-xl border-white/10 bg-white/5 text-xs text-white/60">
                <PremiumSelectValue placeholder="All severities" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All severities</PremiumSelectItem>
                <PremiumSelectItem value="critical">Critical only</PremiumSelectItem>
                <PremiumSelectItem value="warning">Warnings only</PremiumSelectItem>
                <PremiumSelectItem value="informational">Informational only</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          {/* Issues */}
          {filteredIssues.length === 0 ? (
            <div className={cn(glassInsetClass, "flex items-center gap-3 px-5 py-6")}>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-sm text-white/50">No issues detected. Entitlements look consistent.</p>
            </div>
          ) : (
            <div className={cn(glassPanelClass, "divide-y divide-white/5 px-0 py-0")}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
              {filteredIssues.map((issue, idx) => {
                const Icon = SEVERITY_ICON[issue.severity] ?? AlertTriangle;
                return (
                  <div key={idx} className="flex items-start gap-3 px-5 py-4">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0",
                      issue.severity === "critical" ? "text-rose-300" :
                      issue.severity === "warning" ? "text-amber-300" : "text-cyan-300"
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase", SEVERITY_PILL[issue.severity] ?? "")}>
                          {issue.severity}
                        </span>
                        <span className="font-mono text-[10px] text-white/30">{issue.code}</span>
                        <Link href={`/platform/schools/${issue.schoolId}/subscription`}
                          className="text-xs font-medium text-white/70 hover:text-white">
                          {issue.schoolName}
                        </Link>
                      </div>
                      <p className="text-xs text-white/50">{issue.description}</p>
                      {issue.metadata && Object.keys(issue.metadata).length > 0 && (
                        <p className="mt-1 text-[10px] text-white/25">
                          {Object.entries(issue.metadata).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
