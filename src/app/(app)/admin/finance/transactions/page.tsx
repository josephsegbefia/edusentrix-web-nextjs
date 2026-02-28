"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns/format";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  DollarSign,
  RefreshCw,
  Eye,
  Download,
  MoreHorizontal,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { formatCurrency } from "@/lib/fees/money";
import {
  useFinancialTransactions,
  TransactionDTO,
  TransactionStatus,
  TransactionCategory,
} from "@/hooks/admin/useFinancialCenter";

// ========================
// Helper Functions
// ========================

function getStatusBadge(status: TransactionStatus) {
  const config: Record<
    TransactionStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
  > = {
    pending: {
      label: "Pending",
      variant: "outline",
      icon: <Clock className="h-3 w-3" />,
    },
    processing: {
      label: "Processing",
      variant: "outline",
      icon: <Clock className="h-3 w-3 animate-spin" />,
    },
    success: {
      label: "Success",
      variant: "default",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    failed: {
      label: "Failed",
      variant: "destructive",
      icon: <XCircle className="h-3 w-3" />,
    },
    refunded: {
      label: "Refunded",
      variant: "secondary",
      icon: <ArrowUpRight className="h-3 w-3" />,
    },
    reversed: {
      label: "Reversed",
      variant: "secondary",
      icon: <X className="h-3 w-3" />,
    },
    voided: {
      label: "Voided",
      variant: "secondary",
      icon: <Ban className="h-3 w-3" />,
    },
    disputed: {
      label: "Disputed",
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3" />,
    },
    held: {
      label: "Held",
      variant: "outline",
      icon: <AlertCircle className="h-3 w-3" />,
    },
  };

  const { label, variant, icon } = config[status] || config.pending;
  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {label}
    </Badge>
  );
}

function getCategoryLabel(category: TransactionCategory | string) {
  const labels: Record<string, string> = {
    fees: "Fees",
    store: "Store",
    fundraising: "Fundraising",
    expenses: "Expenses",
    other_income: "Other Income",
    refund: "Refund",
    adjustment: "Adjustment",
    gateway_fee: "Gateway Fee",
    bank_charge: "Bank Charge",
    penalty: "Penalty",
    discount: "Discount",
  };
  return labels[category] || category;
}

function getMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Cash",
    mobile_money: "Mobile Money",
    bank_transfer: "Bank Transfer",
    card: "Card",
    cheque: "Cheque",
    other: "Other",
  };
  return labels[method] || method;
}

function getReconciliationBadge(
  status?: "unmatched" | "matched" | "disputed" | "ignored" | string
) {
  const normalizedStatus = status || "unmatched";
  if (normalizedStatus === "matched") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      >
        Matched
      </Badge>
    );
  }
  if (normalizedStatus === "disputed") {
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 bg-red-500/10 text-red-300"
      >
        Disputed
      </Badge>
    );
  }
  if (normalizedStatus === "ignored") {
    return (
      <Badge
        variant="outline"
        className="border-slate-500/30 bg-slate-500/10 text-slate-300"
      >
        Ignored
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500/30 bg-amber-500/10 text-amber-200"
    >
      Unmatched
    </Badge>
  );
}

// ========================
// Transaction Row Component
// ========================

function TransactionRow({
  transaction,
  onView,
}: {
  transaction: TransactionDTO;
  onView: () => void;
}) {
  const isInflow = transaction.direction === "inflow";

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/2 p-4 transition-all duration-200 hover:border-white/10 hover:bg-white/4">
      {/* Direction Icon */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isInflow
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-red-500/10 text-red-400"
        }`}
      >
        {isInflow ? (
          <ArrowDownRight className="h-5 w-5" />
        ) : (
          <ArrowUpRight className="h-5 w-5" />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white truncate">
            {transaction.description || transaction.reference || getCategoryLabel(transaction.category)}
          </p>
          {getReconciliationBadge(transaction.reconciliation?.status)}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
          <span>{getCategoryLabel(transaction.category)}</span>
          <span>•</span>
          <span>{getMethodLabel(transaction.method)}</span>
          <span>•</span>
          <span>{format(new Date(transaction.occurredAt), "MMM d, yyyy h:mm a")}</span>
        </div>
      </div>

      {/* Party */}
      {transaction.party && (
        <div className="hidden sm:block text-right">
          <p className="text-sm text-white/80 truncate max-w-[150px]">
            {transaction.party.name}
          </p>
          <p className="text-xs text-white/40 capitalize">{transaction.party.type}</p>
        </div>
      )}

      {/* Amount */}
      <div className="text-right min-w-[100px]">
        <p className={`font-semibold ${isInflow ? "text-emerald-400" : "text-red-400"}`}>
          {isInflow ? "+" : "-"}
          {formatCurrency(transaction.netAmountMinor, { currency: transaction.currency })}
        </p>
        {transaction.feeAmountMinor > 0 && (
          <p className="text-xs text-white/40">
            Fee: {formatCurrency(transaction.feeAmountMinor, { currency: transaction.currency })}
          </p>
        )}
      </div>

      {/* Status */}
      <div className="hidden lg:flex w-28 justify-center">
        {getStatusBadge(transaction.status)}
      </div>

      {/* Actions */}
      <PremiumDropdownMenu>
        <PremiumDropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PremiumDropdownMenuTrigger>
        <PremiumDropdownMenuContent align="end">
          <PremiumDropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </PremiumDropdownMenuItem>
        </PremiumDropdownMenuContent>
      </PremiumDropdownMenu>
    </div>
  );
}

// ========================
// Main Page Component
// ========================

export default function TransactionsLedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get initial filters from URL
  const initialStatus = searchParams.get("status") || "all";
  const initialDirection = searchParams.get("direction") || "all";
  const initialCategory = searchParams.get("category") || "all";
  const initialReconciliationStatus =
    searchParams.get("reconciliationStatus") || "all";

  // Filters state
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState(initialStatus);
  const [directionFilter, setDirectionFilter] = React.useState(initialDirection);
  const [categoryFilter, setCategoryFilter] = React.useState(initialCategory);
  const [reconciliationFilter, setReconciliationFilter] = React.useState(
    initialReconciliationStatus
  );
  const [page, setPage] = React.useState(1);

  // Build filters
  const filters = React.useMemo(() => ({
    q: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    direction: directionFilter !== "all" ? directionFilter : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    reconciliationStatus:
      reconciliationFilter !== "all" ? reconciliationFilter : undefined,
    page,
    limit: 20,
    sortBy: "occurredAt",
    sortOrder: "desc" as const,
  }), [search, statusFilter, directionFilter, categoryFilter, reconciliationFilter, page]);

  const { data, isLoading, refetch } = useFinancialTransactions(filters);

  const transactions = data?.data || [];

  // Export handler
  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.direction) params.set("direction", filters.direction);
    if (filters.category) params.set("category", filters.category);
    if (filters.reconciliationStatus) {
      params.set("reconciliationStatus", filters.reconciliationStatus);
    }
    params.set("format", "csv");

    // Trigger download
    const url = `/api/admin/finance/transactions/export?${params}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const pagination = data?.pagination;

  const handleViewTransaction = (id: string) => {
    router.push(`/admin/finance/transactions/${id}`);
  };

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "success", label: "Success" },
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "failed", label: "Failed" },
    { value: "refunded", label: "Refunded" },
    { value: "reversed", label: "Reversed" },
  ];

  const directionOptions = [
    { value: "all", label: "All Directions" },
    { value: "inflow", label: "Inflows" },
    { value: "outflow", label: "Outflows" },
  ];

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    { value: "fees", label: "Fees" },
    { value: "expenses", label: "Expenses" },
    { value: "fundraising", label: "Fundraising" },
    { value: "store", label: "Store" },
    { value: "other_income", label: "Other Income" },
    { value: "refund", label: "Refunds" },
    { value: "adjustment", label: "Adjustments" },
  ];

  const reconciliationOptions = [
    { value: "all", label: "All Reconciliation" },
    { value: "unmatched", label: "Unmatched" },
    { value: "matched", label: "Matched" },
    { value: "disputed", label: "Disputed" },
    { value: "ignored", label: "Ignored" },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/finance")}
            className="h-9 w-9 cursor-pointer border border-white/10 bg-white/5 transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-white/10 hover:shadow-md hover:shadow-black/20 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Transactions Ledger</h1>
            <p className="mt-1 text-sm text-white/50">
              Complete record of all financial transactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport()}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search by reference, description, or party..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 border-white/10 bg-white/5 text-white placeholder:text-white/40"
              />
            </div>

            {/* Direction Filter */}
            <PremiumSelect
              value={directionFilter}
              onValueChange={(v) => {
                setDirectionFilter(v);
                setPage(1);
              }}
            >
              <PremiumSelectTrigger className="w-[150px]">
                <PremiumSelectValue placeholder="Direction" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {directionOptions.map((opt) => (
                  <PremiumSelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            {/* Status Filter */}
            <PremiumSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <PremiumSelectTrigger className="w-[150px]">
                <PremiumSelectValue placeholder="Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {statusOptions.map((opt) => (
                  <PremiumSelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            {/* Category Filter */}
            <PremiumSelect
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
              }}
            >
              <PremiumSelectTrigger className="w-[160px]">
                <PremiumSelectValue placeholder="Category" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {categoryOptions.map((opt) => (
                  <PremiumSelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            {/* Reconciliation Filter */}
            <PremiumSelect
              value={reconciliationFilter}
              onValueChange={(v) => {
                setReconciliationFilter(v);
                setPage(1);
              }}
            >
              <PremiumSelectTrigger className="w-[180px]">
                <PremiumSelectValue placeholder="Reconciliation" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {reconciliationOptions.map((opt) => (
                  <PremiumSelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-lg font-semibold text-white">
            {pagination?.total
              ? `${pagination.total} Transaction${pagination.total !== 1 ? "s" : ""}`
              : "Transactions"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <DollarSign className="h-8 w-8 text-white/30" />
              </div>
              <h3 className="text-lg font-medium text-white">No transactions found</h3>
              <p className="mt-1 text-sm text-white/50">
                {search || statusFilter !== "all" || directionFilter !== "all" || categoryFilter !== "all"
                  || reconciliationFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Transactions will appear here as they occur"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx._id}
                  transaction={tx}
                  onView={() => handleViewTransaction(tx._id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
              <p className="text-sm text-white/50">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} transactions
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 bg-white/5"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="border-white/10 bg-white/5"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
