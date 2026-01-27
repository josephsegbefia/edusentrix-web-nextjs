/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  Receipt,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";
import { useStudentPayments } from "@/hooks/admin/useStudentPayments";
import { PaymentDetailsDrawer } from "@/components/admin/fees/payments/PaymentDetailsDrawer";
import { premiumMenuContent } from "@/components/ui/premium";

type Props = {
  studentId: string;
  invoiceId?: string | null;
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
    completed: {
      label: "Completed",
      className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      icon: CheckCircle2,
    },
    reversed: {
      label: "Reversed",
      className: "border-red-400/25 bg-red-500/10 text-red-200",
      icon: XCircle,
    },
    failed: {
      label: "Failed",
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

function paymentMethodBadge(method: string) {
  return (
    <Badge
      className="border-white/10 bg-white/5 text-xs text-white/70"
      variant="outline"
    >
      <CreditCard className="mr-1 h-3 w-3" />
      {method}
    </Badge>
  );
}

export function PaymentHistory({ studentId, invoiceId }: Props) {
  const [paymentMethodFilter, setPaymentMethodFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"date" | "amount" | "status">("date");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [selectedPaymentId, setSelectedPaymentId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const { data, isLoading, isError } = useStudentPayments(studentId, {
    invoiceId: invoiceId || undefined,
    paymentMethod: paymentMethodFilter !== "all" ? paymentMethodFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit: 20,
  });

  const payments = data?.payments ?? [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  const paymentMethodLabel =
    paymentMethodFilter === "all"
      ? "All methods"
      : String(paymentMethodFilter).replaceAll("_", " ");
  const statusLabel =
    statusFilter === "all"
      ? "All status"
      : String(statusFilter).replaceAll("_", " ");

  // Client-side search and sorting
  const filteredAndSorted = React.useMemo(() => {
    let result = [...payments];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p: any) =>
          p.receiptNumber?.toLowerCase().includes(query) ||
          p.invoiceId?.invoiceNumber?.toLowerCase().includes(query) ||
          p.paymentMethod?.toLowerCase().includes(query)
      );
    }

    // Sorting
    result.sort((a: any, b: any) => {
      let comparison = 0;
      if (sortBy === "date") {
        comparison =
          new Date(a.paymentDate || 0).getTime() -
          new Date(b.paymentDate || 0).getTime();
      } else if (sortBy === "amount") {
        comparison = (a.amountMinor || 0) - (b.amountMinor || 0);
      } else if (sortBy === "status") {
        comparison = (a.status || "").localeCompare(b.status || "");
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [payments, searchQuery, sortBy, sortOrder]);

  const handlePaymentClick = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setDrawerOpen(true);
  };

  const handleSort = (field: "date" | "amount" | "status") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Payment History
            </CardTitle>
            {summary && (
              <div className="text-xs text-muted-foreground">
                {summary.paymentCount} payments • {formatMoney(summary.totalPaid)} total
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-muted-foreground">Total Paid</div>
                <div className="mt-1 text-sm font-semibold text-emerald-200">
                  {formatMoney(summary.totalPaid)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-muted-foreground">Avg Payment Time</div>
                <div className="mt-1 text-sm font-semibold text-white/90">
                  {summary.averagePaymentTime} days
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-muted-foreground">Total Payments</div>
                <div className="mt-1 text-sm font-semibold text-white/90">
                  {summary.paymentCount}
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center justify-between rounded-full border-white/15 bg-white/5 px-3 text-xs text-white/80 sm:w-[190px]"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {paymentMethodLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-white/50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={premiumMenuContent} align="start">
                <DropdownMenuItem onClick={() => setPaymentMethodFilter("all")}>
                  All methods
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPaymentMethodFilter("cash")}>
                  Cash
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPaymentMethodFilter("bank_transfer")}>
                  Bank Transfer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPaymentMethodFilter("mobile_money")}>
                  Mobile Money
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPaymentMethodFilter("cheque")}>
                  Cheque
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPaymentMethodFilter("paystack")}>
                  Paystack
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPaymentMethodFilter("other")}>
                  Other
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center justify-between rounded-full border-white/15 bg-white/5 px-3 text-xs text-white/80 sm:w-[190px]"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {statusLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-white/50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={premiumMenuContent} align="start">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("completed")}>
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("reversed")}>
                  Reversed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("failed")}>
                  Failed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Sort by:</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSort("date")}
              className={cn(
                "h-7 px-2 text-xs",
                sortBy === "date"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              Date
              {sortBy === "date" &&
                (sortOrder === "asc" ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                ))}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSort("amount")}
              className={cn(
                "h-7 px-2 text-xs",
                sortBy === "amount"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              Amount
              {sortBy === "amount" &&
                (sortOrder === "asc" ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                ))}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSort("status")}
              className={cn(
                "h-7 px-2 text-xs",
                sortBy === "status"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              Status
              {sortBy === "status" &&
                (sortOrder === "asc" ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                ))}
            </Button>
          </div>

          {/* Payment list */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
              <Clock className="h-5 w-5 animate-spin" />
              Loading payments...
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
              Failed to load payments. Please try again.
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <Receipt className="mx-auto h-12 w-12 text-white/20" />
              <p className="mt-3 text-sm font-medium text-white/80">
                No payments found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery || statusFilter !== "all" || paymentMethodFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No payments have been recorded yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAndSorted.map((payment: any) => (
                <button
                  key={payment._id}
                  type="button"
                  onClick={() => handlePaymentClick(payment._id)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-white/90">
                          {formatMoney(payment.amountMinor)}
                        </div>
                        {statusBadge(payment.status)}
                        {paymentMethodBadge(payment.paymentMethod)}
                        {payment.receiptNumber && (
                          <Badge
                            className="border-white/10 bg-white/5 text-xs"
                            variant="outline"
                          >
                            {payment.receiptNumber}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {fmtDate(payment.paymentDate)}
                        </div>
                        {payment.invoiceId?.invoiceNumber && (
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            {payment.invoiceId.invoiceNumber}
                          </div>
                        )}
                        {payment.allocations && payment.allocations.length > 0 && (
                          <div className="text-xs">
                            {payment.allocations.length} allocation
                            {payment.allocations.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <div className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 bg-white/5 text-xs"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="border-white/10 bg-white/5 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        paymentId={selectedPaymentId}
      />
    </>
  );
}
