"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees/money";

type RevenueSchoolRow = {
  schoolId: string;
  schoolName: string;
  schoolStatus: string;
  subscriptionStatus: string;
  tierCode: string | null;
  tierName: string | null;
  subscriptionRevenueMinor: number;
  discountExposureMinor: number;
  transactionFeeRevenueMinor: number;
  processorFeeCostMinor: number;
  attributedCostMinor: number;
  grossMarginMinor: number;
};

type RevenueResponse = {
  periodStart: string;
  periodEnd: string;
  summary: {
    activeSchools: number;
    activeSubscriptions: number;
    realizedMrrMinor: number;
    arrRunRateMinor: number;
    discountExposureMinor: number;
    paymentVolumeMinor: number;
    outboundDisbursementMinor: number;
    transactionFeeRevenueMinor: number;
    processorFeeCostMinor: number;
    netPaymentMarginMinor: number;
    usageAttributedCostMinor: number;
    serviceCostLedgerMinor: number;
    grossMarginMinor: number;
  };
  serviceCosts: Array<{ provider: string; amountMinor: number }>;
  tierMix: Array<{ tierCode: string; tierName: string; schools: number }>;
  schools: RevenueSchoolRow[];
};

export default function PlatformBillingRevenuePage() {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<RevenueResponse | null>(null);

  const loadRevenue = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/billing/revenue", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load revenue analytics");
      }
      setData(json.data as RevenueResponse);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load revenue analytics"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRevenue();
  }, [loadRevenue]);

  const summary = data?.summary;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-fit px-0 text-white/70 hover:text-white"
          >
            <Link href="/platform/billing">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Billing
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold text-white">Revenue Analytics</h1>
          <p className="text-sm text-white/60">
            Realized subscription revenue, transaction-fee revenue, processor cost,
            and school-level gross margin for the current billing window.
          </p>
          {data ? (
            <p className="text-xs uppercase tracking-wide text-white/40">
              Window {data.periodStart} to {data.periodEnd}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          onClick={() => void loadRevenue()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Realized MRR",
            value: summary ? formatMoney(summary.realizedMrrMinor) : "-",
          },
          {
            label: "ARR Run Rate",
            value: summary ? formatMoney(summary.arrRunRateMinor) : "-",
          },
          {
            label: "Txn Fee Revenue",
            value: summary ? formatMoney(summary.transactionFeeRevenueMinor) : "-",
          },
          {
            label: "Net Payment Margin",
            value: summary ? formatMoney(summary.netPaymentMarginMinor) : "-",
          },
          {
            label: "Discount Exposure",
            value: summary ? formatMoney(summary.discountExposureMinor) : "-",
          },
          {
            label: "Usage Attributed Cost",
            value: summary ? formatMoney(summary.usageAttributedCostMinor) : "-",
          },
          {
            label: "Cost Ledger",
            value: summary ? formatMoney(summary.serviceCostLedgerMinor) : "-",
          },
          {
            label: "Gross Margin",
            value: summary ? formatMoney(summary.grossMarginMinor) : "-",
          },
        ].map((item) => (
          <Card key={item.label} className="border-white/10 bg-white/5">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-5 w-5 text-cyan-300" />
              School Margin Table
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !data ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading revenue analytics
              </div>
            ) : null}

            {(data?.schools || []).slice(0, 12).map((school) => (
              <div
                key={school.schoolId}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-white">{school.schoolName}</p>
                    <p className="text-xs text-white/50">
                      {school.tierName || "Unassigned"} • {school.subscriptionStatus}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-white">
                      {formatMoney(
                        school.subscriptionRevenueMinor +
                          school.transactionFeeRevenueMinor
                      )}
                    </p>
                    <p className="text-xs text-white/50">realized revenue</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-white/60 md:grid-cols-4">
                  <p>Subscription {formatMoney(school.subscriptionRevenueMinor)}</p>
                  <p>Txn Fees {formatMoney(school.transactionFeeRevenueMinor)}</p>
                  <p>Cost {formatMoney(school.attributedCostMinor)}</p>
                  <p>Margin {formatMoney(school.grossMarginMinor)}</p>
                </div>
              </div>
            ))}

            {!loading && (data?.schools.length || 0) === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                No revenue rows available yet.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="text-base">Tier Mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.tierMix || []).map((tier) => (
                <div
                  key={tier.tierCode}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span>{tier.tierName}</span>
                  <span className="text-white/60">{tier.schools} schools</span>
                </div>
              ))}
              {!loading && (data?.tierMix.length || 0) === 0 ? (
                <p className="text-sm text-white/60">No tier mix data yet.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="text-base">Service Cost Mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.serviceCosts || []).slice(0, 8).map((item) => (
                <div
                  key={item.provider}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="capitalize">{item.provider}</span>
                  <span className="text-white/60">{formatMoney(item.amountMinor)}</span>
                </div>
              ))}
              {!loading && (data?.serviceCosts.length || 0) === 0 ? (
                <p className="text-sm text-white/60">No service cost entries yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
