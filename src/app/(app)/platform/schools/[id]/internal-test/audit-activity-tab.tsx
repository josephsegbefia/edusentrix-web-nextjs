"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { InternalTestLeoHint } from "@/components/internal-test/InternalTestLeoHint";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditRow = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; email?: string; name?: string } | null;
};

export function InternalTestAuditActivityTab({ schoolId }: { schoolId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(25);
  const [items, setItems] = React.useState<AuditRow[]>([]);
  const [totalPages, setTotalPages] = React.useState(1);

  const load = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      const res = await fetch(
        `/api/platform/schools/${schoolId}/internal-test/audit-events?${qs}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load activity");
      }
      setItems((json.data?.items as AuditRow[]) ?? []);
      setTotalPages(json.data?.pagination?.totalPages ?? 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId, page, limit]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <InternalTestLeoHint>
        <p className="font-medium text-violet-100">Leo — Activity tab</p>
        <ul className="list-inside list-disc space-y-1 text-xs text-white/75 md:text-sm">
          <li>
            Each row is a <strong className="text-white/90">platform audit</strong> line scoped to this
            school whose <code className="rounded bg-black/35 px-1 text-[11px]">action</code> starts with{" "}
            <code className="rounded bg-black/35 px-1 text-[11px]">internal_test.</code> (enable, config,
            generation, reset, impersonation, etc.).
          </li>
          <li>
            <strong className="text-white/90">Refresh</strong> — reloads page 1; use after you run actions or
            impersonation elsewhere.
          </li>
          <li>
            <strong className="text-white/90">Pagination</strong> — newest events first; arrows move pages
            when there are more than {limit} rows.
          </li>
          <li>
            <strong className="text-white/90">Details JSON</strong> — raw metadata for support; actor is the
            platform user who triggered the action when available.
          </li>
        </ul>
      </InternalTestLeoHint>
      <p className="text-sm text-white/60">
        Recent internal-test audit lines for this school (actions starting with{" "}
        <code className="rounded bg-black/35 px-1 py-0.5 text-xs">internal_test.</code>
        ).
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/15 bg-black/30 text-white hover:bg-white/10"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScrollText className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white/75 hover:bg-white/10 hover:text-white"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            Page {page}
            {totalPages > 1 ? ` / ${totalPages}` : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white/75 hover:bg-white/10 hover:text-white"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-6 text-sm text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity…
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/20 p-6 text-sm text-white/55">
          No internal-test audit events recorded for this school yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/75">When</TableHead>
                <TableHead className="text-white/75">Action</TableHead>
                <TableHead className="text-white/75">Actor</TableHead>
                <TableHead className="min-w-[200px] text-white/75">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id} className="border-white/10 align-top">
                  <TableCell className="whitespace-nowrap text-xs text-white/65">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-cyan-100/90">{row.action}</TableCell>
                  <TableCell className="max-w-[180px] text-xs text-white/70">
                    {row.actor?.name || row.actor?.email || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-white/55">
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/35 p-2 font-mono text-[11px] leading-relaxed">
                      {JSON.stringify(
                        {
                          entityType: row.entityType,
                          entityId: row.entityId,
                          metadata: row.metadata,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
