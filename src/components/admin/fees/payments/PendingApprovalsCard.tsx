/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/fees/money";
import { Clock, ChevronRight } from "lucide-react";
import { usePendingPayments } from "@/hooks/admin/usePendingPayments";

export function PendingApprovalsCard(props: {
  studentId: string;
  invoiceId?: string | null;
  academicPeriodId?: string | null;
  onOpenPayment: (paymentId: string) => void;
}) {
  const { data, isLoading } = usePendingPayments({
    studentId: props.studentId,
    invoiceId: props.invoiceId || undefined,
    academicPeriodId: props.academicPeriodId || undefined,
    limit: 5,
    page: 1,
  });

  const items = data?.payments ?? [];

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/10 via-amber-500/0 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-white/80">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/60" />
            Pending approvals
          </span>
          <Badge
            variant="outline"
            className="border-amber-400/20 bg-amber-500/10 text-amber-200"
          >
            {isLoading ? "…" : items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-2">
        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
            No pending proof payments for this student.
          </div>
        ) : (
          items.map((p: any) => (
            <div
              key={p._id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white/85">
                  {formatMoney(p.amountMinor)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {String(p.paymentMethod).replaceAll("_", " ")} •{" "}
                  {p.receiptNumber || "—"}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => props.onOpenPayment(p._id)}
              >
                Review <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
