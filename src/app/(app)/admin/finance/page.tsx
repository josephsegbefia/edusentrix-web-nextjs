"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Landmark,
  Receipt,
  Heart,
  ShoppingBag,
  Wallet,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useFinancialOverview,
  RangeType,
  TransactionDTO,
} from "@/hooks/admin/useFinancialCenter";
import { RecordTransactionModal } from "@/components/modals/RecordTransactionModal";
import { Plus } from "lucide-react";

// ========================
// Helper Functions
// ========================

function formatCurrency(amountMinor: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function getCategoryIcon(category: string) {
  const icons: Record<string, React.ReactNode> = {
    fees: <DollarSign className="h-4 w-4" />,
    store: <ShoppingBag className="h-4 w-4" />,
    fundraising: <Heart className="h-4 w-4" />,
    expenses: <Receipt className="h-4 w-4" />,
    other_income: <Wallet className="h-4 w-4" />,
  };
  return icons[category] || <DollarSign className="h-4 w-4" />;
}

function getCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    fees: "Fees",
    store: "Store",
    fundraising: "Fundraising",
    expenses: "Expenses",
    other_income: "Other Income",
    refund: "Refunds",
    adjustment: "Adjustments",
  };
  return labels[category] || category;
}

// ========================
// KPI Card Component
// ========================

function KPICard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  loading,
  color = "default",
}: {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number | null; label: string };
  loading?: boolean;
  color?: "default" | "green" | "red" | "amber" | "blue";
}) {
  const colorStyles = {
    default: "from-slate-900/60 via-slate-950/60 to-black/60",
    green: "from-emerald-900/20 via-emerald-950/20 to-black/60",
    red: "from-red-900/20 via-red-950/20 to-black/60",
    amber: "from-amber-900/20 via-amber-950/20 to-black/60",
    blue: "from-blue-900/20 via-blue-950/20 to-black/60",
  };

  const iconColorStyles = {
    default: "text-white/40",
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
  };

  if (loading) {
    return (
      <Card className={`overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br ${colorStyles.default}`}>
        <CardContent className="p-5">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br ${colorStyles[color]} shadow-lg transition-all duration-300 hover:border-white/20 hover:shadow-xl`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/50">{title}</p>
          <div className="rounded-lg bg-white/5 p-2">
            <Icon className={`h-4 w-4 ${iconColorStyles[color]}`} />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        <div className="mt-1 flex items-center justify-between">
          {subValue && <p className="text-xs text-white/40">{subValue}</p>}
          {trend && trend.value !== null && (
            <p
              className={`text-xs flex items-center gap-1 ${
                trend.value >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ========================
// Recent Transaction Row
// ========================

function TransactionRow({ transaction }: { transaction: TransactionDTO }) {
  const isInflow = transaction.direction === "inflow";

  return (
    <Link
      href={`/admin/finance/transactions/${transaction._id}`}
      className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/2 p-4 transition-all duration-200 hover:border-white/10 hover:bg-white/4"
    >
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

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">
          {transaction.description || transaction.reference || getCategoryLabel(transaction.category)}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
          <span className="capitalize">{getCategoryLabel(transaction.category)}</span>
          <span>•</span>
          <span>{format(new Date(transaction.occurredAt), "MMM d, h:mm a")}</span>
        </div>
      </div>

      {/* Amount */}
      <p
        className={`font-semibold ${
          isInflow ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isInflow ? "+" : "-"}
        {formatCurrency(transaction.netAmountMinor, transaction.currency)}
      </p>

      <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />
    </Link>
  );
}

// ========================
// Category Breakdown Card
// ========================

function CategoryBreakdownCard({
  title,
  data,
  type,
  loading,
}: {
  title: string;
  data: Record<string, { total: number; count: number }>;
  type: "inflow" | "outflow";
  loading?: boolean;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1].total - a[1].total);
  const total = entries.reduce((sum, [_, v]) => sum + v.total, 0);

  if (loading) {
    return (
      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader className="border-b border-white/5 pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
      <CardHeader className="border-b border-white/5 pb-3">
        <CardTitle className="text-base font-semibold text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {entries.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">No data for this period</p>
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 5).map(([category, values]) => {
              const percentage = total > 0 ? (values.total / total) * 100 : 0;
              return (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={type === "inflow" ? "text-emerald-400" : "text-red-400"}>
                        {getCategoryIcon(category)}
                      </span>
                      <span className="text-sm text-white/80">
                        {getCategoryLabel(category)}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(values.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        type === "inflow" ? "bg-emerald-500" : "bg-red-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========================
// Main Page Component
// ========================

export default function FinancialCenterPage() {
  const [range, setRange] = React.useState<RangeType>("this_month");
  const [compare, setCompare] = React.useState(true);
  const [recordModalOpen, setRecordModalOpen] = React.useState(false);

  const { data, isLoading, refetch } = useFinancialOverview({
    range,
    compare,
  });

  const rangeOptions: { value: RangeType; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "this_week", label: "This Week" },
    { value: "this_month", label: "This Month" },
    { value: "last_30_days", label: "Last 30 Days" },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500/20 to-indigo-600/20">
            <Landmark className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Financial Center</h1>
            <p className="mt-1 text-sm text-white/50">
              Unified view of all money movements
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PremiumSelect value={range} onValueChange={(v) => setRange(v as RangeType)}>
            <PremiumSelectTrigger className="w-[160px]">
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {rangeOptions.map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setRecordModalOpen(true)}
            className="bg-linear-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Record Transaction
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Inflow"
          value={formatCurrency(data?.kpis.totalInflow || 0)}
          subValue={`${data?.kpis.inflowCount || 0} transactions`}
          icon={ArrowDownRight}
          trend={
            compare
              ? { value: data?.kpis.inflowChange ?? null, label: "vs previous" }
              : undefined
          }
          loading={isLoading}
          color="green"
        />
        <KPICard
          title="Total Outflow"
          value={formatCurrency(data?.kpis.totalOutflow || 0)}
          subValue={`${data?.kpis.outflowCount || 0} transactions`}
          icon={ArrowUpRight}
          trend={
            compare
              ? { value: data?.kpis.outflowChange ?? null, label: "vs previous" }
              : undefined
          }
          loading={isLoading}
          color="red"
        />
        <KPICard
          title="Net Position"
          value={formatCurrency(data?.kpis.netPosition || 0)}
          subValue={data?.kpis.netPosition || 0 >= 0 ? "Positive" : "Deficit"}
          icon={BarChart3}
          loading={isLoading}
          color={(data?.kpis.netPosition || 0) >= 0 ? "blue" : "red"}
        />
        <KPICard
          title="Pending"
          value={String(data?.kpis.pendingCount || 0)}
          subValue={formatCurrency(data?.kpis.pendingAmount || 0)}
          icon={Clock}
          loading={isLoading}
          color="amber"
        />
      </div>

      {/* Alerts (if any) */}
      {(data?.kpis.failedCount || 0) > 0 && (
        <Card className="mb-6 overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">
                {data?.kpis.failedCount} Failed Transaction{data?.kpis.failedCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-red-400/70">
                Total: {formatCurrency(data?.kpis.failedAmount || 0)} - Review and take action
              </p>
            </div>
            <Link href="/admin/finance/transactions?status=failed">
              <Button variant="outline" size="sm" className="border-red-500/20 text-red-400 hover:bg-red-500/10">
                View
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Breakdowns */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <CategoryBreakdownCard
              title="Income by Category"
              data={data?.breakdowns.inflowByCategory || {}}
              type="inflow"
              loading={isLoading}
            />
            <CategoryBreakdownCard
              title="Spending by Category"
              data={data?.breakdowns.outflowByCategory || {}}
              type="outflow"
              loading={isLoading}
            />
          </div>

          {/* Quick Links */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href="/admin/finance/transactions" className="block">
              <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 transition-all hover:border-white/20 hover:bg-white/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                    <DollarSign className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">All Transactions</p>
                    <p className="text-xs text-white/40">View ledger</p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-white/20" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/expenses" className="block">
              <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 transition-all hover:border-white/20 hover:bg-white/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                    <Receipt className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Expenses</p>
                    <p className="text-xs text-white/40">Manage spending</p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-white/20" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/fees" className="block">
              <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 transition-all hover:border-white/20 hover:bg-white/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                    <DollarSign className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Fees & Payments</p>
                    <p className="text-xs text-white/40">Collect payments</p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-white/20" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Right Column - Recent Transactions */}
        <div>
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardHeader className="border-b border-white/5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white">
                  Recent Transactions
                </CardTitle>
                <Link
                  href="/admin/finance/transactions"
                  className="text-xs text-white/50 hover:text-white transition-colors"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (data?.recentTransactions.length || 0) === 0 ? (
                <div className="py-8 text-center">
                  <DollarSign className="mx-auto h-8 w-8 text-white/20" />
                  <p className="mt-2 text-sm text-white/40">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.recentTransactions.slice(0, 8).map((tx) => (
                    <TransactionRow key={tx._id} transaction={tx} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Record Transaction Modal */}
      <RecordTransactionModal
        open={recordModalOpen}
        onOpenChange={setRecordModalOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
