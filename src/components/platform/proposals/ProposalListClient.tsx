"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, FileText, MoreHorizontal, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { PlatformPill, formatDate } from "@/components/platform/platform-page-primitives";
import { ProposalStatusBadge } from "@/components/platform/proposals/ProposalStatusBadge";
import type { PlatformProposal } from "@/components/platform/proposals/types";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

type ResponseShape = {
  data: {
    proposals: PlatformProposal[];
    pagination: { page: number; totalPages: number; total: number };
  };
};

export function ProposalListClient() {
  const [proposals, setProposals] = React.useState<PlatformProposal[]>([]);
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const deferredQuery = React.useDeferredValue(query);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        status,
      });
      if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
      const res = await fetch(`/api/platform/proposals?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ResponseShape | null;
      if (!res.ok || !json) throw new Error("Failed to load proposals");
      setProposals(json.data.proposals);
      setPagination(json.data.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, [deferredQuery, page, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function deleteProposal(proposal: PlatformProposal) {
    const decision = await confirm({
      title: "Delete proposal?",
      description:
        proposal.status === "draft"
          ? `This will remove "${proposal.title}" from the active proposal list. You can still find it under Archived.`
          : `This will archive "${proposal.title}" and remove it from the active proposal list while keeping history and send logs intact.`,
      confirmLabel: "Delete proposal",
      cancelLabel: "Keep proposal",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    setDeletingId(proposal.id);
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to delete proposal");
      toast.success("Proposal deleted");
      setProposals((current) => current.filter((item) => item.id !== proposal.id));
      setPagination((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      if (proposals.length === 1 && page > 1) {
        setPage((value) => Math.max(1, value - 1));
      } else {
        void load();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete proposal");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by school, recipient, or title"
            className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
          />
        </div>
        <PremiumSelect
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <PremiumSelectTrigger>
            <PremiumSelectValue />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
            <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
            <PremiumSelectItem value="ready">Ready</PremiumSelectItem>
            <PremiumSelectItem value="sent">Sent</PremiumSelectItem>
            <PremiumSelectItem value="followed_up">Followed up</PremiumSelectItem>
            <PremiumSelectItem value="demo_scheduled">Demo scheduled</PremiumSelectItem>
            <PremiumSelectItem value="pilot_started">Pilot started</PremiumSelectItem>
            <PremiumSelectItem value="accepted">Accepted</PremiumSelectItem>
            <PremiumSelectItem value="rejected">Rejected</PremiumSelectItem>
            <PremiumSelectItem value="archived">Archived</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
        <Button variant="outline" onClick={load} className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white">
          <FileText className="mx-auto h-10 w-10 text-white/35" />
          <h2 className="mt-4 text-lg font-semibold">No proposals yet</h2>
          <p className="mt-1 text-sm text-white/55">Create your first branded EduSentrix proposal for a school.</p>
          <Button asChild className="mt-5 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
            <Link href="/platform/proposals/new">
              <Plus className="h-4 w-4" />
              New proposal
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <div className="grid grid-cols-[minmax(240px,1.4fr)_180px_150px_150px_140px_56px] gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            <span>School</span>
            <span>Recipient</span>
            <span>Status</span>
            <span>Follow-up</span>
            <span>PDF</span>
            <span className="text-right">Actions</span>
          </div>
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="grid grid-cols-[minmax(240px,1.4fr)_180px_150px_150px_140px_56px] gap-3 border-b border-white/6 px-4 py-4 text-sm text-white/70 transition last:border-b-0 hover:bg-white/5"
            >
              <Link href={`/platform/proposals/${proposal.id}`} className="min-w-0">
                <span className="block font-semibold text-white">{proposal.schoolName}</span>
                <span className="text-xs text-white/45">{proposal.proposalType.replace(/_/g, " ")}</span>
              </Link>
              <span>
                <span className="block truncate">{proposal.recipientName || "No recipient"}</span>
                <span className="text-xs text-white/45">{proposal.recipientEmail || "No email"}</span>
              </span>
              <span>
                <ProposalStatusBadge status={proposal.status} />
              </span>
              <span>{formatDate(proposal.nextFollowUpDate)}</span>
              <span>
                {proposal.hasPdf ? (
                  <PlatformPill tone={proposal.pdfIsStale ? "amber" : "emerald"}>
                    {proposal.pdfIsStale ? "stale" : "ready"}
                  </PlatformPill>
                ) : (
                  <PlatformPill>not generated</PlatformPill>
                )}
              </span>
              <span className="flex justify-end">
                <PremiumDropdownMenu>
                  <PremiumDropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={deletingId === proposal.id}
                      className="h-8 w-8 cursor-pointer rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      {deletingId === proposal.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </PremiumDropdownMenuTrigger>
                  <PremiumDropdownMenuContent align="end">
                    <PremiumDropdownMenuItem asChild>
                      <Link href={`/platform/proposals/${proposal.id}`} className="flex items-center gap-2">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open proposal
                      </Link>
                    </PremiumDropdownMenuItem>
                    <PremiumDropdownMenuSeparator />
                    <PremiumDropdownMenuItem
                      variant="destructive"
                      onClick={() => void deleteProposal(proposal)}
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Delete proposal
                    </PremiumDropdownMenuItem>
                  </PremiumDropdownMenuContent>
                </PremiumDropdownMenu>
              </span>
            </div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-white/55">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} proposals
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="border-white/10 bg-white/5 text-white/70">
              Previous
            </Button>
            <Button variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="border-white/10 bg-white/5 text-white/70">
              Next
            </Button>
          </div>
        </div>
      ) : null}
      {confirmationDialog}
    </div>
  );
}
