// src/app/(app)/parent/payments/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  AlertTriangle,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Receipt,
  Users,
  TrendingUp,
  Banknote,
} from "lucide-react";
import { useParentPayments } from "@/hooks/parent/useParentPayments";
import type { PaymentRecord } from "@/hooks/parent/useParentPayments";
import { format, parseISO } from "date-fns";

/* --------------------------------------------------------------------------------
   Helpers
-------------------------------------------------------------------------------- */
function formatCurrency(amount: number): string {
  return `GH₵ ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  bank_transfer: Receipt,
  mobile_money: CreditCard,
  momo: CreditCard,
};

function getMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    bank_transfer: "Bank Transfer",
    mobile_money: "Mobile Money",
    momo: "Mobile Money",
    cheque: "Cheque",
  };
  return labels[method.toLowerCase()] || method;
}

/* --------------------------------------------------------------------------------
   Summary Cards
-------------------------------------------------------------------------------- */
function SummaryCard({
  icon: Icon,
  label,
  value,
  subLabel,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subLabel?: string;
  tone: "emerald" | "blue" | "purple" | "cyan";
}) {
  const tones = {
    emerald: {
      gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20 border-emerald-500/30",
      iconColor: "text-emerald-300",
    },
    blue: {
      gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
      iconBg: "bg-blue-500/20 border-blue-500/30",
      iconColor: "text-blue-300",
    },
    purple: {
      gradient: "from-purple-500/15 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/20 border-purple-500/30",
      iconColor: "text-purple-300",
    },
    cyan: {
      gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
      iconBg: "bg-cyan-500/20 border-cyan-500/30",
      iconColor: "text-cyan-300",
    },
  };

  const style = tones[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-lg shadow-black/30 backdrop-blur-xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60",
          style.gradient
        )}
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border",
              style.iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", style.iconColor)} />
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-white/50">
            {label}
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight text-white">
          {value}
        </div>
        {subLabel && <p className="text-xs text-white/50">{subLabel}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Payment Row
-------------------------------------------------------------------------------- */
function PaymentRow({ payment }: { payment: PaymentRecord }) {
  const methodKey = payment.method.toLowerCase();
  const MethodIcon = METHOD_ICONS[methodKey] || CreditCard;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30">
        <CheckCircle2 className="h-6 w-6 text-emerald-300" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white truncate">{payment.invoiceTitle}</h3>
          <Badge variant="outline" className="bg-white/5 text-white/60 border-white/20 text-[10px]">
            {payment.wardName}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(parseISO(payment.date), "MMM d, yyyy")}
          </span>
          <span className="flex items-center gap-1">
            <MethodIcon className="h-3 w-3" />
            {getMethodLabel(payment.method)}
          </span>
          {payment.reference && (
            <span className="truncate max-w-32">
              Ref: {payment.reference}
            </span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-lg font-bold text-emerald-300">{formatCurrency(payment.amount)}</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Main Content
-------------------------------------------------------------------------------- */
function PaymentsPageContent() {
  const router = useRouter();

  const [selectedWard, setSelectedWard] = React.useState<string>("all");
  const [selectedYear, setSelectedYear] = React.useState<string>("all");
  const [offset, setOffset] = React.useState(0);
  const [loadedPayments, setLoadedPayments] = React.useState<PaymentRecord[]>([]);

  const wardId = selectedWard !== "all" ? selectedWard : undefined;
  const year = selectedYear !== "all" ? selectedYear : undefined;
  const limit = 50;

  const { data, isLoading, error, isFetching } = useParentPayments({
    wardId,
    year,
    limit,
    offset,
  });

  React.useEffect(() => {
    setOffset(0);
    setLoadedPayments([]);
  }, [wardId, year]);

  React.useEffect(() => {
    if (!data?.payments) return;
    if (offset === 0) {
      setLoadedPayments(data.payments);
      return;
    }

    setLoadedPayments((previous) => {
      const existingIds = new Set(previous.map((payment) => payment.id));
      const merged = [...previous];
      for (const payment of data.payments) {
        if (!existingIds.has(payment.id)) {
          merged.push(payment);
          existingIds.add(payment.id);
        }
      }
      return merged;
    });
  }, [data?.payments, offset]);

  // Generate year options (last 3 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: "all", label: "All Years" },
    { value: String(currentYear), label: String(currentYear) },
    { value: String(currentYear - 1), label: String(currentYear - 1) },
    { value: String(currentYear - 2), label: String(currentYear - 2) },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Failed to load payment history. Please try again.</p>
      </Card>
    );
  }

  const { wards = [], summary, pagination } = data || {};
  const totalPayments = pagination?.total || 0;
  const hasMore = loadedPayments.length < totalPayments;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-purple-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/parent/fees")}
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="bg-linear-to-r from-purple-200 via-violet-200 to-indigo-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                Payment History
              </h1>
              <p className="text-sm text-white/60">
                View all payments made for your children
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            {wards.length > 1 && (
              <PremiumSelect value={selectedWard} onValueChange={setSelectedWard}>
                <PremiumSelectTrigger
                  className="h-10 w-44 rounded-xl text-sm border-white/15 bg-white/5"
                  icon={<Users className="h-4 w-4" />}
                >
                  <PremiumSelectValue placeholder="Filter by child" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">All Children</PremiumSelectItem>
                  {wards.map((w) => (
                    <PremiumSelectItem key={w.id} value={w.id}>
                      {w.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            )}

            <PremiumSelect value={selectedYear} onValueChange={setSelectedYear}>
              <PremiumSelectTrigger
                className="h-10 w-36 rounded-xl text-sm border-white/15 bg-white/5"
                icon={<Calendar className="h-4 w-4" />}
              >
                <PremiumSelectValue placeholder="Year" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {yearOptions.map((y) => (
                  <PremiumSelectItem key={y.value} value={y.value}>
                    {y.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Receipt}
          label="Total Payments"
          value={String(summary?.totalPayments || 0)}
          subLabel="All time"
          tone="purple"
        />
        <SummaryCard
          icon={CreditCard}
          label="Total Amount"
          value={formatCurrency(summary?.totalAmount || 0)}
          subLabel="Lifetime payments"
          tone="emerald"
        />
        <SummaryCard
          icon={TrendingUp}
          label="This Year"
          value={formatCurrency(summary?.thisYearAmount || 0)}
          subLabel={`${currentYear} payments`}
          tone="blue"
        />
        <SummaryCard
          icon={Calendar}
          label="This Month"
          value={formatCurrency(summary?.thisMonthAmount || 0)}
          subLabel="Current month"
          tone="cyan"
        />
      </div>

      {/* Payments List */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-lg">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl"
          aria-hidden="true"
        />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <CreditCard className="h-4 w-4 text-purple-300" />
              Payment Records
              <Badge variant="outline" className="ml-2 bg-white/5 text-white/60">
                {totalPayments} total
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3">
          {loadedPayments.length > 0 ? (
            loadedPayments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-12 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-white/30 mb-3" />
              <p className="text-sm text-white/50">No payments found</p>
              <p className="text-xs text-white/30 mt-1">
                {selectedWard !== "all" || selectedYear !== "all"
                  ? "Try adjusting your filters"
                  : "Payments will appear here once made"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => setOffset((previous) => previous + limit)}
            disabled={isFetching}
          >
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Page Export
-------------------------------------------------------------------------------- */
export default function ParentPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <PaymentsPageContent />
    </Suspense>
  );
}
