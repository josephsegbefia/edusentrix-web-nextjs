// src/components/admin/fees/InstallmentScheduleView.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/fees/money";
import { Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type InstallmentSchedule = {
  _id: string;
  installmentNumber: number;
  dueDate: string | Date;
  amountMinor: number;
  amountPaidMinor: number;
  amountOutstandingMinor: number;
  status: "pending" | "partially_paid" | "paid" | "overdue";
};

type Props = {
  lineItemId: string;
  lineItemName: string;
  installments: InstallmentSchedule[];
};

export function InstallmentScheduleView({ lineItemId, lineItemName, installments }: Props) {
  if (!installments || installments.length === 0) {
    return null;
  }

  const getStatusBadge = (status: string, dueDate: Date) => {
    const isOverdue = status === "overdue" || (status === "pending" && new Date(dueDate) < new Date());

    if (status === "paid") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    }

    if (status === "partially_paid") {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Partially Paid
        </Badge>
      );
    }

    if (isOverdue) {
      return (
        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>
      );
    }

    return (
      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getProgressPercentage = (paid: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((paid / total) * 100, 100);
  };

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/5 via-indigo-500/2 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 pb-3">
        <CardTitle className="text-sm font-semibold text-white">
          Installment Schedule: {lineItemName}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-3">
        {installments.map((installment) => {
          const dueDate = new Date(installment.dueDate);
          const isOverdue = installment.status === "overdue" ||
            (installment.status === "pending" && dueDate < new Date());

          return (
            <div
              key={installment._id}
              className={cn(
                "rounded-lg border p-4 space-y-3 transition-all",
                isOverdue
                  ? "border-rose-500/30 bg-rose-500/5"
                  : "border-white/10 bg-white/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-brand font-semibold text-sm">
                    {installment.installmentNumber}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Installment {installment.installmentNumber}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Calendar className="h-3 w-3" />
                      Due: {dueDate.toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {getStatusBadge(installment.status, dueDate)}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">Amount</span>
                  <span className="font-semibold text-white">
                    {formatMoney(installment.amountMinor)}
                  </span>
                </div>

                {installment.amountPaidMinor > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Paid</span>
                      <span className="text-emerald-300">
                        {formatMoney(installment.amountPaidMinor)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                        style={{
                          width: `${getProgressPercentage(
                            installment.amountPaidMinor,
                            installment.amountMinor
                          )}%`,
                        }}
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between text-sm pt-1 border-t border-white/10">
                  <span className="text-white/80">Outstanding</span>
                  <span className={cn(
                    "font-semibold",
                    installment.amountOutstandingMinor > 0
                      ? isOverdue
                        ? "text-rose-300"
                        : "text-orange-300"
                      : "text-emerald-300"
                  )}>
                    {formatMoney(installment.amountOutstandingMinor)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
