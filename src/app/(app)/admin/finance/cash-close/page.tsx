"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCashClosure, useCloseCashDay } from "@/hooks/admin/useCashClosure";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";

function parseMoneyToMinor(value: string) {
  const n = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function minorToInput(minor: number) {
  return (minor / 100).toFixed(2);
}

function todayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function FinanceCashClosePage() {
  const [closureDate, setClosureDate] = React.useState(todayDateKey);
  const cashClosure = useCashClosure(closureDate);
  const closeCashDay = useCloseCashDay();
  const [recordedCashInput, setRecordedCashInput] = React.useState("0.00");
  const [varianceNote, setVarianceNote] = React.useState("");

  const expectedCashMinor = cashClosure.data?.expectedCashMinor ?? 0;
  const recordedCashMinor = parseMoneyToMinor(recordedCashInput);
  const varianceMinor = recordedCashMinor - expectedCashMinor;
  const closure = cashClosure.data?.closure ?? null;
  const canClose = varianceMinor === 0 || varianceNote.trim().length > 0;

  React.useEffect(() => {
    if (!cashClosure.data) return;
    if (cashClosure.data.closure) {
      setRecordedCashInput(minorToInput(cashClosure.data.closure.recordedCashMinor));
      setVarianceNote(cashClosure.data.closure.varianceResolutionNote || "");
      return;
    }
    setRecordedCashInput(minorToInput(cashClosure.data.expectedCashMinor));
    setVarianceNote("");
  }, [cashClosure.data]);

  async function handleCloseCashDay() {
    try {
      await closeCashDay.mutateAsync({
        closureDate,
        recordedCashMinor,
        varianceResolutionNote: varianceNote || undefined,
      });
      toast.success("Cash day closed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to close cash day");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-3 px-0 text-white/60 hover:bg-transparent hover:text-white">
            <Link href="/admin/finance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Finance
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
              <WalletCards className="h-5 w-5 text-emerald-200" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Cash Close</h1>
              <p className="mt-1 text-sm text-white/55">
                Count cash collections, resolve variances, and close the day with an audit trail.
              </p>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/[0.04] text-white"
          onClick={() => void cashClosure.refetch()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <section className="rounded-xl border border-emerald-300/15 bg-emerald-500/10 p-4 text-emerald-50">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100" />
          <div>
            <p className="text-sm font-semibold">Human-confirmed closure</p>
            <p className="mt-1 text-sm leading-6 text-emerald-50/75">
              Expected cash comes from completed cash payments for the selected day. If counted cash
              differs, finance must enter a variance note before closing.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border border-white/10 bg-slate-950/55">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <CalendarCheck2 className="h-5 w-5 text-emerald-200" />
              Close selected day
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4">
            <div className="max-w-xs space-y-2">
              <Label className="text-xs uppercase tracking-wide text-white/45">Closure date</Label>
              <Input
                type="date"
                value={closureDate}
                onChange={(event) => setClosureDate(event.target.value)}
                className="border-white/10 bg-white/[0.04] text-white"
              />
            </div>

            {cashClosure.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-white/45">Expected cash</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {formatMoney(expectedCashMinor)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {cashClosure.data?.paymentCount ?? 0} cash payment(s)
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-white/45">Counted cash</p>
                  <Input
                    value={recordedCashInput}
                    onChange={(event) => setRecordedCashInput(event.target.value)}
                    inputMode="decimal"
                    className="mt-2 border-white/10 bg-black/20 text-white"
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-white/45">Variance</p>
                  <p
                    className={cn(
                      "mt-2 text-xl font-semibold",
                      varianceMinor === 0 ? "text-emerald-100" : "text-amber-100"
                    )}
                  >
                    {formatMoney(varianceMinor)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {varianceMinor === 0 ? "No variance" : "Requires resolution note"}
                  </p>
                </div>
              </div>
            )}

            {varianceMinor !== 0 ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-white/45">
                  Variance resolution note
                </Label>
                <Input
                  value={varianceNote}
                  onChange={(event) => setVarianceNote(event.target.value)}
                  placeholder="Explain the variance before closure"
                  className="border-white/10 bg-white/[0.04] text-white"
                />
              </div>
            ) : null}

            {closure ? (
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-emerald-50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-medium">Closed for {closure.closureDate}</p>
                </div>
                <p className="mt-1 text-sm text-emerald-50/70">
                  Recorded {formatMoney(closure.recordedCashMinor)} against expected{" "}
                  {formatMoney(closure.expectedCashMinor)}.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="outline" className="border-white/10 bg-white/[0.04] text-white">
                <Link href="/admin/finance/payments">Open payment inbox</Link>
              </Button>
              <Button
                type="button"
                onClick={handleCloseCashDay}
                disabled={cashClosure.isLoading || closeCashDay.isPending || !canClose}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {closeCashDay.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarCheck2 className="mr-2 h-4 w-4" />
                )}
                Close cash day
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-slate-950/55">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="text-base text-white">Recent Closures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {cashClosure.isLoading ? (
              <>
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </>
            ) : (cashClosure.data?.recentClosures.length || 0) > 0 ? (
              cashClosure.data?.recentClosures.map((entry) => (
                <div
                  key={entry._id}
                  className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{entry.closureDate}</p>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        entry.varianceMinor === 0 ? "text-emerald-100" : "text-amber-100"
                      )}
                    >
                      {formatMoney(entry.varianceMinor)}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/45">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(entry.updatedAt), "MMM d, h:mm a")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm text-white/45">
                No previous cash closures.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

