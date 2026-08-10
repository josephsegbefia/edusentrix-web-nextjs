"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
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

type InvoiceRow = {
  _id: string;
  invoiceNumber: string;
  schoolId: string;
  schoolName: string;
  status: string;
  totalMinor: number;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
};

const STATUS_PILL: Record<string, string> = {
  draft: "border-white/10 bg-white/5 text-white/30",
  issued: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  overdue: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  forgiven: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  cancelled: "border-white/10 bg-white/5 text-white/40",
};

function formatGHS(minor: number) {
  return `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

export default function InvoicesPage() {
  const [rows, setRows] = React.useState<InvoiceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [schoolSearch, setSchoolSearch] = React.useState("");

  const load = React.useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const url = new URL("/api/platform/subscriptions/invoices", window.location.origin);
      url.searchParams.set("page", String(pg));
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        const filtered = schoolSearch
          ? json.data.filter((r: InvoiceRow) => r.schoolName.toLowerCase().includes(schoolSearch.toLowerCase()))
          : json.data;
        setRows(filtered);
        setPage(pg);
        setTotal(json.pagination.total);
        setPages(json.pagination.pages);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [statusFilter, schoolSearch]);

  React.useEffect(() => { load(1); }, [load]);

  async function onMarkPaid(id: string) {
    const ref = prompt("Payment reference (e.g. bank transfer ID):");
    if (ref === null) return;
    const res = await fetch(`/api/platform/subscriptions/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", paidReference: ref || null }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Marked as paid."); load(page); }
    else toast.error("Failed.");
  }

  return (
    <div className="space-y-5 p-2 md:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/platform/subscriptions" className="mb-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
            <ChevronLeft className="h-3 w-3" /> Subscriptions
          </Link>
          <h1 className="text-xl font-semibold text-white">Subscription invoices</h1>
          <p className="text-xs text-white/40">{total} invoice{total !== 1 ? "s" : ""}</p>
        </div>
        <button type="button" onClick={() => load(page)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/40 hover:text-white">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filters */}
      <div className={cn(glassInsetClass, "flex flex-wrap items-center gap-2 px-4 py-3")}>
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input type="text" value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)}
            placeholder="Search school…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white outline-none placeholder:text-white/25" />
        </div>
        <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
          <PremiumSelectTrigger className="h-8 w-[150px] rounded-lg border-white/10 bg-white/5 text-xs text-white/60">
            <PremiumSelectValue placeholder="All statuses" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
            <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
            <PremiumSelectItem value="issued">Issued</PremiumSelectItem>
            <PremiumSelectItem value="paid">Paid</PremiumSelectItem>
            <PremiumSelectItem value="overdue">Overdue</PremiumSelectItem>
            <PremiumSelectItem value="forgiven">Forgiven</PremiumSelectItem>
            <PremiumSelectItem value="cancelled">Cancelled</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      {/* Table */}
      <div className={cn(glassPanelClass, "overflow-hidden px-0 py-0")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <FileText className="h-5 w-5 text-white/20" />
            <p className="text-xs text-white/30">No invoices found.</p>
          </div>
        ) : (
          <>
            <div className="hidden border-b border-white/10 px-5 py-2.5 text-[10px] uppercase tracking-widest text-white/30 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
              <span>School</span>
              <span>Invoice #</span>
              <span>Status</span>
              <span>Total</span>
              <span>Due date</span>
              <span />
            </div>
            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r._id} className="grid items-center gap-3 px-5 py-3 text-xs sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
                  <div className="min-w-0">
                    <Link href={`/platform/schools/${r.schoolId}/subscription`}
                      className="truncate text-xs font-medium text-white/70 hover:text-white">
                      {r.schoolName}
                    </Link>
                  </div>
                  <span className="font-mono text-[11px] text-white/50">{r.invoiceNumber}</span>
                  <span className={cn("inline-flex w-fit items-center rounded-full border px-1.5 py-0.5 text-[10px]", STATUS_PILL[r.status] ?? "")}>
                    {r.status}
                  </span>
                  <span className="font-mono text-xs text-white/60">{formatGHS(r.totalMinor)}</span>
                  <span className="text-[11px] text-white/40">
                    {r.dueAt ? new Date(r.dueAt).toLocaleDateString("en-GH", { dateStyle: "medium" }) : "—"}
                  </span>
                  <div className="flex items-center gap-1">
                    {(r.status === "issued" || r.status === "overdue") && (
                      <button type="button" onClick={() => onMarkPaid(r._id)}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20">
                        Mark paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{total} total</p>
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
