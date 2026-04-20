"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  FlaskConical,
  History,
  Loader2,
  Percent,
  RefreshCw,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
  formatDate,
  formatTimestamp,
} from "@/components/platform/platform-page-primitives";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";

type PilotRecommendation = {
  schoolId: string;
  schoolName: string;
  tierName: string | null;
  subscriptionStatus: string | null;
  currentSubscriptionPriceMinor: number;
  transactionFeeRevenueMinor: number;
  estimatedCostMinor: number;
  realizedRevenueMinor: number;
  marginMinor: number;
  marginPercent: number;
  recommendedSubscriptionPriceMinor: number;
  recommendedAction: "keep" | "raise_price" | "assign_price" | "review";
  narrative: string;
};

type PilotRun = {
  id: string;
  periodStart: string;
  periodEnd: string;
  approvalStatus: "pending_approval" | "approved" | "rejected";
  generatedByEmail: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  aiSummary: string | null;
  aiModel: string | null;
  schoolCount: number;
  summary: {
    totalSubscriptionRevenueMinor: number;
    totalTransactionFeeRevenueMinor: number;
    totalRealizedRevenueMinor: number;
    totalEstimatedCostMinor: number;
    totalMarginMinor: number;
    negativeMarginSchools: number;
    targetMarginPercent: number;
  };
  recommendations: PilotRecommendation[];
  createdAt: string;
};

const APPROVAL_COPY: Record<
  PilotRun["approvalStatus"],
  { label: string; tone: "amber" | "emerald" | "rose" }
> = {
  pending_approval: { label: "Awaiting your review", tone: "amber" },
  approved: { label: "Approved", tone: "emerald" },
  rejected: { label: "Rejected", tone: "rose" },
};

const ACTION_COPY: Record<
  PilotRecommendation["recommendedAction"],
  { label: string; tone: "slate" | "cyan" | "amber" | "rose" | "violet" }
> = {
  keep: { label: "Keep current pricing", tone: "slate" },
  raise_price: { label: "Raise subscription price", tone: "amber" },
  assign_price: { label: "Assign / set price", tone: "cyan" },
  review: { label: "Needs manual review", tone: "rose" },
};

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  );
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Calendar-local midnight for YYYY-MM-DD (matches native date input semantics). */
function isoDateToLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m, d);
}

function localDateToIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PlatformPilotPage() {
  const initialRange = React.useMemo(() => currentMonthRange(), []);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);
  const [periodStart, setPeriodStart] = React.useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = React.useState(initialRange.end);
  const [reviewNoteDraft, setReviewNoteDraft] = React.useState("");
  const [runs, setRuns] = React.useState<PilotRun[]>([]);

  const loadRuns = React.useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      const res = await fetch("/api/platform/billing/pilot-closeout", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load pilot closeout runs");
      }
      setRuns((json.data || []) as PilotRun[]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load pilot closeout runs"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const generateRun = React.useCallback(async () => {
    try {
      setGenerating(true);
      const res = await fetch("/api/platform/billing/pilot-closeout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ periodStart, periodEnd }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate pilot closeout");
      }
      toast.success("Closeout pack generated. It is waiting for your approval.");
      void loadRuns();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate pilot closeout"
      );
    } finally {
      setGenerating(false);
    }
  }, [loadRuns, periodEnd, periodStart]);

  const reviewRun = React.useCallback(
    async (runId: string, decision: "approved" | "rejected") => {
      try {
        setReviewingId(runId);
        const res = await fetch(`/api/platform/billing/pilot-closeout/${runId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            note: reviewNoteDraft.trim() || null,
          }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Failed to review pilot closeout");
        }

        toast.success(
          decision === "approved"
            ? "Closeout approved and recorded."
            : "Closeout rejected."
        );
        setReviewNoteDraft("");
        void loadRuns();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to review pilot closeout"
        );
      } finally {
        setReviewingId(null);
      }
    },
    [loadRuns, reviewNoteDraft]
  );

  const latestRun = runs[0] || null;
  const pendingCount = runs.filter((r) => r.approvalStatus === "pending_approval").length;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Billing governance"
        title="Pilot closeout"
        description="End-of-period packs that roll up each school’s subscription, fee revenue, estimated costs, and margin. You generate a snapshot for a date range; it stays in “Awaiting your review” until a platform admin approves or rejects it. Use this before you treat pricing decisions as final for the period."
        actions={
          <>
            <Link
              href="/platform"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Platform overview
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => void loadRuns({ silent: true })}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh list
            </Button>
          </>
        }
      />

      {pendingCount > 0 ? (
        <div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 px-5 py-4 text-amber-50">
          <p className="text-sm font-medium text-amber-100">
            {pendingCount === 1
              ? "1 run needs a decision"
              : `${pendingCount} runs need a decision`}
          </p>
          <p className="mt-1 text-sm text-amber-100/85">
            Scroll to <span className="font-medium text-amber-50">Most recent run</span>{" "}
            for the latest pack, or use <span className="font-medium text-amber-50">All runs</span>{" "}
            below to compare history.
          </p>
        </div>
      ) : null}

      <PlatformSection
        title="How this flow works"
        description="Short checklist so the page is easier to scan with fresh eyes."
      >
        <ol className="grid gap-3 text-sm text-white/70 md:grid-cols-3">
          <li className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <span className="font-semibold text-white">1. Choose dates</span>
            <p className="mt-1 text-white/55">
              Usually the full calendar month you are closing. Both days are inclusive.
            </p>
          </li>
          <li className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <span className="font-semibold text-white">2. Generate</span>
            <p className="mt-1 text-white/55">
              Creates a new run with totals, per-school suggestions, and an optional AI
              brief. Older runs stay in the list for audit.
            </p>
          </li>
          <li className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <span className="font-semibold text-white">3. Approve or reject</span>
            <p className="mt-1 text-white/55">
              Only pending runs can be decided. Add an internal note if finance or ops
              needs context.
            </p>
          </li>
        </ol>
      </PlatformSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <PlatformSection
          title="Create a closeout pack"
          description="Generates a new snapshot for the period below. This does not apply pricing—it only records recommendations for review."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.14em] text-white/45">
                  Period start
                </Label>
                <CustomDatePicker
                  className="w-full"
                  value={isoDateToLocalDate(periodStart)}
                  onChange={(date) => {
                    if (!date) return;
                    const next = localDateToIsoDate(date);
                    setPeriodStart(next);
                    setPeriodEnd((prev) => (prev < next ? next : prev));
                  }}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.14em] text-white/45">
                  Period end
                </Label>
                <CustomDatePicker
                  className="w-full"
                  value={isoDateToLocalDate(periodEnd)}
                  onChange={(date) => {
                    if (!date) return;
                    setPeriodEnd(localDateToIsoDate(date));
                  }}
                  minDate={isoDateToLocalDate(periodStart) ?? undefined}
                  placeholder="Select end date"
                />
              </div>
            </div>
            <p className="text-xs text-white/45">
              Reporting window:{" "}
              <span className="text-white/60">
                {formatDate(periodStart)} – {formatDate(periodEnd)}
              </span>
            </p>
            <Button
              type="button"
              className="w-full bg-linear-to-r from-cyan-600 to-teal-600 text-white hover:from-cyan-500 hover:to-teal-500 sm:w-auto"
              onClick={() => void generateRun()}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Generate closeout pack
                </>
              )}
            </Button>
          </div>
        </PlatformSection>

        <PlatformSection
          title="Most recent run"
          description={
            latestRun
              ? `Created ${formatTimestamp(latestRun.createdAt)}. Numbers below are for ${formatDate(latestRun.periodStart)}–${formatDate(latestRun.periodEnd)}.`
              : "Generate a pack to see rolled-up revenue, cost, margin, and per-school suggestions."
          }
        >
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading runs…
            </div>
          ) : !latestRun ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 px-4 py-10 text-center">
              <FlaskConical className="mx-auto h-10 w-10 text-white/25" />
              <p className="mt-3 text-sm font-medium text-white/70">No closeout yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-white/45">
                Pick a period on the left and generate your first pack. It will appear
                here with totals and school-level lines.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformPill tone={APPROVAL_COPY[latestRun.approvalStatus].tone}>
                    {APPROVAL_COPY[latestRun.approvalStatus].label}
                  </PlatformPill>
                  <span className="text-sm text-white/50">
                    {latestRun.schoolCount} school
                    {latestRun.schoolCount === 1 ? "" : "s"}
                  </span>
                </div>
                {latestRun.generatedByEmail ? (
                  <p className="text-xs text-white/40">
                    Generated by {latestRun.generatedByEmail}
                  </p>
                ) : null}
              </div>

              <PlatformMetricGrid>
                <PlatformMetricCard
                  icon={BarChart3}
                  label="Realized revenue"
                  value={formatMoney(latestRun.summary.totalRealizedRevenueMinor)}
                  note="Subscriptions plus transaction-fee revenue in this period."
                  tone="cyan"
                />
                <PlatformMetricCard
                  icon={Scale}
                  label="Estimated cost"
                  value={formatMoney(latestRun.summary.totalEstimatedCostMinor)}
                  note="Attributed usage and cost for the same window."
                  tone="amber"
                />
                <PlatformMetricCard
                  icon={Percent}
                  label="Margin"
                  value={formatMoney(latestRun.summary.totalMarginMinor)}
                  note={`Target margin about ${latestRun.summary.targetMarginPercent.toFixed(1)}% (model input).`}
                  tone="emerald"
                />
                <PlatformMetricCard
                  icon={Building2}
                  label="Negative-margin schools"
                  value={String(latestRun.summary.negativeMarginSchools)}
                  note="Count of schools below zero margin in this pack."
                  tone={
                    latestRun.summary.negativeMarginSchools > 0 ? "rose" : "violet"
                  }
                />
              </PlatformMetricGrid>

              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-950/40 p-4">
                <p className="text-sm font-semibold text-cyan-100">AI executive brief</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-cyan-50/90">
                  {latestRun.aiSummary || "No AI summary was returned for this run."}
                </p>
                {latestRun.aiModel ? (
                  <p className="mt-3 text-xs text-cyan-200/60">Model: {latestRun.aiModel}</p>
                ) : null}
              </div>

              {latestRun.recommendations.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white/90">
                      Per-school recommendations
                    </h3>
                    <p className="text-xs text-white/45">
                      {latestRun.recommendations.length} row
                      {latestRun.recommendations.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {latestRun.recommendations.map((item) => {
                      const action = ACTION_COPY[item.recommendedAction];
                      return (
                        <li
                          key={`${latestRun.id}-${item.schoolId}`}
                          className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-white">{item.schoolName}</p>
                              <p className="mt-0.5 text-xs text-white/45">
                                {item.tierName || "No tier"} ·{" "}
                                {item.subscriptionStatus || "Unknown subscription"}
                              </p>
                            </div>
                            <PlatformPill tone={action.tone}>{action.label}</PlatformPill>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-white/55 sm:grid-cols-2">
                            <p>
                              Current price{" "}
                              <span className="text-white/75">
                                {formatMoney(item.currentSubscriptionPriceMinor)}
                              </span>
                            </p>
                            <p>
                              Suggested price{" "}
                              <span className="text-white/75">
                                {formatMoney(item.recommendedSubscriptionPriceMinor)}
                              </span>
                            </p>
                            <p>
                              Margin{" "}
                              <span className="text-white/75">
                                {item.marginPercent.toFixed(1)}%
                              </span>{" "}
                              ({formatMoney(item.marginMinor)})
                            </p>
                            <p>
                              Realized / cost{" "}
                              <span className="text-white/75">
                                {formatMoney(item.realizedRevenueMinor)} /{" "}
                                {formatMoney(item.estimatedCostMinor)}
                              </span>
                            </p>
                          </div>
                          {item.narrative ? (
                            <p className="mt-2 border-t border-white/10 pt-2 text-xs text-white/50">
                              {item.narrative}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {latestRun.approvalStatus === "pending_approval" ? (
                <div className="space-y-3 border-t border-white/10 pt-5">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.14em] text-white/45">
                      Note for approver (optional)
                    </Label>
                    <Textarea
                      value={reviewNoteDraft}
                      onChange={(event) => setReviewNoteDraft(event.target.value)}
                      className="min-h-24 border-white/10 bg-white/5 text-white"
                      placeholder="e.g. Finance sign-off, exception for School X, link to ticket…"
                    />
                    <p className="text-xs text-white/40">
                      Stored with this approval or rejection for audit.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                      onClick={() => void reviewRun(latestRun.id, "approved")}
                      disabled={reviewingId === latestRun.id}
                    >
                      {reviewingId === latestRun.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Approve closeout
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                      onClick={() => void reviewRun(latestRun.id, "rejected")}
                      disabled={reviewingId === latestRun.id}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55">
                  <p>
                    <span className="text-white/75">Decision:</span>{" "}
                    {APPROVAL_COPY[latestRun.approvalStatus].label}
                  </p>
                  {latestRun.reviewedByEmail ? (
                    <p className="mt-1 text-xs text-white/45">
                      By {latestRun.reviewedByEmail}
                      {latestRun.reviewedAt
                        ? ` · ${formatTimestamp(latestRun.reviewedAt)}`
                        : ""}
                    </p>
                  ) : null}
                  {latestRun.reviewNote ? (
                    <p className="mt-2 border-t border-white/10 pt-2 text-xs text-white/50">
                      Note: {latestRun.reviewNote}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </PlatformSection>
      </div>

      <PlatformSection
        title="All runs"
        description="Newest first. Each card is one generated pack; expand context by comparing periods and approval states."
      >
        {loading ? (
          <p className="py-8 text-sm text-white/50">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="py-6 text-sm text-white/50">No runs yet.</p>
        ) : (
          <ul className="space-y-3">
            {runs.map((run) => {
              const approval = APPROVAL_COPY[run.approvalStatus];
              const isLatest = latestRun?.id === run.id;
              return (
                <li
                  key={run.id}
                  className={cn(
                    "rounded-2xl border bg-black/20 px-4 py-4",
                    isLatest ? "border-cyan-400/25" : "border-white/10"
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">
                          {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
                        </p>
                        {isLatest ? (
                          <PlatformPill tone="cyan">Latest</PlatformPill>
                        ) : null}
                        <PlatformPill tone={approval.tone}>{approval.label}</PlatformPill>
                      </div>
                      <p className="text-xs text-white/45">
                        {run.schoolCount} schools · Created{" "}
                        {formatTimestamp(run.createdAt)}
                      </p>
                      <p className="text-sm text-white/55">
                        Revenue {formatMoney(run.summary.totalRealizedRevenueMinor)} · Cost{" "}
                        {formatMoney(run.summary.totalEstimatedCostMinor)} · Margin{" "}
                        {formatMoney(run.summary.totalMarginMinor)}
                      </p>
                    </div>
                    <History className="hidden h-5 w-5 shrink-0 text-white/20 sm:block" />
                  </div>
                  {run.recommendations.length > 0 ? (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-white/40">
                        Sample schools (first {Math.min(3, run.recommendations.length)})
                      </p>
                      <ul className="mt-2 space-y-2">
                        {run.recommendations.slice(0, 3).map((item) => {
                          const action = ACTION_COPY[item.recommendedAction];
                          return (
                            <li
                              key={`${run.id}-${item.schoolId}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-xs"
                            >
                              <span className="font-medium text-white/85">
                                {item.schoolName}
                              </span>
                              <span className="flex flex-wrap items-center gap-2">
                                <PlatformPill tone={action.tone}>{action.label}</PlatformPill>
                                <span className="text-white/45">
                                  {item.marginPercent.toFixed(1)}% margin
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PlatformSection>
    </div>
  );
}
