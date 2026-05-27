"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { glassPanelClass, glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type SubRow = {
  _id: string;
  schoolId: string;
  schoolName: string;
  tierCode: string | null;
  tierName: string | null;
  status: string;
  endsAt: string | null;
  pilotEndsAt: string | null;
  effectivePriceMinor: number;
  hasOverride: boolean;
  hasAccessOverride: boolean;
  updatedAt: string;
};

const STATUS_PILL: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  pilot: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  grace: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  restricted_read_only: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  suspended: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  past_due: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  draft: "border-white/10 bg-white/5 text-white/40",
  cancelled: "border-white/10 bg-white/5 text-white/40",
};

const PLAN_PILL: Record<string, string> = {
  pilot: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  starter: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  growth: "border-teal-500/30 bg-teal-500/10 text-teal-200",
  premium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

function formatGHS(minor: number) {
  return `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

export default function SchoolSubscriptionsListPage() {
  const [rows, setRows] = React.useState<SubRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const LIMIT = 25;

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [planFilter, setPlanFilter] = React.useState("");
  const [expiringSoon, setExpiringSoon] = React.useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const load = React.useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const url = new URL("/api/platform/subscriptions/schools", window.location.origin);
      url.searchParams.set("page", String(pg));
      url.searchParams.set("limit", String(LIMIT));
      if (debouncedSearch) url.searchParams.set("search", debouncedSearch);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      if (planFilter) url.searchParams.set("tierCode", planFilter);
      if (expiringSoon) url.searchParams.set("expiringSoon", "true");

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setRows(json.data);
        setTotal(json.pagination.total);
        setPages(json.pagination.pages);
        setPage(pg);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [debouncedSearch, statusFilter, planFilter, expiringSoon]);

  React.useEffect(() => { load(1); }, [load]);

  return (
    <div className="space-y-5 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/platform/subscriptions" className="mb-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
            <ChevronLeft className="h-3 w-3" /> Subscriptions
          </Link>
          <h1 className="text-xl font-semibold text-white">School subscriptions</h1>
          <p className="text-xs text-white/40">{total} record{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={() => load(page)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 transition hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className={cn(glassInsetClass, "flex flex-wrap items-center gap-2 px-4 py-3")}>
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school name…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white outline-none placeholder:text-white/25"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/60 outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pilot">Pilot</option>
          <option value="grace">Grace period</option>
          <option value="restricted_read_only">Read-only</option>
          <option value="suspended">Suspended</option>
          <option value="past_due">Past due</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/60 outline-none"
        >
          <option value="">All plans</option>
          <option value="pilot">Pilot</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="premium">Premium</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
          <input
            type="checkbox"
            checked={expiringSoon}
            onChange={(e) => setExpiringSoon(e.target.checked)}
            className="accent-teal-400"
          />
          Expiring ≤30 days
        </label>
      </div>

      {/* Table */}
      <div className={cn(glassPanelClass, "overflow-hidden px-0 py-0")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Building2 className="h-6 w-6 text-white/20" />
            <p className="text-xs text-white/30">No subscriptions match your filters.</p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="hidden border-b border-white/10 px-5 py-2.5 text-[10px] uppercase tracking-widest text-white/30 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
              <span>School</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Amount</span>
              <span>Renewal / expiry</span>
              <span />
            </div>

            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div
                  key={r._id}
                  className="grid items-center gap-3 px-5 py-3 text-xs sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white/80">{r.schoolName}</p>
                    <p className="text-[10px] text-white/30">{r.schoolId.slice(-6)}</p>
                  </div>
                  <span className={cn(
                    "inline-flex w-fit items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    PLAN_PILL[r.tierCode ?? ""] ?? "border-white/10 bg-white/5 text-white/40"
                  )}>
                    {r.tierCode ?? "—"}
                  </span>
                  <span className={cn(
                    "inline-flex w-fit items-center rounded-full border px-1.5 py-0.5 text-[10px]",
                    STATUS_PILL[r.status] ?? "border-white/10 bg-white/5 text-white/40"
                  )}>
                    {r.status.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-xs text-white/60">
                    {formatGHS(r.effectivePriceMinor)}
                    {r.hasOverride && <span className="ml-1 text-[9px] text-amber-300/70">override</span>}
                  </span>
                  <span className="text-[11px] text-white/40">
                    {r.status === "pilot" && r.pilotEndsAt
                      ? new Date(r.pilotEndsAt).toLocaleDateString("en-GH", { dateStyle: "medium" })
                      : r.endsAt
                        ? new Date(r.endsAt).toLocaleDateString("en-GH", { dateStyle: "medium" })
                        : "—"}
                  </span>
                  <Link
                    href={`/platform/schools/${r.schoolId}/subscription`}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/50 transition hover:text-white"
                  >
                    Manage <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{total} total</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 transition hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs text-white/40">
              {page} / {pages}
            </span>
            <button
              type="button"
              onClick={() => load(page + 1)}
              disabled={page >= pages || loading}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 transition hover:text-white disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
