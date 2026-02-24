/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/fees/money";
import {
  AlertCircle,
  CalendarCheck2,
  ChevronRight,
  CircleHelp,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type PaymentInboxQueue,
  usePendingPayments,
} from "@/hooks/admin/usePendingPayments";
import { useDailyReconciliation } from "@/hooks/admin/useDailyReconciliation";
import { useCashClosure, useCloseCashDay } from "@/hooks/admin/useCashClosure";
import { toast } from "sonner";

function parseMoneyToMinor(value: string) {
  const n = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function minorToInput(minor: number) {
  return (minor / 100).toFixed(2);
}

function queuePillClass(queue: PaymentInboxQueue, active: boolean) {
  const base = active
    ? "border-white/20 bg-white/15 text-white"
    : "border-white/10 bg-white/5 text-white/70";
  if (queue === "pending_approval") {
    return `${base} ${active ? "border-amber-400/40 bg-amber-500/15 text-amber-100" : ""}`;
  }
  if (queue === "unmatched") {
    return `${base} ${active ? "border-rose-400/40 bg-rose-500/15 text-rose-100" : ""}`;
  }
  if (queue === "needs_reconciliation") {
    return `${base} ${active ? "border-blue-400/40 bg-blue-500/15 text-blue-100" : ""}`;
  }
  return `${base} ${active ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100" : ""}`;
}

function formatAge(ageHours: number) {
  if (!Number.isFinite(ageHours) || ageHours <= 0) return "just now";
  if (ageHours < 24) return `${Math.round(ageHours)}h`;
  return `${Math.floor(ageHours / 24)}d`;
}

export function PendingApprovalsCard(props: {
  studentId?: string;
  invoiceId?: string | null;
  academicPeriodId?: string | null;
  onOpenPayment: (paymentId: string) => void;
}) {
  const isScopedContext = Boolean(
    props.studentId || props.invoiceId || props.academicPeriodId
  );
  const [queue, setQueue] = React.useState<PaymentInboxQueue>("pending_approval");
  const [recordedCashInput, setRecordedCashInput] = React.useState("0.00");
  const [varianceNote, setVarianceNote] = React.useState("");

  const { data, isLoading, isError } = usePendingPayments({
    queue,
    studentId: props.studentId,
    invoiceId: props.invoiceId || undefined,
    academicPeriodId: props.academicPeriodId || undefined,
    limit: 6,
    page: 1,
  });
  const runReconciliation = useDailyReconciliation();
  const { data: cashData, isLoading: cashLoading } = useCashClosure(undefined, {
    enabled: !isScopedContext,
  });
  const closeCashDay = useCloseCashDay();

  const queues = data?.queues ?? [];
  const items = data?.payments ?? [];
  const alerts = data?.alerts ?? [];
  const kpis = data?.kpis;
  const expectedCashMinor = cashData?.expectedCashMinor ?? 0;
  const recordedCashMinor = parseMoneyToMinor(recordedCashInput);
  const varianceMinor = recordedCashMinor - expectedCashMinor;
  const closureToday = cashData?.closure;

  React.useEffect(() => {
    if (!cashData) return;
    if (closureToday) {
      setRecordedCashInput(minorToInput(closureToday.recordedCashMinor));
      setVarianceNote(closureToday.varianceResolutionNote || "");
      return;
    }
    setRecordedCashInput(minorToInput(expectedCashMinor));
  }, [cashData, closureToday, expectedCashMinor]);

  async function handleRunDailyReconciliation() {
    try {
      const result = await runReconciliation.mutateAsync({});
      const matchedIngestion =
        Number(result.summary?.matched || result.byStatus?.matched_ingestion || 0);
      const ambiguousIngestion =
        Number(
          result.summary?.ambiguous || result.byStatus?.ambiguous_ingestion || 0
        );
      toast.success(
        result.updated > 0
          ? `Auto-reconciliation updated ${result.updated} payment(s). Matched ${matchedIngestion} ingestion item(s), ${ambiguousIngestion} ambiguous.`
          : "No reconciliation changes were needed."
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to run auto-reconciliation");
    }
  }

  async function handleCloseCashDay() {
    try {
      await closeCashDay.mutateAsync({
        recordedCashMinor,
        varianceResolutionNote: varianceNote || undefined,
      });
      toast.success("Cash day closed successfully.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to close cash day");
    }
  }

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/10 via-amber-500/0 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 space-y-3 pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold uppercase tracking-wider text-white/80">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/60" />
            Payment Inbox
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-white/40 hover:text-white/70"
                    aria-label="Payment inbox help"
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {isScopedContext
                    ? "Queue-driven control panel for this student: review payment proofs, reconciliation flags, and blocked reversals."
                    : "Queue-driven control panel to prevent missed payments: review, reconcile, and resolve blocked reversals."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isScopedContext ? (
              <Badge
                variant="outline"
                className="border-white/20 bg-white/10 text-[10px] text-white/80"
              >
                Student scoped
              </Badge>
            ) : null}
          </span>
          {!isScopedContext ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-white/15 bg-white/5 text-xs"
              disabled={runReconciliation.isPending}
              onClick={handleRunDailyReconciliation}
              title="Runs deterministic matching rules across pending reconciliation evidence."
            >
              <RefreshCw
                className={`mr-1 h-3.5 w-3.5 ${
                  runReconciliation.isPending ? "animate-spin" : ""
                }`}
              />
              Auto-reconcile
            </Button>
          ) : null}
        </CardTitle>

        <div className="flex flex-wrap gap-2">
          {queues.map((entry) => (
            <TooltipProvider key={entry.key} delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setQueue(entry.key)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${queuePillClass(
                      entry.key,
                      queue === entry.key
                    )}`}
                  >
                    <span>{entry.label}</span>
                    <Badge
                      variant="outline"
                      className="border-white/20 bg-black/20 text-[10px] text-white/80"
                    >
                      {entry.count}
                    </Badge>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {entry.description} SLA: {entry.slaHours}h.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.slice(0, 2).map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => {
                  if (alert.queue) setQueue(alert.queue);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                  alert.severity === "critical"
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{alert.title}</div>
                  <Badge
                    variant="outline"
                    className="border-white/20 bg-black/20 text-[10px] text-white/80"
                  >
                    {alert.count}
                  </Badge>
                </div>
                <div className="mt-1 text-[11px] opacity-90">{alert.description}</div>
              </button>
            ))}
          </div>
        ) : null}

        {kpis ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/10 bg-black/10 p-2">
              <div className="text-[10px] text-white/55">Unreconciled</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {kpis.unreconciledCount}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/10 p-2">
              <div className="text-[10px] text-white/55">Approval Lag</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {kpis.averageApprovalLagHours.toFixed(1)}h
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/10 p-2">
              <div className="text-[10px] text-white/55">Reversal Rate</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {kpis.reversalRatePct.toFixed(1)}%
              </div>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
            Loading queue…
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-100">
            Could not load payment inbox. Please refresh.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
            No records in this queue.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((payment: any) => (
              <div
                key={payment._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/85">
                    {formatMoney(payment.amountMinor)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(payment.paymentMethod).replaceAll("_", " ")} •{" "}
                    {payment.internalReference || payment.receiptNumber || payment.paystackReference || "—"}
                  </div>
                  <div className="mt-1 text-[11px] text-white/45">
                    {payment.studentId
                      ? `${payment.studentId.firstName} ${payment.studentId.lastName}`.trim()
                      : "Student"}
                    <span className="text-white/30"> • </span>
                    Age {formatAge(payment.ageHours || 0)}
                    {payment.slaBreached ? (
                      <span className="text-rose-300"> • SLA breached</span>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => props.onOpenPayment(payment._id)}
                >
                  Review <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {!isScopedContext ? (
          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/75">
              <CalendarCheck2 className="h-3.5 w-3.5 text-white/60" />
              End-of-day cash closure
              <TooltipProvider delayDuration={250}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-white/40 hover:text-white/70"
                      aria-label="Cash closure help"
                    >
                      <CircleHelp className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Close cash collections for today. If counted cash differs from
                    expected, resolution note is mandatory.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-white/10 bg-white/5 p-2">
                <div className="text-white/55">Expected</div>
                <div className="mt-1 font-semibold text-white">
                  {cashLoading ? "…" : formatMoney(expectedCashMinor)}
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-2">
                <div className="text-white/55">Counted</div>
                <Input
                  value={recordedCashInput}
                  onChange={(event) => setRecordedCashInput(event.target.value)}
                  inputMode="decimal"
                  className="mt-1 h-7 border-white/10 bg-black/20 px-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs">
              <span className="text-white/55">Variance: </span>
              <span
                className={
                  varianceMinor === 0 ? "text-emerald-200" : "text-amber-200"
                }
              >
                {formatMoney(varianceMinor)}
              </span>
            </div>

            {varianceMinor !== 0 ? (
              <div className="mt-2 space-y-1">
                <Label className="text-[11px] text-white/60">Resolution Note *</Label>
                <Input
                  value={varianceNote}
                  onChange={(event) => setVarianceNote(event.target.value)}
                  placeholder="Explain the variance before closure"
                  className="h-8 border-white/10 bg-black/20 text-xs"
                />
              </div>
            ) : null}

            {closureToday ? (
              <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-100">
                Closed for {closureToday.closureDate}
              </div>
            ) : null}

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-white/15 bg-white/5 text-xs"
                disabled={
                  closeCashDay.isPending ||
                  (varianceMinor !== 0 && varianceNote.trim().length === 0)
                }
                onClick={handleCloseCashDay}
              >
                {closeCashDay.isPending ? (
                  <>
                    <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                    Closing…
                  </>
                ) : (
                  "Close cash day"
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {alerts.length > 2 ? (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">
            <AlertCircle className="h-3.5 w-3.5 text-white/60" />
            +{alerts.length - 2} additional alert(s) in payment inbox.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
