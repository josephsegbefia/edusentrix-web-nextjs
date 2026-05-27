"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Loader2,
  RefreshCw,
  Search,
  Tv,
  Users,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { glassPanelClass, glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type MetricSummary = {
  used: number;
  total: number;
  remaining: number;
  pctUsed: number;
};

type SchoolUsageRow = {
  schoolId: string;
  schoolName: string;
  metrics: Array<{ metricKey: string; used: number; total: number; remaining: number; pctUsed: number; purchased: number; planAllocation: number }>;
};

type PlatformTotals = Record<string, { used: number; total: number }>;

const METRIC_META: Record<string, { label: string; unit: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  leoCreditsPerTerm: { label: "Leo AI credits", unit: "credits", icon: Zap, tone: "text-teal-300" },
  meetingParticipantMinutesPerTerm: { label: "Meeting minutes", unit: "min", icon: Tv, tone: "text-cyan-300" },
  storageBytes: { label: "Storage", unit: "MB", icon: HardDrive, tone: "text-violet-300" },
  learnSeats: { label: "Learn seats", unit: "seats", icon: Users, tone: "text-emerald-300" },
};

function usageBar(pct: number) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = pct >= 90 ? "bg-rose-400" : pct >= 70 ? "bg-amber-400" : "bg-teal-400";
  return { pct: clamped, color };
}

function fmtValue(key: string, val: number) {
  if (key === "storageBytes") return `${Math.round(val / (1024 * 1024)).toLocaleString()} MB`;
  return val.toLocaleString();
}

export default function UsageDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<SchoolUsageRow[]>([]);
  const [platformTotals, setPlatformTotals] = React.useState<PlatformTotals>({});
  const [search, setSearch] = React.useState("");
  const [lowOnly, setLowOnly] = React.useState(false);
  const [metricFilter, setMetricFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const load = React.useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const url = new URL("/api/platform/subscriptions/usage", window.location.origin);
      url.searchParams.set("page", String(pg));
      if (search) url.searchParams.set("search", search);
      if (lowOnly) url.searchParams.set("lowOnly", "true");
      if (metricFilter) url.searchParams.set("metricKey", metricFilter);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setRows(json.data);
        setPlatformTotals(json.platformTotals);
        setPage(pg);
        setTotal(json.pagination.total);
        setPages(json.pagination.pages);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, lowOnly, metricFilter]);

  React.useEffect(() => { load(1); }, [load]);

  const knownMetricKeys = React.useMemo(() => Object.keys(platformTotals), [platformTotals]);

  return (
    <div className="space-y-5 p-2 md:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/platform/subscriptions" className="mb-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
            <ChevronLeft className="h-3 w-3" /> Subscriptions
          </Link>
          <h1 className="text-xl font-semibold text-white">Usage dashboard</h1>
          <p className="text-xs text-white/40">AI credits, meeting minutes, storage, and Learn seats across all schools.</p>
        </div>
        <button type="button" onClick={() => load(page)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/40 hover:text-white">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Platform-level totals */}
      {Object.keys(platformTotals).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(platformTotals).map(([key, { used, total: tot }]) => {
            const meta = METRIC_META[key];
            const Icon = meta?.icon ?? Zap;
            const pctUsed = tot > 0 ? Math.round((used / tot) * 100) : 0;
            const bar = usageBar(pctUsed);
            return (
              <div key={key} className={cn(glassPanelClass, "px-4 py-4")}>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn("h-4 w-4", meta?.tone ?? "text-white/40")} />
                  <span className="text-xs text-white/50">{meta?.label ?? key}</span>
                </div>
                <p className="font-mono text-xl font-bold text-white">{fmtValue(key, used)}</p>
                <p className="text-[10px] text-white/30">used / {fmtValue(key, tot)} total</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className={cn("h-full rounded-full transition-all", bar.color)} style={{ width: `${bar.pct}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-white/30">{pctUsed}% consumed</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className={cn(glassInsetClass, "flex flex-wrap items-center gap-2 px-4 py-3")}>
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white outline-none placeholder:text-white/25" />
        </div>
        <select value={metricFilter} onChange={(e) => setMetricFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/60 outline-none">
          <option value="">All metrics</option>
          {knownMetricKeys.map((k) => (
            <option key={k} value={k}>{METRIC_META[k]?.label ?? k}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="accent-rose-400" />
          <AlertTriangle className="h-3 w-3 text-amber-300/70" /> Low balance only
        </label>
      </div>

      {/* Per-school rows */}
      <div className={cn(glassPanelClass, "overflow-hidden px-0 py-0")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-xs text-white/30">No usage data found.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((r) => (
              <div key={r.schoolId} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/platform/schools/${r.schoolId}`} className="text-sm font-medium text-white/70 hover:text-white">
                    {r.schoolName}
                  </Link>
                  <Link href={`/platform/schools/${r.schoolId}/subscription`}
                    className="text-[11px] text-teal-400/50 hover:text-teal-300">
                    manage →
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {r.metrics.map((m) => {
                    const meta = METRIC_META[m.metricKey];
                    const Icon = meta?.icon ?? Zap;
                    const bar = usageBar(m.pctUsed);
                    return (
                      <div key={m.metricKey} className={cn(glassInsetClass, "px-3 py-2")}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <Icon className={cn("h-3 w-3", meta?.tone ?? "text-white/40")} />
                            <span className="text-[10px] text-white/40">{meta?.label ?? m.metricKey}</span>
                          </div>
                          {m.pctUsed >= 90 && <AlertTriangle className="h-3 w-3 text-rose-300" />}
                        </div>
                        <p className="text-xs text-white/60">
                          {fmtValue(m.metricKey, m.used)} / {fmtValue(m.metricKey, m.total)}
                        </p>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                          <div className={cn("h-full rounded-full", bar.color)} style={{ width: `${bar.pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{total} schools</p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => load(page - 1)} disabled={page <= 1 || loading}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 hover:text-white disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs text-white/40">{page} / {pages}</span>
            <button type="button" onClick={() => load(page + 1)} disabled={page >= pages || loading}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 hover:text-white disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
