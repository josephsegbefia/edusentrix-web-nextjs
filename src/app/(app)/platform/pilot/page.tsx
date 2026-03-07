"use client";

import * as React from "react";
import { format } from "date-fns";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/fees/money";

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

export default function PlatformPilotPage() {
  const initialRange = React.useMemo(() => currentMonthRange(), []);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);
  const [periodStart, setPeriodStart] = React.useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = React.useState(initialRange.end);
  const [reviewNoteDraft, setReviewNoteDraft] = React.useState("");
  const [runs, setRuns] = React.useState<PilotRun[]>([]);

  const loadRuns = React.useCallback(async () => {
    try {
      setLoading(true);
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
      toast.success("Pilot closeout recommendation generated.");
      setReviewNoteDraft("");
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
            ? "Pilot closeout run approved."
            : "Pilot closeout run rejected."
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

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Pilot Closeout</h1>
          <p className="text-sm text-white/60">
            Generate pricing recommendations from real subscription, transaction-fee,
            usage, and cost data. Runs stay pending until a platform admin
            explicitly approves or rejects them.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-cyan-300" />
              Generate Closeout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Period Start
                </label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Period End
                </label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <Textarea
              value={reviewNoteDraft}
              onChange={(event) => setReviewNoteDraft(event.target.value)}
              className="min-h-28 border-white/10 bg-white/5 text-white"
              placeholder="Optional approval or rejection note. This note is applied when reviewing the most recent selected run."
            />

            <Button
              type="button"
              className="bg-cyan-600 text-white hover:bg-cyan-700"
              onClick={generateRun}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Generate Recommendation
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="text-lg">Latest Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading latest closeout data
                </div>
              ) : latestRun ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {latestRun.periodStart} to {latestRun.periodEnd}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {latestRun.schoolCount} schools • {latestRun.approvalStatus}
                        </p>
                      </div>
                      <p className="text-xs text-white/50">
                        {format(new Date(latestRun.createdAt), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-white/60">Realized revenue</p>
                      <p className="mt-1 font-semibold text-white">
                        {formatMoney(latestRun.summary.totalRealizedRevenueMinor)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-white/60">Estimated cost</p>
                      <p className="mt-1 font-semibold text-white">
                        {formatMoney(latestRun.summary.totalEstimatedCostMinor)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-white/60">Margin</p>
                      <p className="mt-1 font-semibold text-white">
                        {formatMoney(latestRun.summary.totalMarginMinor)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-white/60">Negative-margin schools</p>
                      <p className="mt-1 font-semibold text-white">
                        {latestRun.summary.negativeMarginSchools}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                    <p className="font-medium text-cyan-100">AI Executive Brief</p>
                    <p className="mt-2 whitespace-pre-line">
                      {latestRun.aiSummary || "No AI summary available."}
                    </p>
                    {latestRun.aiModel ? (
                      <p className="mt-2 text-xs text-cyan-100/80">
                        Model: {latestRun.aiModel}
                      </p>
                    ) : null}
                  </div>

                  {latestRun.approvalStatus === "pending_approval" ? (
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => void reviewRun(latestRun.id, "approved")}
                        disabled={reviewingId === latestRun.id}
                      >
                        {reviewingId === latestRun.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="border border-red-400/20 text-red-200 hover:text-red-100"
                        onClick={() => void reviewRun(latestRun.id, "rejected")}
                        disabled={reviewingId === latestRun.id}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-white/50">
                      Reviewed by {latestRun.reviewedByEmail || "Unknown"}{" "}
                      {latestRun.reviewedAt
                        ? `on ${format(new Date(latestRun.reviewedAt), "MMM d, yyyy h:mm a")}`
                        : ""}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-white/60">
                  No pilot closeout run has been generated yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Runs</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white"
                onClick={() => void loadRuns()}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(runs || []).map((run) => (
                <div
                  key={run.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {run.periodStart} to {run.periodEnd}
                      </p>
                      <p className="mt-1 text-sm text-white/60">
                        {run.schoolCount} schools • {run.approvalStatus}
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        Revenue {formatMoney(run.summary.totalRealizedRevenueMinor)} •
                        Cost {formatMoney(run.summary.totalEstimatedCostMinor)} •
                        Margin {formatMoney(run.summary.totalMarginMinor)}
                      </p>
                    </div>
                    <p className="text-xs text-white/50">
                      {format(new Date(run.createdAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>

                  <div className="mt-3 space-y-2">
                    {run.recommendations.slice(0, 3).map((item) => (
                      <div
                        key={`${run.id}-${item.schoolId}`}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <p className="text-sm font-medium text-white">
                          {item.schoolName} • {item.recommendedAction}
                        </p>
                        <p className="mt-1 text-xs text-white/60">
                          Current {formatMoney(item.currentSubscriptionPriceMinor)} •
                          Recommended {formatMoney(item.recommendedSubscriptionPriceMinor)} •
                          Margin {item.marginPercent.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
