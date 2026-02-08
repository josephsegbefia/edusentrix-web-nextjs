"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  FileSearch,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useFinancialTransactions } from "@/hooks/admin/useFinancialCenter";

function formatCurrency(amountMinor: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function reconciliationBadge(status?: string) {
  if (status === "disputed") {
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 bg-red-500/10 text-red-300"
      >
        Disputed
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

export default function ReconciliationQueuePage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "unmatched" | "disputed">(
    "all"
  );
  const [page, setPage] = React.useState(1);

  const reconciliationStatus =
    status === "all" ? "unmatched,disputed" : status;

  const { data, isLoading, refetch } = useFinancialTransactions({
    q: search || undefined,
    reconciliationStatus,
    page,
    limit: 20,
    sortBy: "occurredAt",
    sortOrder: "desc",
  });

  const transactions = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            Reconciliation Queue
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Review unmatched and disputed transactions before close.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link href={`/admin/finance/transactions?reconciliationStatus=${encodeURIComponent(reconciliationStatus)}`}>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10"
            >
              Open Full Ledger
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by reference, description, or party..."
                className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40"
              />
            </div>

            <PremiumSelect
              value={status}
              onValueChange={(value) => {
                setStatus(value as "all" | "unmatched" | "disputed");
                setPage(1);
              }}
            >
              <PremiumSelectTrigger className="w-[180px]">
                <PremiumSelectValue placeholder="Queue Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All Queue Items</PremiumSelectItem>
                <PremiumSelectItem value="unmatched">Unmatched</PremiumSelectItem>
                <PremiumSelectItem value="disputed">Disputed</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-lg text-white">
            {pagination?.total ?? 0} item{(pagination?.total || 0) === 1 ? "" : "s"} pending review
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
                <FileSearch className="h-7 w-7 text-white/30" />
              </div>
              <p className="text-sm text-white/50">
                No queue items found for current filters.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => {
                const isInflow = transaction.direction === "inflow";
                return (
                  <div
                    key={transaction._id}
                    className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isInflow
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {isInflow ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {transaction.description ||
                            transaction.reference ||
                            "Transaction"}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {format(new Date(transaction.occurredAt), "MMM d, yyyy h:mm a")}
                          {transaction.reference ? ` • ${transaction.reference}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                      {reconciliationBadge(transaction.reconciliation?.status)}
                      <p
                        className={`min-w-[120px] text-right text-sm font-semibold ${
                          isInflow ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {isInflow ? "+" : "-"}
                        {formatCurrency(
                          transaction.netAmountMinor,
                          transaction.currency
                        )}
                      </p>
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(`/admin/finance/transactions/${transaction._id}`)
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
              <p className="text-sm text-white/50">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={pagination.page === 1}
                  className="border-white/10 bg-white/5"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.pages, current + 1)
                    )
                  }
                  disabled={pagination.page === pagination.pages}
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
