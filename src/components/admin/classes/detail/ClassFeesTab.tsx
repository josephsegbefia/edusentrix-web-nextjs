"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, Receipt, AlertTriangle, TrendingUp, CircleDollarSign } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useClassFeesAnalytics } from "@/hooks/admin/useClassAnalytics";
import { formatMoney } from "@/lib/fees/money";
import {
  AnalyticsStatCard,
  EmptyAnalyticsState,
  LeoSignalsCard,
  StudentIdentity,
  prettyDate,
} from "./ClassAnalyticsPrimitives";

type Props = {
  classId: string;
  className: string;
};

function feeStatusTone(status: "clear" | "partial" | "overdue" | "unbilled") {
  if (status === "clear") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "partial") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "overdue") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
}

export function ClassFeesTab({ classId, className }: Props) {
  const { data: periodsData } = useAcademicPeriods();
  const periods = periodsData?.periods ?? [];
  const [academicPeriodId, setAcademicPeriodId] = React.useState<string>("current");

  React.useEffect(() => {
    if (academicPeriodId !== "current" || periods.length === 0) return;
    setAcademicPeriodId(periods.find((period) => period.isCurrent)?._id ?? periods[periods.length - 1]?._id ?? "all");
  }, [academicPeriodId, periods]);

  const feesQuery = useClassFeesAnalytics(classId, {
    academicPeriodId,
  });
  const analytics = feesQuery.data?.data;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-amber-500/18 via-rose-500/8 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-200">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">
                Fee Overview
              </CardTitle>
              <p className="text-xs text-white/50">
                Billing, collections, outstanding balances, and fee risk for {className}.
              </p>
            </div>
          </div>
          {analytics?.filters.academicPeriodLabel ? (
            <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              {analytics.filters.academicPeriodLabel}
            </Badge>
          ) : null}
        </CardHeader>
      </Card>

      <Card className="border border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <CardContent className="p-4">
          <div className="max-w-sm space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Scope
            </label>
            <PremiumSelect value={academicPeriodId} onValueChange={setAcademicPeriodId}>
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Select scope" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {periods.map((period) => (
                  <PremiumSelectItem key={period._id} value={period._id}>
                    {period.yearLabel} • {period.term}
                  </PremiumSelectItem>
                ))}
                <PremiumSelectItem value="all">All periods</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      {feesQuery.isLoading && !analytics ? (
        <div className="flex items-center justify-center gap-3 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
          <p className="text-sm text-white/60">Loading class fee analytics...</p>
        </div>
      ) : feesQuery.isError ? (
        <EmptyAnalyticsState
          icon={AlertTriangle}
          title="Unable to load fee analytics"
          description="The class fee overview could not be loaded right now. Try again shortly."
        />
      ) : analytics && analytics.summary.studentCount === 0 ? (
        <EmptyAnalyticsState
          icon={Receipt}
          title="No students in this class"
          description="Fee analytics appear once active students are enrolled in this class."
        />
      ) : analytics ? (
        <>
          {analytics.summary.invoiceCount === 0 ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-medium text-amber-50">No issued invoices in this scope</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                This view tracks issued, partially paid, overdue, and paid invoices only.
                {(analytics.summary.draftInvoiceCount ?? 0) > 0
                  ? ` ${analytics.summary.draftInvoiceCount} draft invoice${analytics.summary.draftInvoiceCount === 1 ? "" : "s"} exist for students in this class — issue them from Finance or the student fees tab to include them here.`
                  : " Draft invoices are not counted until they are issued."}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsStatCard
              label="Total Billed"
              value={formatMoney(analytics.summary.totalBilledMinor)}
              subLabel={`${analytics.summary.invoiceCount} invoices`}
              icon={Receipt}
              tone="amber"
            />
            <AnalyticsStatCard
              label="Collected"
              value={formatMoney(analytics.summary.totalPaidMinor)}
              subLabel={`${analytics.summary.collectionRate}% collection rate`}
              icon={TrendingUp}
              tone="emerald"
            />
            <AnalyticsStatCard
              label="Outstanding"
              value={formatMoney(analytics.summary.totalOutstandingMinor)}
              subLabel={`${analytics.summary.defaultersCount} student${analytics.summary.defaultersCount === 1 ? "" : "s"} owing`}
              icon={AlertTriangle}
              tone="rose"
            />
            <AnalyticsStatCard
              label="Recent Collections"
              value={formatMoney(analytics.summary.recentCollectionsMinor)}
              subLabel="Last 30 days"
              icon={CircleDollarSign}
              tone="teal"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <LeoSignalsCard leo={analytics.leo} title="Leo Fee Signals" />

            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-white">
                  Collection Spotlight
                </CardTitle>
                <p className="text-xs text-white/45">
                  Quick visibility into the strongest and weakest fee positions in the class.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Top Defaulters</p>
                    <Badge className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[10px] text-white/70">
                      {analytics.spotlight.topDefaulters.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {analytics.spotlight.topDefaulters.map((row) => (
                      <div key={row.studentId} className="flex items-center justify-between gap-3">
                        <StudentIdentity
                          fullName={row.fullName}
                          photoUrl={row.photoUrl}
                          secondary={row.admissionNo ? `Adm. ${row.admissionNo}` : null}
                        />
                        <div className="text-right">
                          <p className="text-sm font-semibold text-rose-200">
                            {formatMoney(row.totalOutstandingMinor)}
                          </p>
                          <p className="text-[11px] text-white/45">
                            {row.overdueInvoiceCount} overdue
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">On Track</p>
                    <Badge className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[10px] text-white/70">
                      {analytics.spotlight.onTrack.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {analytics.spotlight.onTrack.map((row) => (
                      <div key={row.studentId} className="flex items-center justify-between gap-3">
                        <StudentIdentity
                          fullName={row.fullName}
                          photoUrl={row.photoUrl}
                          secondary={row.admissionNo ? `Adm. ${row.admissionNo}` : null}
                        />
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-200">
                            {formatMoney(row.totalPaidMinor)}
                          </p>
                          <p className="text-[11px] text-white/45">Fully clear</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Status Mix</p>
                    <p className="text-[11px] text-white/45">{analytics.summary.studentCount} students</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-emerald-200">
                      Clear: {analytics.byStatus.clear}
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-amber-200">
                      Partial: {analytics.byStatus.partial}
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-rose-200">
                      Overdue: {analytics.byStatus.overdue}
                    </div>
                    <div className="rounded-xl border border-slate-500/20 bg-slate-500/8 px-3 py-2 text-slate-200">
                      Unbilled: {analytics.byStatus.unbilled}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-white">
                  Student Fee Positions
                </CardTitle>
                <p className="text-xs text-white/45">
                  Class-wide fee exposure, payment status, and next due dates.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/5 text-left text-[11px] uppercase tracking-[0.18em] text-white/45">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Outstanding</th>
                        <th className="px-4 py-3 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.students.map((row) => (
                        <tr key={row.studentId} className="border-b border-white/6 last:border-0">
                          <td className="px-4 py-3.5">
                            <StudentIdentity
                              fullName={row.fullName}
                              photoUrl={row.photoUrl}
                              secondary={
                                row.nextDueDate
                                  ? `Next due ${prettyDate(row.nextDueDate)}`
                                  : row.admissionNo
                                  ? `Adm. ${row.admissionNo}`
                                  : null
                              }
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge className={`rounded-full border px-2.5 py-1 text-[11px] ${feeStatusTone(row.status)}`}>
                              {row.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-white">
                            {formatMoney(row.totalOutstandingMinor)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-emerald-200">
                            {formatMoney(row.totalPaidMinor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-white">
                  Recent Payments
                </CardTitle>
                <p className="text-xs text-white/45">
                  Latest completed payment activity in the selected fee scope.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {analytics.spotlight.recentPayments.map((payment) => (
                  <div key={payment.paymentId} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3.5">
                    <StudentIdentity
                      fullName={payment.fullName}
                      photoUrl={payment.photoUrl}
                      secondary={`${prettyDate(payment.paymentDate)} • ${payment.paymentMethod.replaceAll("_", " ")}`}
                    />
                    <span className="text-sm font-semibold text-emerald-200">
                      {formatMoney(payment.amountMinor)}
                    </span>
                  </div>
                ))}
                {analytics.spotlight.recentPayments.length === 0 ? (
                  <p className="rounded-2xl border border-white/8 bg-white/4 px-4 py-6 text-sm text-white/50">
                    No completed payments were found in this scope yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
