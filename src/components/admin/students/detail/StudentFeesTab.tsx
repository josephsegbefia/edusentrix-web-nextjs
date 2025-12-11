"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type Props = {
  student: StudentDetailDTO;
};

export function StudentFeesTab({ student }: Props) {
  const { feesSummary, feeTimeline } = student;

  const hasSummary = Boolean(feesSummary);
  const hasTimeline = feeTimeline && feeTimeline.length > 0;

  return (
    <div className="mt-4 space-y-6">
      {/* Premium Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/10 via-blue-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-400/30">
                <DollarSign className="h-4 w-4 text-blue-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Total Billed
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {feesSummary
                ? `${
                    feesSummary.currency
                  } ${feesSummary.totalBilled.toLocaleString()}`
                : "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              {feesSummary?.currentTermLabel ?? "Current term"}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Total Paid
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {feesSummary
                ? `${
                    feesSummary.currency
                  } ${feesSummary.totalPaid.toLocaleString()}`
                : "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              {feesSummary?.lastPaymentDate
                ? `Last paid on ${new Date(
                    feesSummary.lastPaymentDate
                  ).toLocaleDateString()}`
                : "No payments on record"}
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur",
            feesSummary?.status === "clear" && "border-emerald-400/20",
            feesSummary?.status === "owing" && "border-red-400/20"
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-linear-to-br",
              feesSummary?.status === "clear"
                ? "from-emerald-500/10 via-emerald-500/5 to-transparent"
                : feesSummary?.status === "owing"
                ? "from-red-500/10 via-red-500/5 to-transparent"
                : "from-amber-500/10 via-amber-500/5 to-transparent"
            )}
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border",
                  feesSummary?.status === "clear"
                    ? "bg-emerald-500/20 border-emerald-400/30"
                    : feesSummary?.status === "owing"
                    ? "bg-red-500/20 border-red-400/30"
                    : "bg-amber-500/20 border-amber-400/30"
                )}
              >
                <Wallet
                  className={cn(
                    "h-4 w-4",
                    feesSummary?.status === "clear"
                      ? "text-emerald-200"
                      : feesSummary?.status === "owing"
                      ? "text-red-200"
                      : "text-amber-200"
                  )}
                />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Outstanding
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {feesSummary
                ? `${
                    feesSummary.currency
                  } ${feesSummary.totalOutstanding.toLocaleString()}`
                : "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              {feesSummary?.status
                ? feesSummary.status === "clear"
                  ? "All fees cleared"
                  : feesSummary.status === "partial"
                  ? "Partially paid"
                  : "Owing fees"
                : "No fee data yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fee Statement */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <Receipt className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Fee Statement
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer border border-white/20 bg-black/40 text-[11px] text-white/80 transition-all duration-200 hover:scale-105 hover:border-emerald-400/50 hover:bg-emerald-500/20 hover:text-emerald-100 hover:shadow-md hover:shadow-emerald-500/20 active:scale-95"
          >
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            Export Statement
          </Button>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3 text-xs">
          {!hasSummary && !hasTimeline ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-[11px] text-muted-foreground/90">
                No fee records are available yet for this student.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Once fee invoices and payments are recorded, they&apos;ll appear
                here as a timeline of all transactions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {feeTimeline?.map((entry) => {
                const isInvoice = entry.type === "invoice";
                const isPayment = entry.type === "payment";
                const Icon = isInvoice ? ArrowUpCircle : ArrowDownCircle;

                return (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3 transition-all hover:border-white/20 hover:bg-black/40"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        isInvoice && "border-amber-400/50 bg-amber-500/20",
                        isPayment && "border-emerald-400/50 bg-emerald-500/20"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isInvoice ? "text-amber-200" : "text-emerald-200"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold text-foreground">
                            {entry.label}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                            <span>{new Date(entry.date).toLocaleString()}</span>
                            {entry.termLabel && (
                              <>
                                <span>•</span>
                                <span>{entry.termLabel}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div className="text-[11px] font-bold text-foreground">
                            {feesSummary
                              ? `${
                                  feesSummary.currency
                                } ${entry.amount.toLocaleString()}`
                              : entry.amount.toLocaleString()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {entry.method && (
                              <Badge className="bg-white/10 text-[9px] border-white/20">
                                {entry.method}
                              </Badge>
                            )}
                            {entry.status && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] border",
                                  entry.status === "paid" &&
                                    "border-emerald-400/60 bg-emerald-500/10 text-emerald-100",
                                  entry.status === "overdue" &&
                                    "border-red-400/60 bg-red-500/10 text-red-100"
                                )}
                              >
                                {entry.status.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installments & Notes */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-500/5 via-cyan-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-400/30">
              <Receipt className="h-4 w-4 text-cyan-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Installments & Notes
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-[11px] text-muted-foreground/90">
              This area will display upcoming and past installment schedules
              once the fee engine is connected.
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              You&apos;ll also be able to add internal notes about discussions
              with parents and special fee arrangements.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
