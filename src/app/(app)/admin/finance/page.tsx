"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  CalendarCheck2,
  Download,
  FileSearch,
  Landmark,
  Mail,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  InviteBursarModal,
  type InviteBursarInput,
} from "@/components/modals/InviteBursarModal";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import { RecordTransactionModal } from "@/components/modals/RecordTransactionModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpenses, type ExpenseDTO } from "@/hooks/admin/useExpenses";
import { useCreateInvitation } from "@/hooks/admin/useInvitations";
import {
  useFinanceCommandCenter,
  useFinanceLeoExplainQueueItem,
  useFinanceLeoBrief,
  useFinancialOverview,
  type RangeType,
  type TransactionDTO,
} from "@/hooks/admin/useFinancialCenter";
import { useFeeSummary } from "@/hooks/admin/useFeeSummary";
import {
  useReconciliationAlerts,
  useReconciliationIngestions,
  useReconciliationRuns,
} from "@/hooks/admin/useReconciliation";
import { useBusyToast } from "@/hooks/useBusyToast";
import { formatCurrency, formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";

type QueueSeverity = "info" | "warning" | "critical";

type WorkQueueItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  severity: QueueSeverity;
  count?: number;
  amount?: string;
  amountMinor?: number;
  leoHint: string;
};

const rangeOptions: { value: RangeType; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_30_days", label: "Last 30 days" },
];

function statusTone(severity: QueueSeverity) {
  if (severity === "critical") return "border-rose-300/25 bg-rose-500/10 text-rose-100";
  if (severity === "warning") return "border-amber-300/25 bg-amber-500/10 text-amber-100";
  return "border-sky-300/20 bg-sky-500/10 text-sky-100";
}

function WorkflowCard({
  title,
  description,
  href,
  icon: Icon,
  metric,
  cta = "Open",
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  metric?: string;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20 hover:bg-white/[0.07]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-950/60">
          <Icon className="h-5 w-5 text-sky-200" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{title}</p>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:text-white/65" />
          </div>
          <p className="mt-1 text-xs leading-5 text-white/50">{description}</p>
          {metric ? <p className="mt-3 text-sm font-medium text-white/80">{metric}</p> : null}
          <p className="mt-3 text-xs font-medium text-sky-200">{cta}</p>
        </div>
      </div>
    </Link>
  );
}

function KpiTile({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
  loading,
  href,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "good" | "warn" | "bad";
  loading?: boolean;
  href?: string;
}) {
  const toneClass = {
    neutral: "text-sky-200",
    good: "text-emerald-200",
    warn: "text-amber-200",
    bad: "text-rose-200",
  }[tone];

  const body = (
    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
        <Icon className={cn("h-4 w-4", toneClass)} />
      </div>
      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      ) : (
        <>
          <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-xs leading-5 text-white/45">{helper}</p>
        </>
      )}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function RecentTransaction({ transaction }: { transaction: TransactionDTO }) {
  const inflow = transaction.direction === "inflow";
  return (
    <Link
      href={`/admin/finance/transactions/${transaction._id}`}
      className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3 transition hover:bg-white/[0.06]"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          inflow ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"
        )}
      >
        {inflow ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {transaction.description || transaction.reference || transaction.category}
        </p>
        <p className="mt-0.5 text-xs text-white/45">
          {transaction.method.replaceAll("_", " ")} · {format(new Date(transaction.occurredAt), "MMM d")}
        </p>
      </div>
      <p className={cn("shrink-0 text-sm font-semibold", inflow ? "text-emerald-200" : "text-rose-200")}>
        {inflow ? "+" : "-"}
        {formatCurrency(transaction.netAmountMinor, { currency: transaction.currency })}
      </p>
    </Link>
  );
}

function buildLeoBrief(input: {
  collected: string;
  outstanding: string;
  overdueCount: number;
  pendingCount: number;
  unmatchedCount: number;
  criticalAlerts: number;
}) {
  const actions: string[] = [];
  if (input.pendingCount > 0) actions.push(`review ${input.pendingCount} pending finance item(s)`);
  if (input.unmatchedCount > 0) actions.push(`reconcile ${input.unmatchedCount} unmatched statement line(s)`);
  if (input.overdueCount > 0) actions.push(`prioritize ${input.overdueCount} overdue account(s)`);
  if (input.criticalAlerts > 0) actions.push("clear critical reconciliation alerts");

  return {
    summary: `Collected ${input.collected}; outstanding fees are ${input.outstanding}.`,
    recommendation:
      actions.length > 0
        ? `Start with ${actions.slice(0, 2).join(", ")}.`
        : "No urgent finance exceptions are visible from the current data.",
  };
}

export default function FinanceCommandCenterPage() {
  const [range, setRange] = React.useState<RangeType>("this_month");
  const [recordModalOpen, setRecordModalOpen] = React.useState(false);
  const [inviteBursarOpen, setInviteBursarOpen] = React.useState(false);

  const busy = useBusyToast();
  const createInvitation = useCreateInvitation();

  const commandCenter = useFinanceCommandCenter({ range });
  const leoBriefQuery = useFinanceLeoBrief(commandCenter.data);
  const explainQueueItem = useFinanceLeoExplainQueueItem();
  const overview = useFinancialOverview({ range, compare: true });
  const feeSummary = useFeeSummary();
  const reconciliationIngestions = useReconciliationIngestions({ page: 1, limit: 1 });
  const reconciliationAlerts = useReconciliationAlerts(true, true);
  const reconciliationRuns = useReconciliationRuns(1, true);
  const expensesPending = useExpenses({ status: "submitted", limit: 5 });
  const expensesRecent = useExpenses({ limit: 5, sortBy: "updatedAt", sortOrder: "desc" });

  const data = overview.data;
  const command = commandCenter.data;
  const fees = feeSummary.data;
  const reconSummary = reconciliationIngestions.data?.summary || {
    unmatched: 0,
    matched: 0,
    ambiguous: 0,
    ignored: 0,
  };
  const activeAlerts = reconciliationAlerts.data?.active || [];
  const criticalAlertCount = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const pendingExpenseCount = expensesPending.data?.pagination?.total ?? 0;
  const pendingApprovalCount = (data?.kpis.pendingCount ?? 0) + pendingExpenseCount;
  const pendingApprovalMinor =
    (data?.kpis.pendingAmount ?? 0) +
    (expensesPending.data?.data || []).reduce((sum, expense) => sum + expense.amountMinor, 0);
  const trustStatus: "healthy" | "needs_review" | "critical" =
    command?.trust.status ??
    (criticalAlertCount > 0 || (data?.kpis.failedCount ?? 0) > 0
      ? "critical"
      : reconSummary.unmatched > 0 || reconSummary.ambiguous > 0 || pendingApprovalCount > 0
        ? "needs_review"
        : "healthy");

  const fallbackWorkQueue = React.useMemo<WorkQueueItem[]>(() => {
    const items: WorkQueueItem[] = [];
    if (pendingApprovalCount > 0) {
      items.push({
        id: "pending-approvals",
        title: "Finance approvals pending",
        description: "Payments or expenses need human review before the records can be trusted.",
        href: "/admin/finance/transactions?status=pending",
        severity: "warning",
        count: pendingApprovalCount,
        amount: formatCurrency(pendingApprovalMinor, { maximumFractionDigits: 0 }),
        amountMinor: pendingApprovalMinor,
        leoHint: "Leo should explain which pending items are safest to handle first.",
      });
    }
    if (reconSummary.unmatched > 0 || reconSummary.ambiguous > 0) {
      items.push({
        id: "reconciliation",
        title: "Reconciliation needs review",
        description: "External bank or gateway evidence has not been fully matched to payment records.",
        href: "/admin/finance/reconciliation/sessions",
        severity: reconSummary.unmatched > 10 || criticalAlertCount > 0 ? "critical" : "warning",
        count: reconSummary.unmatched + reconSummary.ambiguous,
        leoHint: "Leo should rank exact matches ahead of ambiguous matches.",
      });
    }
    if ((fees?.summary.overdueCount ?? 0) > 0) {
      items.push({
        id: "overdue-fees",
        title: "Overdue fee accounts",
        description: "Families need reminder or follow-up based on overdue invoices.",
        href: "/admin/fees",
        severity: "warning",
        count: fees?.summary.overdueCount,
        amount: formatMoney(fees?.summary.totalOutstandingMinor ?? 0),
        amountMinor: fees?.summary.totalOutstandingMinor ?? 0,
        leoHint: "Leo should draft reminder groups by overdue age and balance size.",
      });
    }
    if ((data?.kpis.failedCount ?? 0) > 0) {
      items.push({
        id: "failed-transactions",
        title: "Failed transactions",
        description: "Failed finance records should be reviewed before reports are shared.",
        href: "/admin/finance/transactions?status=failed",
        severity: "critical",
        count: data?.kpis.failedCount,
        amount: formatCurrency(data?.kpis.failedAmount ?? 0, { maximumFractionDigits: 0 }),
        amountMinor: data?.kpis.failedAmount ?? 0,
        leoHint: "Leo should explain failure patterns and identify duplicates or retry candidates.",
      });
    }
    if (criticalAlertCount > 0) {
      items.push({
        id: "critical-alerts",
        title: "Critical reconciliation alerts",
        description: "Reconciliation alerts may affect the reliability of reported collections.",
        href: "/admin/finance/reconciliation/sessions",
        severity: "critical",
        count: criticalAlertCount,
        leoHint: "Leo should summarize the alert evidence and likely next action.",
      });
    }
    return items;
  }, [
    criticalAlertCount,
    data?.kpis.failedAmount,
    data?.kpis.failedCount,
    fees?.summary.overdueCount,
    fees?.summary.totalOutstandingMinor,
    pendingApprovalCount,
    pendingApprovalMinor,
    reconSummary.ambiguous,
    reconSummary.unmatched,
  ]);

  const workQueue = React.useMemo<WorkQueueItem[]>(() => {
    if (!command?.workQueue?.length) return fallbackWorkQueue;
    return command.workQueue.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      href: item.href,
      severity: item.severity,
      count: item.count,
      amount:
        item.amountMinor != null
          ? formatCurrency(item.amountMinor, { maximumFractionDigits: 0 })
          : undefined,
      amountMinor: item.amountMinor,
      leoHint: "Leo should explain the evidence behind this item and recommend the next action.",
    }));
  }, [command?.workQueue, fallbackWorkQueue]);

  const leoBrief = buildLeoBrief({
    collected: formatCurrency(command?.kpis.collectedMinor ?? data?.kpis.totalInflow ?? 0, {
      maximumFractionDigits: 0,
    }),
    outstanding: formatMoney(
      command?.kpis.outstandingFeesMinor ?? fees?.summary.totalOutstandingMinor ?? 0
    ),
    overdueCount: command?.kpis.overdueStudentCount ?? fees?.summary.overdueCount ?? 0,
    pendingCount: command?.kpis.pendingApprovalCount ?? pendingApprovalCount,
    unmatchedCount: command?.kpis.unreconciledCount ?? reconSummary.unmatched + reconSummary.ambiguous,
    criticalAlerts: command?.trust.criticalAlertCount ?? criticalAlertCount,
  });

  async function explainWorkItem(item: WorkQueueItem) {
    await explainQueueItem.mutateAsync({
      item: {
        title: item.title,
        description: item.description,
        severity: item.severity,
        count: item.count,
        amountMinor: item.amountMinor,
        href: item.href,
      },
      trustStatus,
    });
  }

  async function handleInviteBursar(payload: InviteBursarInput) {
    const invitePromise = createInvitation.mutateAsync({
      email: payload.email,
      role: "bursar",
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone || undefined,
      photoUrl: payload.photoUrl || undefined,
    });

    await busy.promise(invitePromise, {
      loading: "Sending bursar invitation...",
      success: "Bursar invitation sent",
      error: (error: Error) => error.message || "Failed to send bursar invitation",
    });
    setInviteBursarOpen(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/60">
              <Landmark className="h-3.5 w-3.5 text-sky-200" />
              Finance Command Center
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                trustStatus === "healthy"
                  ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                  : trustStatus === "critical"
                    ? "border-rose-300/25 bg-rose-500/10 text-rose-100"
                    : "border-amber-300/25 bg-amber-500/10 text-amber-100"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {trustStatus === "healthy"
                ? "Controls healthy"
                : trustStatus === "critical"
                  ? "Critical review needed"
                  : "Needs review"}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Finance
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            See the school&apos;s collection position, exception queues, reconciliation health, and
            the workflows finance staff need to handle today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PremiumSelect value={range} onValueChange={(value) => setRange(value as RangeType)}>
            <PremiumSelectTrigger className="w-[160px] border-white/10 bg-white/[0.05] text-white">
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {rangeOptions.map((option) => (
                <PremiumSelectItem key={option.value} value={option.value}>
                  {option.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              void commandCenter.refetch();
              void overview.refetch();
            }}
            className="border-white/10 bg-white/[0.05] text-white hover:bg-white/10"
            aria-label="Refresh finance data"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-500">
            <Link href="/admin/fees/payments/record">
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 bg-white/[0.05] text-white hover:bg-white/10">
            <Link href="/admin/fees/invoices/new">
              <Receipt className="mr-2 h-4 w-4" />
              Issue Invoices
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 bg-white/[0.05] text-white hover:bg-white/10">
            <Link href="/admin/finance/reconciliation/sessions">
              <FileSearch className="mr-2 h-4 w-4" />
              Reconcile
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <KpiTile
          label="Collected"
          value={formatCurrency(command?.kpis.collectedMinor ?? data?.kpis.totalInflow ?? 0, {
            maximumFractionDigits: 0,
          })}
          helper={`${command?.kpis.collectedCount ?? data?.kpis.inflowCount ?? 0} successful inflow records`}
          icon={ArrowDownRight}
          tone="good"
          loading={commandCenter.isLoading && overview.isLoading}
          href="/admin/finance/transactions?direction=inflow"
        />
        <KpiTile
          label="Outstanding fees"
          value={formatMoney(command?.kpis.outstandingFeesMinor ?? fees?.summary.totalOutstandingMinor ?? 0)}
          helper="Active unpaid receivables"
          icon={Wallet}
          tone="warn"
          loading={commandCenter.isLoading && feeSummary.isLoading}
          href="/admin/fees"
        />
        <KpiTile
          label="Overdue"
          value={String(command?.kpis.overdueStudentCount ?? fees?.summary.overdueCount ?? 0)}
          helper="Accounts past due"
          icon={AlertCircle}
          tone="bad"
          loading={commandCenter.isLoading && feeSummary.isLoading}
          href="/admin/fees"
        />
        <KpiTile
          label="Pending approval"
          value={String(command?.kpis.pendingApprovalCount ?? pendingApprovalCount)}
          helper={formatCurrency(command?.kpis.pendingApprovalMinor ?? pendingApprovalMinor, {
            maximumFractionDigits: 0,
          })}
          icon={Clock}
          tone="warn"
          loading={commandCenter.isLoading && (overview.isLoading || expensesPending.isLoading)}
          href="/admin/finance/transactions?status=pending"
        />
        <KpiTile
          label="Unreconciled"
          value={String(command?.kpis.unreconciledCount ?? reconSummary.unmatched + reconSummary.ambiguous)}
          helper={`${command?.trust.unmatchedCount ?? reconSummary.unmatched} unmatched · ${command?.trust.ambiguousCount ?? reconSummary.ambiguous} needs review`}
          icon={FileSearch}
          tone={(command?.kpis.unreconciledCount ?? reconSummary.unmatched + reconSummary.ambiguous) > 0 ? "warn" : "good"}
          loading={commandCenter.isLoading && reconciliationIngestions.isLoading}
          href="/admin/finance/reconciliation/sessions"
        />
        <KpiTile
          label="Net movement"
          value={formatCurrency(command?.kpis.netCashMovementMinor ?? data?.kpis.netPosition ?? 0, {
            maximumFractionDigits: 0,
          })}
          helper="Inflow minus outflow"
          icon={BarChart3}
          tone={(command?.kpis.netCashMovementMinor ?? data?.kpis.netPosition ?? 0) >= 0 ? "neutral" : "bad"}
          loading={commandCenter.isLoading && overview.isLoading}
          href="/admin/finance/transactions"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-amber-300/15 bg-amber-500/10 p-4 text-amber-50">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-100" />
              <div>
                <p className="text-sm font-semibold">Finance controls are human-confirmed</p>
                <p className="mt-1 text-sm leading-6 text-amber-50/75">
                  Leo can explain, rank, and draft finance work. Approvals, cash closure,
                  reconciliation, reminders, refunds, reversals, and disbursements still require
                  explicit user confirmation and audit evidence.
                </p>
              </div>
            </div>
          </section>

          <Card className="border border-white/10 bg-slate-950/55">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-white">Needs Attention</CardTitle>
                  <p className="mt-1 text-sm text-white/45">
                    Ranked finance work from payments, fees, reconciliation, and expenses.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
                  {workQueue.length} open
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {overview.isLoading || feeSummary.isLoading || reconciliationIngestions.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : workQueue.length === 0 ? (
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-500/10 p-4 text-emerald-50">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-medium">No urgent finance exceptions</p>
                  </div>
                  <p className="mt-1 text-sm text-emerald-50/70">
                    Continue monitoring collections and reconciliation as payments come in.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workQueue.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-xl border p-4",
                        statusTone(item.severity)
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{item.title}</p>
                            {item.count != null ? (
                              <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">
                                {item.count}
                              </span>
                            ) : null}
                            {item.amount ? (
                              <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">
                                {item.amount}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm opacity-75">{item.description}</p>
                          <p className="mt-3 flex items-start gap-2 text-xs opacity-75">
                            <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {item.leoHint}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void explainWorkItem(item)}
                            disabled={explainQueueItem.isPending}
                            className="border-white/15 bg-black/10 text-current hover:bg-black/20"
                          >
                            <Bot className="mr-1 h-4 w-4" />
                            Ask Leo
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="border-white/15 bg-black/10 text-current hover:bg-black/20"
                          >
                            <Link href={item.href}>
                              Open
                              <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {explainQueueItem.data ? (
                <div className="mt-4 rounded-xl border border-violet-300/15 bg-violet-500/10 p-4 text-violet-50">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Bot className="h-4 w-4" />
                    {explainQueueItem.data.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-violet-50/75">
                    {explainQueueItem.data.explanation}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {explainQueueItem.data.evidence.map((line) => (
                      <span key={line} className="rounded-lg border border-violet-200/10 bg-black/10 px-3 py-2 text-xs">
                        {line}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-violet-50/75">
                    {explainQueueItem.data.nextAction}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-violet-50/55">
                    {explainQueueItem.data.guardrail}
                  </p>
                </div>
              ) : explainQueueItem.error ? (
                <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-50">
                  {explainQueueItem.error instanceof Error
                    ? explainQueueItem.error.message
                    : "Could not explain this queue item"}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border border-white/10 bg-slate-950/55">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-base text-white">Fees Collection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-white/40">Billed</p>
                    <p className="mt-1 font-semibold text-white">
                      {formatMoney(command?.fees.totalBilledMinor ?? fees?.summary.totalBilledMinor ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Collected</p>
                    <p className="mt-1 font-semibold text-emerald-100">
                      {formatMoney(command?.fees.totalCollectedMinor ?? fees?.summary.totalRevenueMinor ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Collection rate</p>
                    <p className="mt-1 font-semibold text-sky-100">
                      {Math.round(command?.fees.collectionRate ?? fees?.summary.collectionRate ?? 0)}%
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(command?.fees.topOverdue?.length
                    ? command.fees.topOverdue.map((item) => ({
                        studentId: item.studentId,
                        firstName: item.studentName,
                        lastName: "",
                        totalOutstandingMinor: item.amountMinor,
                      }))
                    : fees?.defaulters || []
                  )
                    .slice(0, 4)
                    .map((item) => (
                    <Link
                      key={item.studentId}
                      href={`/admin/students/${item.studentId}`}
                      className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]"
                    >
                      <span className="min-w-0 truncate text-white/75">
                        {item.firstName} {item.lastName}
                      </span>
                      <span className="shrink-0 font-medium text-amber-100">
                        {formatMoney(item.totalOutstandingMinor)}
                      </span>
                    </Link>
                  ))}
                  {!feeSummary.isLoading && (fees?.defaulters?.length || 0) === 0 ? (
                    <p className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm text-white/45">
                      No overdue accounts in the summary.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500">
                    <Link href="/admin/fees">Open fees</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/[0.04] text-white">
                    <Link href="/admin/fees/invoices">Invoices</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-slate-950/55">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-base text-white">Recent Ledger Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                {overview.isLoading ? (
                  <>
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                  </>
                ) : (data?.recentTransactions.length || 0) > 0 ? (
                  data?.recentTransactions.slice(0, 5).map((transaction) => (
                    <RecentTransaction key={transaction._id} transaction={transaction} />
                  ))
                ) : (
                  <p className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm text-white/45">
                    No recent ledger activity for this range.
                  </p>
                )}
                <Button asChild size="sm" variant="outline" className="mt-2 w-full border-white/10 bg-white/[0.04] text-white">
                  <Link href="/admin/finance/transactions">Open ledger</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <WorkflowCard
              title="Payments"
              description="Record, review, approve, and inspect school payment activity."
              href="/admin/finance/payments"
              icon={Wallet}
              metric={`${command?.kpis.collectedCount ?? data?.kpis.inflowCount ?? 0} inflow records in range`}
              cta="Open payment workflow"
            />
            <WorkflowCard
              title="Reconciliation"
              description="Match bank and gateway evidence against recorded payments."
              href="/admin/finance/reconciliation/sessions"
              icon={FileSearch}
              metric={`${command?.trust.unmatchedCount ?? reconSummary.unmatched} unmatched · ${command?.trust.ambiguousCount ?? reconSummary.ambiguous} review`}
            />
            <WorkflowCard
              title="Expenses"
              description="Review submitted expenses, payables, and recent outflows."
              href="/admin/expenses"
              icon={Receipt}
              metric={`${command?.expenses.pendingApprovalCount ?? pendingExpenseCount} awaiting approval`}
            />
            <WorkflowCard
              title="Disbursements"
              description="Track outgoing payment rails and school payout operations."
              href="/admin/finance/disbursements"
              icon={Send}
              cta="Open disbursements"
            />
            <WorkflowCard
              title="Cash Close"
              description="Count cash collections, resolve variance, and close the day."
              href="/admin/finance/cash-close"
              icon={CalendarCheck2}
              cta="Close cash"
            />
            <WorkflowCard
              title="Ledger and Audit"
              description="Inspect immutable finance events, corrections, and approvals."
              href="/admin/finance/transactions"
              icon={ClipboardList}
              cta="Open ledger"
            />
            <WorkflowCard
              title="Reports"
              description="Export collections, debtors, cashbook, and reconciliation evidence."
              href="/admin/finance/reports"
              icon={Download}
              cta="Open reports"
            />
          </div>
        </div>

        <aside className="space-y-5">
          <Card className="border border-sky-300/15 bg-sky-500/10">
            <CardHeader className="border-b border-sky-200/10 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-sky-100" />
                <CardTitle className="text-base text-white">Leo Finance Brief</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm leading-6 text-sky-50/85">
                {leoBriefQuery.data?.summary || leoBrief.summary}
              </p>
              <p className="rounded-lg border border-sky-200/15 bg-black/15 p-3 text-sm leading-6 text-sky-50/75">
                {leoBriefQuery.data?.recommendedActions?.[0]
                  ? `${leoBriefQuery.data.recommendedActions[0].title}: ${leoBriefQuery.data.recommendedActions[0].reason}.`
                  : leoBrief.recommendation}
              </p>
              {leoBriefQuery.data?.risks?.length ? (
                <div className="space-y-1">
                  {leoBriefQuery.data.risks.slice(0, 3).map((risk) => (
                    <p key={risk} className="flex items-start gap-2 text-xs leading-5 text-sky-50/65">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {risk}
                    </p>
                  ))}
                </div>
              ) : null}
              {leoBriefQuery.data?.evidence?.length ? (
                <div className="grid gap-2 border-t border-sky-200/10 pt-3">
                  {leoBriefQuery.data.evidence.slice(0, 4).map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-sky-50/45">{item.label}</span>
                      <span className="text-right text-sky-50/75">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-xs leading-5 text-sky-50/55">
                {leoBriefQuery.data?.guardrail ||
                  "Leo can explain, rank, and draft finance work. Sensitive actions require human confirmation."}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-slate-950/55">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-base text-white">Trust and Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/50">Last reconciliation run</span>
                <span className="text-right text-white/75">
                  {command?.trust.lastReconciliationAt
                    ? format(new Date(command.trust.lastReconciliationAt), "MMM d, h:mm a")
                    : reconciliationRuns.data?.[0]?.startedAt
                    ? format(new Date(reconciliationRuns.data[0].startedAt), "MMM d, h:mm a")
                    : "Not available"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/50">Active alerts</span>
                <span className={(command?.trust.activeAlertCount ?? activeAlerts.length) > 0 ? "text-amber-100" : "text-emerald-100"}>
                  {command?.trust.activeAlertCount ?? (reconciliationAlerts.isLoading ? "..." : activeAlerts.length)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/50">Failed transactions</span>
                <span className={(command?.trust.failedTransactionCount ?? data?.kpis.failedCount ?? 0) > 0 ? "text-rose-100" : "text-emerald-100"}>
                  {command?.trust.failedTransactionCount ?? data?.kpis.failedCount ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/50">Maker-checker queue</span>
                <span className={(command?.trust.makerCheckerPendingCount ?? pendingApprovalCount) > 0 ? "text-amber-100" : "text-emerald-100"}>
                  {command?.trust.makerCheckerPendingCount ?? pendingApprovalCount}
                </span>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full border-white/10 bg-white/[0.04] text-white">
                <Link href="/admin/finance/reconciliation/sessions">Review controls</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-slate-950/55">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-base text-white">Expenses Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {(command?.expenses.recent?.length
                ? command.expenses.recent.map((expense) => ({
                    id: expense.id,
                    title: expense.title,
                    amountMinor: expense.amountMinor,
                    currency: expense.currency,
                  }))
                : (expensesRecent.data?.data || []).map((expense: ExpenseDTO) => ({
                    id: expense._id,
                    title: expense.title,
                    amountMinor: expense.amountMinor,
                    currency: expense.currency,
                  }))
              )
                .slice(0, 4)
                .map((expense) => (
                  <Link
                    key={expense.id}
                    href={`/admin/expenses/${expense.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]"
                  >
                    <span className="min-w-0 truncate text-white/75">{expense.title}</span>
                    <span className="shrink-0 text-white/65">
                      {formatCurrency(expense.amountMinor, {
                        currency: expense.currency,
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </Link>
                ))}
              {!expensesRecent.isLoading && !command?.expenses.recent?.length && (expensesRecent.data?.data?.length || 0) === 0 ? (
                <p className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm text-white/45">
                  No recent expenses.
                </p>
              ) : null}
              <Button asChild size="sm" variant="outline" className="mt-2 w-full border-white/10 bg-white/[0.04] text-white">
                <Link href="/admin/expenses">Open expenses</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-slate-950/55">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-base text-white">Secondary Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 p-4">
              <Button
                type="button"
                variant="outline"
                className="justify-start border-white/10 bg-white/[0.04] text-white"
                onClick={() => setRecordModalOpen(true)}
              >
                <Landmark className="mr-2 h-4 w-4" />
                Record manual ledger entry
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start border-white/10 bg-white/[0.04] text-white"
                onClick={() => setInviteBursarOpen(true)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Invite bursar
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-slate-950/55">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-base text-white">Permission Guardrails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-sm text-white/60">
              {[
                "Payment approval must be done by an authorized finance user.",
                "Manual ledger entries, refunds, reversals, and disbursements require audit evidence.",
                "Cash closure requires a variance note when counted cash differs from expected cash.",
                "Leo explanations and drafts do not approve, reconcile, send, reverse, refund, or close anything.",
              ].map((line) => (
                <p key={line} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                  {line}
                </p>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>

      <RecordTransactionModal
        open={recordModalOpen}
        onOpenChange={setRecordModalOpen}
        onSuccess={() => {
          void commandCenter.refetch();
          void overview.refetch();
        }}
      />

      <ResponsiveModal
        open={inviteBursarOpen}
        onClose={() => setInviteBursarOpen(false)}
        title="Invite Bursar"
      >
        <InviteBursarModal
          onClose={() => setInviteBursarOpen(false)}
          onSubmit={handleInviteBursar}
          isLoading={createInvitation.isPending}
        />
      </ResponsiveModal>
    </div>
  );
}
