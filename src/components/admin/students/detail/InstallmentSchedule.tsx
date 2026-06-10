/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useStudentInstallments } from "@/hooks/admin/useStudentInstallments";

type Props = {
  studentId: string;
};

function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function statusBadge(status: string) {
  const statusMap: Record<string, { label: string; className: string; icon: any }> = {
    pending: {
      label: "Pending",
      className: "border-amber-400/25 bg-amber-500/10 text-amber-200",
      icon: Clock,
    },
    partially_paid: {
      label: "Partially Paid",
      className: "border-blue-400/25 bg-blue-500/10 text-blue-200",
      icon: TrendingUp,
    },
    paid: {
      label: "Paid",
      className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      icon: CheckCircle2,
    },
    overdue: {
      label: "Overdue",
      className: "border-red-400/25 bg-red-500/10 text-red-200",
      icon: AlertCircle,
    },
  };

  const config = statusMap[status] || statusMap.pending;
  const Icon = config.icon;

  return (
    <Badge className={cn("gap-1.5", config.className)} variant="outline">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function getDueStatus(dueDate: string | Date): "upcoming" | "due_soon" | "overdue" | "paid" {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 7) return "due_soon";
  return "upcoming";
}

export function InstallmentSchedule({ studentId }: Props) {
  const { data, isLoading, isError } = useStudentInstallments(studentId, {
    upcomingOnly: false,
  });

  const installments = data?.installments ?? [];
  const summary = data?.summary;

  // Group installments by status
  const grouped = React.useMemo(() => {
    const groups: Record<string, any[]> = {
      overdue: [],
      due_soon: [],
      upcoming: [],
      paid: [],
    };

    installments.forEach((inst: any) => {
      if (inst.status === "paid") {
        groups.paid.push(inst);
      } else {
        const dueStatus = getDueStatus(inst.dueDate);
        groups[dueStatus].push(inst);
      }
    });

    // Sort each group by due date
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        return dateA - dateB;
      });
    });

    return groups;
  }, [installments]);

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
            Installment Schedule
          </CardTitle>
          {summary && (
            <div className="text-xs text-muted-foreground">
              {summary.totalInstallments} installments •{" "}
              {formatMoney(summary.totalDue)} due
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="mt-1 text-sm font-semibold text-white/90">
                {summary.totalInstallments}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="mt-1 text-sm font-semibold text-emerald-200">
                {summary.paidInstallments}
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="mt-1 text-sm font-semibold text-amber-200">
                {summary.pendingInstallments}
              </div>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <div className="text-xs text-muted-foreground">Overdue</div>
              <div className="mt-1 text-sm font-semibold text-red-200">
                {summary.overdueInstallments}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            Loading installments...
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
            Failed to load installments. Please try again.
          </div>
        ) : installments.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/80">
              No installments found
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Installments will appear here when bills are created with installment plans
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overdue */}
            {grouped.overdue.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  Overdue ({grouped.overdue.length})
                </h3>
                <div className="space-y-2">
                  {grouped.overdue.map((inst: any) => (
                    <InstallmentCard key={inst._id} installment={inst} />
                  ))}
                </div>
              </div>
            )}

            {/* Due Soon */}
            {grouped.due_soon.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                  <Clock className="h-4 w-4" />
                  Due Soon ({grouped.due_soon.length})
                </h3>
                <div className="space-y-2">
                  {grouped.due_soon.map((inst: any) => (
                    <InstallmentCard key={inst._id} installment={inst} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {grouped.upcoming.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Calendar className="h-4 w-4" />
                  Upcoming ({grouped.upcoming.length})
                </h3>
                <div className="space-y-2">
                  {grouped.upcoming.map((inst: any) => (
                    <InstallmentCard key={inst._id} installment={inst} />
                  ))}
                </div>
              </div>
            )}

            {/* Paid */}
            {grouped.paid.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Paid ({grouped.paid.length})
                </h3>
                <div className="space-y-2">
                  {grouped.paid.map((inst: any) => (
                    <InstallmentCard key={inst._id} installment={inst} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next Due Date */}
        {summary?.nextDueDate && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Next Due Date</div>
                <div className="mt-1 text-sm font-semibold text-white/90">
                  {fmtDate(summary.nextDueDate)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total Due</div>
                <div className="mt-1 text-sm font-semibold text-amber-200">
                  {formatMoney(summary.totalDue)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InstallmentCard({ installment }: { installment: any }) {
  const dueStatus = getDueStatus(installment.dueDate);
  const isOverdue = dueStatus === "overdue" && installment.status !== "paid";
  const progress = installment.amountMinor > 0
    ? (installment.amountPaidMinor / installment.amountMinor) * 100
    : 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all",
        isOverdue
          ? "border-red-500/30 bg-red-500/5"
          : "border-white/10 bg-white/5"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <div className="font-medium text-white/90">
              {installment.lineItemName || "Installment"}
            </div>
            {statusBadge(installment.status)}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {installment.invoiceNumber && (
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {installment.invoiceNumber}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Due: {fmtDate(installment.dueDate)}
            </div>
            {installment.periodLabel && (
              <div className="text-xs">{installment.periodLabel}</div>
            )}
          </div>
          {installment.status !== "paid" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-white/80">
                  {formatMoney(installment.amountPaidMinor)} /{" "}
                  {formatMoney(installment.amountMinor)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          )}
          {installment.payments && installment.payments.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              {installment.payments.length} payment
              {installment.payments.length !== 1 ? "s" : ""} recorded
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-white/90">
            {formatMoney(installment.amountMinor)}
          </div>
          {installment.amountOutstandingMinor > 0 && (
            <div className="mt-1 text-xs text-amber-300">
              Outstanding: {formatMoney(installment.amountOutstandingMinor)}
            </div>
          )}
          {installment.amountPaidMinor > 0 && (
            <div className="mt-1 text-xs text-emerald-300">
              Paid: {formatMoney(installment.amountPaidMinor)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
