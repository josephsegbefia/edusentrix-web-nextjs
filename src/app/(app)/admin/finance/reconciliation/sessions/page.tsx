"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  HelpCircle,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useReconciliationSessions,
  useReopenReconciliationSession,
  type SessionStatus,
  type ReconciliationSessionItem,
} from "@/hooks/admin/useReconciliationSessions";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Textarea } from "@/components/ui/textarea";
import { useDailyReconciliation } from "@/hooks/admin/useDailyReconciliation";
import { useReconciliationRuns } from "@/hooks/admin/useReconciliation";
import { ReconciliationHelpDrawer } from "@/components/admin/fees/reconciliation/ReconciliationHelpDrawer";

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusBadge(status: SessionStatus) {
  const map: Record<SessionStatus, { label: string; class: string }> = {
    preparing: { label: "Preparing", class: "border-sky-500/25 bg-sky-500/10 text-sky-300" },
    in_progress: { label: "In Progress", class: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
    review: { label: "Review", class: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300" },
    locked: { label: "Locked", class: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
    reopened: { label: "Reopened", class: "border-orange-500/25 bg-orange-500/10 text-orange-300" },
  };
  const s = map[status] || { label: status, class: "border-white/10 bg-white/5 text-white/50" };
  return <Badge variant="outline" className={`text-[10px] ${s.class}`}>{s.label}</Badge>;
}

function statusIcon(status: SessionStatus) {
  if (status === "locked") return <Lock className="h-5 w-5 text-emerald-400" />;
  if (status === "reopened") return <LockOpen className="h-5 w-5 text-orange-400" />;
  if (status === "review") return <Shield className="h-5 w-5 text-indigo-400" />;
  if (status === "in_progress") return <RefreshCw className="h-5 w-5 text-amber-400" />;
  return <Clock className="h-5 w-5 text-sky-400" />;
}

function userName(user: ReconciliationSessionItem["createdBy"]) {
  if (!user) return "—";
  if (typeof user === "string") return user.slice(0, 8) + "…";
  return user.name || user.email || user.id.slice(0, 8) + "…";
}

export default function ReconciliationSessionsPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | SessionStatus>("all");
  const [page, setPage] = React.useState(1);

  const [reopenTarget, setReopenTarget] = React.useState<ReconciliationSessionItem | null>(null);
  const [reopenReason, setReopenReason] = React.useState("");
  const [helpOpen, setHelpOpen] = React.useState(false);
  const reopenSession = useReopenReconciliationSession();
  const runReconciliation = useDailyReconciliation();
  const runsQuery = useReconciliationRuns(8, true);

  const sessionsQuery = useReconciliationSessions({
    status: statusFilter === "all" ? undefined : statusFilter,
    q: search || undefined,
    page,
    limit: 20,
  });

  const sessions = sessionsQuery.data?.sessions || [];
  const pagination = sessionsQuery.data?.pagination;

  async function handleReopen() {
    if (!reopenTarget || !reopenReason.trim()) {
      toast.error("Please provide a reason for reopening.");
      return;
    }
    try {
      await reopenSession.mutateAsync({ id: reopenTarget.id, reason: reopenReason });
      toast.success("Session reopened.");
      setReopenTarget(null);
      setReopenReason("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to reopen session.");
    }
  }

  async function handleRunReconciliation() {
    try {
      const result = await runReconciliation.mutateAsync({ mode: "manual" });
      toast.success(
        `Reconciliation run complete — ${result.updated} payment(s) updated, ${result.summary?.matched ?? 0} ingestion row(s) matched.`
      );
      void runsQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Run failed.");
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-600/20">
            <Shield className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Reconciliation Sessions</h1>
            <p className="mt-1 text-sm text-white/50">View all reconciliation sessions, filter by status, and manage locks.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => router.push("/admin/finance/reconciliation/sessions/new")}
            className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
          >
            <Plus className="mr-2 h-4 w-4" /> New Session
          </Button>
        </div>
      </div>

      {/* Tools previously on the standalone reconciliation page: export, help, run, recent runs */}
      <Card className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader className="border-b border-white/5 pb-3">
          <CardTitle className="text-sm font-semibold text-white">Reconciliation tools</CardTitle>
          <p className="text-xs text-white/45">
            Export audit CSV, run deterministic matching across the school, or review how matching works. Open a session to work the full guided flow.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              asChild
            >
              <a href="/api/admin/fees/reconciliation/export?format=csv" download target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="mr-1.5 h-3.5 w-3.5" /> Help
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={runReconciliation.isPending}
              onClick={() => void handleRunReconciliation()}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              {runReconciliation.isPending ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Run reconciliation
            </Button>
          </div>
          <div className="min-w-0 flex-1 sm:max-w-md">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
              <TrendingUp className="h-3 w-3" /> Recent runs
            </p>
            {runsQuery.isLoading ? (
              <Skeleton className="h-8 w-full rounded-lg" />
            ) : (runsQuery.data || []).length === 0 ? (
              <p className="text-xs text-white/35">No runs yet.</p>
            ) : (
              <div className="space-y-1 text-xs text-white/55">
                {(runsQuery.data || []).slice(0, 3).map((run) => (
                  <div key={run.id} className="flex justify-between gap-2">
                    <span className="truncate">{formatDateTime(run.startedAt)}</span>
                    <span className="shrink-0 text-emerald-300/90">{run.summary?.matched ?? 0} matched</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search sessions…"
                className="h-9 border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-white/30"
              />
            </div>
            <PremiumSelect value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
              <PremiumSelectTrigger className="h-9 w-[150px]">
                <PremiumSelectValue placeholder="Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                <PremiumSelectItem value="preparing">Preparing</PremiumSelectItem>
                <PremiumSelectItem value="in_progress">In Progress</PremiumSelectItem>
                <PremiumSelectItem value="review">Review</PremiumSelectItem>
                <PremiumSelectItem value="locked">Locked</PremiumSelectItem>
                <PremiumSelectItem value="reopened">Reopened</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void sessionsQuery.refetch()}
              className="h-9 w-9 border-white/10 bg-white/5 hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${sessionsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions list */}
      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-base font-semibold text-white">
            {pagination ? `${pagination.total} session(s)` : "Sessions"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessionsQuery.isLoading ? (
            <div className="divide-y divide-white/5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center">
              <Shield className="mx-auto h-10 w-10 text-white/15" />
              <p className="mt-3 text-sm text-white/40">No sessions found</p>
              <p className="mt-1 text-xs text-white/25">Create a new reconciliation session to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
                    {statusIcon(session.status)}
                  </div>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => router.push(`/admin/finance/reconciliation/sessions/${session.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">{session.label}</p>
                      {statusBadge(session.status)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                      <span>{formatDateTime(session.createdAt)}</span>
                      <span>by {userName(session.createdBy)}</span>
                      <span>{session.sourceTypes.join(", ")}</span>
                    </div>
                  </button>
                  <div className="hidden gap-3 text-right text-xs text-white/50 sm:flex">
                    <div>
                      <p className="font-semibold text-emerald-300">{session.summary.matched}</p>
                      <p>matched</p>
                    </div>
                    <div>
                      <p className="font-semibold text-amber-300">{session.summary.ambiguous}</p>
                      <p>ambiguous</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {session.status === "locked" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); setReopenTarget(session); }}
                        className="h-8 border-white/10 text-xs text-white/60 hover:bg-white/10"
                      >
                        <LockOpen className="mr-1 h-3 w-3" /> Reopen
                      </Button>
                    )}
                    {session.reportVerificationId && (
                      <a
                        href={`/verify/report/${session.reportVerificationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 className="mr-1 inline h-3 w-3" /> Verified
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
              <p className="text-xs text-white/40">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10" disabled={pagination.page >= pagination.pages} onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reopen modal */}
      <ResponsiveModal
        open={Boolean(reopenTarget)}
        onOpenChange={(open) => { if (!open) { setReopenTarget(null); setReopenReason(""); } }}
        title="Reopen Locked Session"
        description={`Reopen "${reopenTarget?.label || ""}" — this action is audited and requires a reason.`}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
            Only school administrators can reopen locked sessions. This will be recorded in the audit trail.
          </div>
          <Textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Reason for reopening (required)…"
            className="min-h-[80px] border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30"
            maxLength={500}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setReopenTarget(null); setReopenReason(""); }} className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => void handleReopen()}
              disabled={reopenSession.isPending || !reopenReason.trim()}
              className="bg-orange-500/80 text-white hover:bg-orange-500"
            >
              {reopenSession.isPending ? "Reopening…" : "Reopen Session"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ReconciliationHelpDrawer open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
