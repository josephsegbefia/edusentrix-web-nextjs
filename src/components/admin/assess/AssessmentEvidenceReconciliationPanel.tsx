"use client";

import * as React from "react";
import { AlertTriangle, Eye, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Input } from "@/components/ui/input";
import { glassInsetClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";

type EvidencePage = { id: string; packetId: string | null; observedPacketId: string; pageId: string; expectedPageNumber: number | null; status: string; reconciliationOutcome: string; integrityStatus: string; assetId: string | null; receipt: { status: string } | null };
type MissingPage = { packetId: string; pageId: string; pageNumber: number | null };
type EvidenceResponse = { summary: { expectedPages: number; receivedPages: number; acceptedPages: number; missingPages: number; warnings: number }; missing: MissingPage[]; pages: EvidencePage[] };
type EvidenceFilter = "all" | "attention" | "verified" | "missing";

function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function pageLabel(page: EvidencePage) { return page.expectedPageNumber == null ? page.pageId : "Page " + page.expectedPageNumber; }
function statusClass(page: EvidencePage) {
  if (page.status === "verified" && page.reconciliationOutcome === "valid") return "border-emerald-400/30 bg-emerald-400/10 text-(--ws-emerald)";
  if (page.status === "rejected" || page.integrityStatus === "rejected") return "border-rose-400/30 bg-rose-400/10 text-(--ws-rose)";
  return "border-amber-400/30 bg-amber-400/10 text-(--ws-amber)";
}

export function AssessmentEvidenceReconciliationPanel({ deliveryId }: { deliveryId: string }) {
  const [data, setData] = React.useState<EvidenceResponse | null>(null);
  const [filter, setFilter] = React.useState<EvidenceFilter>("all");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!deliveryId) { setData(null); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/admin/assess/evidence?assessmentDeliveryVersionId=" + encodeURIComponent(deliveryId), { cache: "no-store" });
      const json = await response.json().catch(() => null) as { success?: boolean; data?: EvidenceResponse; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Unable to load evidence reconciliation");
      setData(json.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load evidence reconciliation"); }
    finally { setLoading(false); }
  }, [deliveryId]);

  React.useEffect(() => { void load(); }, [load]);

  const normalizedSearch = search.trim().toLowerCase();
  const visiblePages = data?.pages.filter((page) => {
    const matchesSearch = !normalizedSearch || [page.observedPacketId, page.pageId, page.reconciliationOutcome, page.status, page.integrityStatus].some((value) => value.toLowerCase().includes(normalizedSearch));
    const matchesFilter = filter !== "missing" && (filter === "all" || (filter === "verified" && page.status === "verified" && page.reconciliationOutcome === "valid") || (filter === "attention" && !(page.status === "verified" && page.reconciliationOutcome === "valid")));
    return matchesSearch && matchesFilter;
  }) ?? [];
  const visibleMissing = data?.missing.filter((page) => {
    const matchesSearch = !normalizedSearch || [page.packetId, page.pageId, page.pageNumber == null ? "" : String(page.pageNumber)].some((value) => value.toLowerCase().includes(normalizedSearch));
    return matchesSearch && (filter === "all" || filter === "attention" || filter === "missing");
  }) ?? [];
  const filters: Array<{ id: EvidenceFilter; label: string; count: number }> = [
    { id: "all", label: "All evidence", count: (data?.pages.length ?? 0) + (data?.missing.length ?? 0) },
    { id: "attention", label: "Needs attention", count: (data?.summary.warnings ?? 0) + (data?.summary.missingPages ?? 0) },
    { id: "verified", label: "Verified", count: data?.summary.acceptedPages ?? 0 },
    { id: "missing", label: "Missing pages", count: data?.summary.missingPages ?? 0 },
  ];

  return (
    <GlassPanel className="mt-5 p-5" aria-busy={loading}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-(--ws-teal)" aria-hidden="true" /><h2 className="text-xl font-semibold text-(--ws-fg)">Review scans</h2></div><p className="mt-1 max-w-3xl text-sm leading-6 text-(--ws-fg-60)">Verify private captured pages before marking. A packet marker identifies a paper record; it is never proof of student identity.</p></div>
        <Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Refresh</Button>
      </div>
      {error ? <div role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-(--ws-rose)">{error}</div> : null}
      {!deliveryId ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}>Select a published delivery to inspect captured evidence.</div> : null}
      {loading && !data ? <div className="flex items-center gap-2 text-sm text-(--ws-fg-60)" role="status">Loading reconciliation…</div> : null}
      {data ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[["Expected", data.summary.expectedPages, "Pages expected from issued packet manifests"], ["Received", data.summary.receivedPages, "Pages verified or pending reconciliation"], ["Accepted", data.summary.acceptedPages, "Pages reconciled as the current valid page"], ["Missing", data.summary.missingPages, "Expected pages with no accepted evidence"], ["Warnings", data.summary.warnings, "Captured pages needing reconciliation or integrity review"]].map(([label, value, description]) => <div key={String(label)} className={glassInsetClass + " p-3"}><p className="text-xs text-(--ws-fg-50)">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-(--ws-fg)">{value}</p><p className="mt-1 text-[11px] leading-4 text-(--ws-fg-50)">{description}</p></div>)}
        </div>
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2"><Search className="h-4 w-4 shrink-0 text-(--ws-fg-50)" aria-hidden="true" /><label className="sr-only" htmlFor="evidence-search">Search evidence by packet, page or state</label><Input id="evidence-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search packet, page or reconciliation state" className="bg-(--ws-fill)" /></div>
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-(--ws-line) bg-(--ws-fill) p-1" role="group" aria-label="Evidence filter">
            {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className="min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-(--ws-fg-70) transition hover:bg-(--ws-fill-strong) hover:text-(--ws-fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan) aria-pressed:bg-(--ws-fill-strong) aria-pressed:text-(--ws-fg)">{item.label} <span className="ml-1 text-(--ws-fg-50)">{item.count}</span></button>)}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {visibleMissing.map((page) => <div key={"missing:" + page.packetId + ":" + page.pageId} className={glassInsetClass + " flex flex-col gap-2 border-amber-400/30 bg-amber-400/10 p-3 sm:flex-row sm:items-center sm:justify-between"}><div><p className="font-medium text-(--ws-fg)">Missing · {page.packetId} · {page.pageNumber == null ? page.pageId : "page " + page.pageNumber}</p><p className="mt-1 text-xs text-(--ws-amber)">No accepted evidence has been recorded for this expected page. It is not treated as an unanswered question.</p></div><Badge variant="outline" className="w-fit border-amber-400/30 text-(--ws-amber)">Missing expected page</Badge></div>)}
          {visiblePages.map((page) => <div key={page.id} className={glassInsetClass + " flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-(--ws-fg)">{page.observedPacketId} · {pageLabel(page)}</p><Badge variant="outline" className={statusClass(page)}>{page.status === "verified" && page.reconciliationOutcome === "valid" ? "Verified" : humanize(page.reconciliationOutcome)}</Badge></div><p className="mt-1 text-xs text-(--ws-fg-50)">{humanize(page.status)} · {humanize(page.integrityStatus)}{page.receipt ? " · receipt confirmed" : ""}</p></div><div className="flex flex-wrap items-center gap-2">{page.reconciliationOutcome !== "valid" ? <span className="inline-flex items-center gap-1 text-xs text-(--ws-amber)"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Needs reconciliation</span> : null}{page.assetId ? <Button asChild type="button" size="sm" variant="outline" className={glassSecondaryButtonClass}><a href={"/api/admin/assess/evidence/" + page.id + "/preview"} target="_blank" rel="noreferrer"><Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Private preview</a></Button> : null}</div></div>)}
          {!visibleMissing.length && !visiblePages.length ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}>{search || filter !== "all" ? "No evidence matches this view." : "No captured pages or missing-page records are available for this delivery."}</div> : null}
        </div>
      </> : null}
    </GlassPanel>
  );
}
