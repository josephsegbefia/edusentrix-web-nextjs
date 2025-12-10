"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Receipt, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type Props = {
  student: StudentDetailDTO;
};

export function StudentFeesTab({ student }: Props) {
  const { feesSummary, feeTimeline } = student;

  const hasSummary = Boolean(feesSummary);
  const hasTimeline = feeTimeline && feeTimeline.length > 0;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)]">
      {/* Left: summary + statement */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Fee Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 grid gap-3 text-xs md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">
                Total Billed
              </div>
              <div className="mt-1 text-base font-semibold">
                {feesSummary
                  ? `${
                      feesSummary.currency
                    } ${feesSummary.totalBilled.toLocaleString()}`
                  : "--"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                {feesSummary?.currentTermLabel ?? "Current term"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">
                Total Paid
              </div>
              <div className="mt-1 text-base font-semibold">
                {feesSummary
                  ? `${
                      feesSummary.currency
                    } ${feesSummary.totalPaid.toLocaleString()}`
                  : "--"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                {feesSummary?.lastPaymentDate
                  ? `Last paid on ${new Date(
                      feesSummary.lastPaymentDate
                    ).toLocaleDateString()}`
                  : "No payments on record"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">
                Outstanding
              </div>
              <div className="mt-1 text-base font-semibold">
                {feesSummary
                  ? `${
                      feesSummary.currency
                    } ${feesSummary.totalOutstanding.toLocaleString()}`
                  : "--"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                {feesSummary?.status
                  ? feesSummary.status === "clear"
                    ? "All fees cleared"
                    : feesSummary.status === "partial"
                    ? "Partially paid"
                    : "Owing fees"
                  : "No fee data yet"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 flex items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Fee Statement
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-black/40 text-[11px]"
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Export Statement
            </Button>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3 text-xs">
            {!hasSummary && !hasTimeline ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-6 text-center text-[11px] text-muted-foreground/90">
                No fee records are available yet for this student. Once fee
                invoices and payments are recorded, they&apos;ll appear here as
                a timeline of all transactions.
              </div>
            ) : (
              <div className="space-y-2">
                {feeTimeline?.map((entry) => {
                  const isInvoice = entry.type === "invoice";
                  const isPayment = entry.type === "payment";
                  const icon = isInvoice ? (
                    <ArrowUpCircle className="h-4 w-4" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4" />
                  );

                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-white/90",
                          isInvoice && "border-amber-400/70 bg-amber-500/15",
                          isPayment && "border-emerald-400/70 bg-emerald-500/15"
                        )}
                      >
                        {icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-medium">
                            {entry.label}
                          </div>
                          <div className="text-[11px] font-semibold">
                            {feesSummary
                              ? `${
                                  feesSummary.currency
                                } ${entry.amount.toLocaleString()}`
                              : entry.amount.toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                          <span>
                            {new Date(entry.date).toLocaleString()}{" "}
                            {entry.termLabel ? `• ${entry.termLabel}` : null}
                          </span>
                          {entry.method && (
                            <Badge className="bg-white/10 text-[10px]">
                              {entry.method}
                            </Badge>
                          )}
                          {entry.status && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-white/20 bg-black/20 text-[10px]",
                                entry.status === "paid" &&
                                  "border-emerald-400/60 text-emerald-100",
                                entry.status === "overdue" &&
                                  "border-red-400/60 text-red-100"
                              )}
                            >
                              {entry.status.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: future installments / notes */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Installments & Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 text-[11px] text-muted-foreground/85">
            <p>
              This area will display upcoming and past installment schedules
              once the fee engine is connected. You&apos;ll also be able to add
              internal notes about discussions with parents and special fee
              arrangements.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
