"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  HelpCircle,
  Link2,
  Link2Off,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useDailyReconciliation } from "@/hooks/admin/useDailyReconciliation";
import {
  useMatchReconciliationItem,
  useReconciliationAlerts,
  useReconciliationIngestions,
  useReconciliationRuns,
  useUnmatchReconciliationItem,
  type ReconciliationSourceType,
  type ReconciliationStatus,
} from "@/hooks/admin/useReconciliation";
import { ReconciliationIngestionModal } from "@/components/admin/fees/reconciliation/ReconciliationIngestionModal";
import { ReconciliationHelpDrawer } from "@/components/admin/fees/reconciliation/ReconciliationHelpDrawer";
import { formatCurrency } from "@/lib/fees/money";

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

function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatusIcon({ status }: { status: ReconciliationStatus }) {
  if (status === "matched") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "ambiguous") return <HelpCircle className="h-4 w-4 text-amber-400" />;
  if (status === "ignored") return <XCircle className="h-4 w-4 text-white/40" />;
  return <Clock className="h-4 w-4 text-rose-400" />;
}

function statusLabel(status: ReconciliationStatus) {
  const map: Record<string, string> = {
    matched: "Matched",
    ambiguous: "Needs review",
    ignored: "Ignored",
    unmatched: "Unmatched",
  };
  return map[status] || status;
}

function statusBadgeClass(status: ReconciliationStatus) {
  if (status === "matched") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "ambiguous") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  if (status === "ignored") return "border-white/10 bg-white/5 text-white/50";
  return "border-rose-500/25 bg-rose-500/10 text-rose-300";
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    gateway: "Paystack",
    bank: "Bank / MoMo",
    manual: "Manual",
  };
  return map[source] || source;
}

function confidenceBar(confidence: number) {
  const color =
    confidence >= 90
      ? "bg-emerald-500"
      : confidence >= 70
      ? "bg-amber-500"
      : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, confidence)}%` }}
        />
      </div>
      <span className="text-[11px] text-white/50">{confidence}%</span>
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  color = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  color?: "default" | "green" | "red" | "amber" | "blue";
}) {
  const colorStyles: Record<string, string> = {
    default: "from-slate-900/60 via-slate-950/60 to-black/60",
    green: "from-emerald-900/20 via-emerald-950/20 to-black/60",
    red: "from-red-900/20 via-red-950/20 to-black/60",
    amber: "from-amber-900/20 via-amber-950/20 to-black/60",
    blue: "from-blue-900/20 via-blue-950/20 to-black/60",
  };
  const iconColorStyles: Record<string, string> = {
    default: "text-white/40",
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
  };

  if (loading) {
    return (
      <Card className={`overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br ${colorStyles.default}`}>
        <CardContent className="p-5">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="mb-2 h-8 w-20" />
          <Skeleton className="h-3 w-28" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br ${colorStyles[color]} shadow-lg transition-all duration-300 hover:border-white/20`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/50">{title}</p>
          <div className="rounded-lg bg-white/5 p-2">
            <Icon className={`h-4 w-4 ${iconColorStyles[color]}`} />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-white/40">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

type ActiveTab = "queue" | "alerts" | "history";

export default function ReconciliationConsolePage() {
  const [search, setSearch] = React.useState("");
  const [sourceType, setSourceType] = React.useState<"all" | ReconciliationSourceType>("all");
  const [status, setStatus] = React.useState<"all" | ReconciliationStatus>("all");
  const [page, setPage] = React.useState(1);
  const [runNotes, setRunNotes] = React.useState("");
  const [ingestionModalOpen, setIngestionModalOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("queue");
  const [expandedItem, setExpandedItem] = React.useState<string | null>(null);
  const [manualPaymentIdByIngestion, setManualPaymentIdByIngestion] = React.useState<
    Record<string, string>
  >({});

  const ingestionQuery = useReconciliationIngestions({
    sourceType: sourceType === "all" ? undefined : sourceType,
    status: status === "all" ? undefined : status,
    q: search || undefined,
    page,
    limit: 20,
  });
  const alertsQuery = useReconciliationAlerts(true, true);
  const runsQuery = useReconciliationRuns(8, true);

  const runReconciliation = useDailyReconciliation();
  const matchItem = useMatchReconciliationItem();
  const unmatchItem = useUnmatchReconciliationItem();

  const summary = ingestionQuery.data?.summary || {
    unmatched: 0,
    matched: 0,
    ambiguous: 0,
    ignored: 0,
  };
  const pagination = ingestionQuery.data?.pagination;
  const items = ingestionQuery.data?.items || [];
  const activeAlerts = alertsQuery.data?.active || [];
  const recentRuns = runsQuery.data || [];
  const isLoading = ingestionQuery.isLoading;

  const totalIngested = summary.unmatched + summary.matched + summary.ambiguous + summary.ignored;
  const matchRate = totalIngested > 0 ? Math.round((summary.matched / totalIngested) * 100) : 0;

  async function handleRunNow() {
    try {
      const result = await runReconciliation.mutateAsync({
        mode: "manual",
        notes: runNotes || undefined,
      });
      toast.success(
        `Reconciliation complete — ${result.updated} payment(s) updated, ${
          result.summary?.matched || 0
        } row(s) matched.`
      );
      setRunNotes("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to run reconciliation.");
    }
  }

  async function handleMatch(ingestionId: string) {
    const paymentId = manualPaymentIdByIngestion[ingestionId]?.trim();
    if (!paymentId) {
      toast.error("Enter a payment ID to match.");
      return;
    }
    try {
      await matchItem.mutateAsync({ ingestionId, paymentId });
      toast.success("Item matched successfully.");
      setExpandedItem(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to match.");
    }
  }

  async function handleUnmatch(ingestionId: string) {
    try {
      await unmatchItem.mutateAsync({ ingestionId });
      toast.success("Match removed.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to unmatch.");
    }
  }

  const tabs: { key: ActiveTab; label: string; count?: number }[] = [
    { key: "queue", label: "Ingestion Queue", count: pagination?.total || 0 },
    { key: "alerts", label: "Alerts", count: activeAlerts.length },
    { key: "history", label: "Run History" },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-600/20">
            <Shield className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Reconciliation</h1>
            <p className="mt-1 text-sm text-white/50">
              Match payments against gateway and bank evidence
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Help
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => setIngestionModalOpen(true)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Import Data
          </Button>
          <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" asChild>
            <a href="/api/admin/fees/reconciliation/export?format=csv" download="reconciliation-report.csv" target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Export
            </a>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              void ingestionQuery.refetch();
              void alertsQuery.refetch();
              void runsQuery.refetch();
            }}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => void handleRunNow()}
            disabled={runReconciliation.isPending}
            className="group bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
          >
            {runReconciliation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" />
                Run Reconciliation
              </>
            )}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Unmatched"
          value={summary.unmatched}
          subtitle="Awaiting match"
          icon={Clock}
          loading={isLoading}
          color="red"
        />
        <KPICard
          title="Needs Review"
          value={summary.ambiguous}
          subtitle="Multiple candidates found"
          icon={AlertTriangle}
          loading={isLoading}
          color="amber"
        />
        <KPICard
          title="Matched"
          value={summary.matched}
          subtitle={`${matchRate}% match rate`}
          icon={CheckCircle2}
          loading={isLoading}
          color="green"
        />
        <KPICard
          title="Active Alerts"
          value={alertsQuery.data?.snapshot?.activeAlerts || activeAlerts.length || 0}
          subtitle={recentRuns[0]?.startedAt ? `Last run ${formatShortDate(recentRuns[0].startedAt)}` : "No run yet"}
          icon={AlertTriangle}
          loading={alertsQuery.isLoading}
          color="blue"
        />
      </div>

      {/* Alert Banner */}
      {activeAlerts.some((a) => a.severity === "critical") && (
        <Card className="mb-6 overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-rose-300">
                {activeAlerts.filter((a) => a.severity === "critical").length} critical alert(s) require attention
              </p>
              <p className="mt-0.5 text-xs text-rose-300/70">
                {activeAlerts.find((a) => a.severity === "critical")?.description}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-rose-500/20 text-rose-300 hover:bg-rose-500/10"
              onClick={() => setActiveTab("alerts")}
            >
              View
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/3 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                activeTab === tab.key
                  ? "bg-white/15 text-white"
                  : "bg-white/5 text-white/40"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Queue Tab */}
      {activeTab === "queue" && (
        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base font-semibold text-white">
                Ingestion Queue
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                  <Input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search reference or payer…"
                    className="h-9 w-56 border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-white/30"
                  />
                </div>
                <PremiumSelect
                  value={sourceType}
                  onValueChange={(v) => { setSourceType(v as typeof sourceType); setPage(1); }}
                >
                  <PremiumSelectTrigger className="h-9 w-[130px]">
                    <PremiumSelectValue placeholder="Source" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="all">All sources</PremiumSelectItem>
                    <PremiumSelectItem value="gateway">Paystack</PremiumSelectItem>
                    <PremiumSelectItem value="bank">Bank / MoMo</PremiumSelectItem>
                    <PremiumSelectItem value="manual">Manual</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
                <PremiumSelect
                  value={status}
                  onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}
                >
                  <PremiumSelectTrigger className="h-9 w-[140px]">
                    <PremiumSelectValue placeholder="Status" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                    <PremiumSelectItem value="unmatched">Unmatched</PremiumSelectItem>
                    <PremiumSelectItem value="ambiguous">Needs review</PremiumSelectItem>
                    <PremiumSelectItem value="matched">Matched</PremiumSelectItem>
                    <PremiumSelectItem value="ignored">Ignored</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-0 divide-y divide-white/5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-white/15" />
                <p className="mt-3 text-sm text-white/40">No items match the selected filters</p>
                <p className="mt-1 text-xs text-white/25">Try changing your filters or import new data</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {items.map((item) => {
                  const isExpanded = expandedItem === item.id;
                  const manualInput = manualPaymentIdByIngestion[item.id] || "";

                  return (
                    <div key={item.id} className={`transition-colors ${isExpanded ? "bg-white/3" : "hover:bg-white/2"}`}>
                      <button
                        type="button"
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        className="flex w-full items-center gap-4 px-5 py-4 text-left"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                          <StatusIcon status={item.status} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-white">
                              {item.externalTxnId}
                            </p>
                            <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(item.status)}`}>
                              {statusLabel(item.status)}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                            <span>{sourceLabel(item.sourceType)}</span>
                            <span className="text-white/20">·</span>
                            <span>{formatShortDate(item.transactionDate)}</span>
                            {item.payerName && (
                              <>
                                <span className="text-white/20">·</span>
                                <span className="truncate">{item.payerName}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="hidden items-center gap-4 sm:flex">
                          {confidenceBar(item.confidence || 0)}
                          <p className="w-28 text-right text-sm font-semibold text-white">
                            {formatCurrency(item.amountMinor)}
                          </p>
                        </div>

                        <ChevronRight className={`h-4 w-4 shrink-0 text-white/20 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-white/5 bg-white/2 px-5 py-4">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">Amount</p>
                              <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(item.amountMinor)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">Reference</p>
                              <p className="mt-1 text-sm text-white/80">{item.rawReference || item.normalizedReference || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">Match method</p>
                              <p className="mt-1 text-sm text-white/80">{item.matchMethod === "none" ? "—" : item.matchMethod.replaceAll("_", " ")}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">Matched to</p>
                              <p className="mt-1 text-sm font-mono text-white/80">{item.matchedPaymentId || "—"}</p>
                            </div>
                          </div>

                          {item.notes && (
                            <p className="mt-3 rounded-lg border border-white/5 bg-white/3 px-3 py-2 text-xs text-white/50">
                              {item.notes}
                            </p>
                          )}

                          {item.candidatePaymentIds.length > 0 && item.status !== "matched" && (
                            <div className="mt-3">
                              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/30">Candidate payments</p>
                              <div className="flex flex-wrap gap-1.5">
                                {item.candidatePaymentIds.slice(0, 5).map((candidate) => (
                                  <button
                                    key={candidate}
                                    type="button"
                                    onClick={() =>
                                      setManualPaymentIdByIngestion((prev) => ({
                                        ...prev,
                                        [item.id]: candidate,
                                      }))
                                    }
                                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-white/60 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-300"
                                  >
                                    {candidate.slice(0, 8)}…
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <Separator className="my-4 bg-white/5" />

                          <div className="flex flex-wrap items-center gap-2">
                            {item.status !== "matched" && (
                              <>
                                <Input
                                  value={manualInput}
                                  onChange={(e) =>
                                    setManualPaymentIdByIngestion((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Payment ID to match"
                                  className="h-9 w-64 border-white/10 bg-white/5 font-mono text-xs text-white placeholder:text-white/25"
                                />
                                <Button
                                  size="sm"
                                  disabled={matchItem.isPending || !manualInput.trim()}
                                  onClick={() => void handleMatch(item.id)}
                                  className="h-9 bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
                                >
                                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                                  {matchItem.isPending ? "Matching…" : "Match"}
                                </Button>
                              </>
                            )}
                            {item.status === "matched" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={unmatchItem.isPending}
                                onClick={() => void handleUnmatch(item.id)}
                                className="h-9 border-white/10 text-white/70 hover:bg-white/5"
                              >
                                <Link2Off className="mr-1.5 h-3.5 w-3.5" />
                                {unmatchItem.isPending ? "Removing…" : "Remove match"}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
                <p className="text-xs text-white/40">
                  Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-base font-semibold text-white">
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {alertsQuery.isLoading ? (
              <div className="space-y-0 divide-y divide-white/5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : activeAlerts.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/30" />
                <p className="mt-3 text-sm text-white/40">All clear — no active alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {activeAlerts.map((alert) => {
                  const iconColor =
                    alert.severity === "critical"
                      ? "bg-rose-500/10 text-rose-400"
                      : alert.severity === "warning"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-blue-500/10 text-blue-400";
                  const AlertIcon =
                    alert.severity === "critical"
                      ? XCircle
                      : alert.severity === "warning"
                      ? AlertTriangle
                      : Eye;
                  return (
                    <div key={alert.id} className="flex items-start gap-4 px-5 py-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
                        <AlertIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{alert.title}</p>
                          <Badge variant="outline" className={`text-[10px] ${
                            alert.severity === "critical"
                              ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                              : alert.severity === "warning"
                              ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                              : "border-blue-500/25 bg-blue-500/10 text-blue-300"
                          }`}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-white/50">{alert.description}</p>
                        <p className="mt-2 text-[11px] text-white/30">
                          Last detected: {formatDateTime(alert.lastDetectedAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">{alert.count}</p>
                        <p className="text-[11px] text-white/30">items</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white">
                Run History
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  placeholder="Optional note…"
                  className="h-9 w-56 border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30"
                />
                <Button
                  size="sm"
                  onClick={() => void handleRunNow()}
                  disabled={runReconciliation.isPending}
                  className="h-9 bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
                >
                  {runReconciliation.isPending ? (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Run Now
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {runsQuery.isLoading ? (
              <div className="divide-y divide-white/5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : recentRuns.length === 0 ? (
              <div className="py-16 text-center">
                <TrendingUp className="mx-auto h-10 w-10 text-white/15" />
                <p className="mt-3 text-sm text-white/40">No reconciliation runs yet</p>
                <p className="mt-1 text-xs text-white/25">Run your first reconciliation to see history here</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentRuns.map((run) => {
                  const isCompleted = run.status === "completed";
                  const isFailed = run.status === "failed";

                  return (
                    <div key={run.id} className="flex items-center gap-4 px-5 py-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isFailed
                          ? "bg-rose-500/10 text-rose-400"
                          : isCompleted
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {isFailed ? (
                          <XCircle className="h-5 w-5" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <RefreshCw className="h-5 w-5 animate-spin" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">
                          {run.mode === "scheduled" ? "Scheduled" : "Manual"} run
                          <span className="ml-2 text-xs text-white/30">{run.status}</span>
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                          <span>{formatDateTime(run.startedAt)}</span>
                          {run.triggeredBy?.name || run.triggeredBy?.email ? (
                            <span>by {run.triggeredBy.name || run.triggeredBy.email}</span>
                          ) : null}
                        </div>
                        {run.errorMessage && (
                          <p className="mt-1 text-xs text-rose-300">{run.errorMessage}</p>
                        )}
                      </div>
                      {run.summary && (
                        <div className="hidden gap-4 text-right text-xs text-white/50 sm:flex">
                          <div>
                            <p className="font-semibold text-emerald-300">{run.summary.matched}</p>
                            <p>matched</p>
                          </div>
                          <div>
                            <p className="font-semibold text-amber-300">{run.summary.ambiguous}</p>
                            <p>ambiguous</p>
                          </div>
                          <div>
                            <p className="font-semibold text-white/80">{run.summary.paymentStatusUpdated}</p>
                            <p>updated</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/admin/finance" className="block">
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 transition-all hover:border-white/20 hover:bg-white/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <ExternalLink className="h-5 w-5 text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Financial Center</p>
                <p className="text-xs text-white/40">Full ledger and transaction overview</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/finance/transactions" className="block">
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 transition-all hover:border-white/20 hover:bg-white/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <Link2 className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Transactions Ledger</p>
                <p className="text-xs text-white/40">Filter by reconciliation status</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/fees" className="block">
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 transition-all hover:border-white/20 hover:bg-white/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <ArrowDownRight className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Fees & Payments</p>
                <p className="text-xs text-white/40">View invoices and record payments</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <ReconciliationIngestionModal
        open={ingestionModalOpen}
        onOpenChange={setIngestionModalOpen}
        onImported={() => {
          void ingestionQuery.refetch();
          void alertsQuery.refetch();
          void runsQuery.refetch();
        }}
      />

      <ReconciliationHelpDrawer open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
