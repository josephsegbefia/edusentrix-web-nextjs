"use client";

import * as React from "react";
import {
  AlertCircle,
  Clock3,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useFeesAccountBrief,
  useRegenerateFeesAccountBrief,
} from "@/hooks/admin/useFeesAI";
import { toast } from "sonner";

function riskBadgeClass(risk: "low" | "medium" | "high") {
  if (risk === "high") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }
  if (risk === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function formatDateTime(value: string | null) {
  if (!value) return "Not generated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not generated yet";
  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value || 0);
}

type Props = {
  studentId: string;
  periodId?: string | null;
};

export function FeesAIAccountBriefCard({ studentId, periodId }: Props) {
  const accountBrief = useFeesAccountBrief(studentId, periodId);
  const regenerate = useRegenerateFeesAccountBrief();

  const data = accountBrief.data;
  const budget = data?.budget;
  const canGenerate = Boolean(budget?.canGenerate);

  const handleRegenerate = async () => {
    try {
      const next = await regenerate.mutateAsync({
        studentId,
        periodId: periodId || null,
        force: true,
      });
      toast.success(
        next.source === "ai"
          ? "AI account brief refreshed."
          : "Latest cached account brief is already up to date."
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to regenerate AI account brief.");
    }
  };

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-fuchsia-500/10 via-transparent to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              AI Account Brief
            </CardTitle>
            <p className="mt-1 text-xs text-white/55">
              Snapshot summary for this student&apos;s fees account. Cached in DB to
              reduce AI usage and cost.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            disabled={
              regenerate.isPending ||
              accountBrief.isLoading ||
              !canGenerate
            }
            title={canGenerate ? "Regenerate AI brief" : budget?.reason || ""}
            className="h-8 gap-1 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                regenerate.isPending ? "animate-spin" : ""
              }`}
            />
            Regenerate
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-3">
        {accountBrief.isLoading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-xs text-white/60">
            Loading account brief…
          </div>
        ) : accountBrief.isError || !data ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-4 text-xs text-rose-200">
            Failed to load AI account brief.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={riskBadgeClass(data.brief.riskLevel)}
              >
                Risk: {data.brief.riskLevel}
              </Badge>
              <Badge
                variant="outline"
                className="border-white/15 bg-white/5 text-white/75"
              >
                Source: {data.source === "ai" ? "AI" : "Rule-based"}
              </Badge>
              {data.cacheStatus !== "fresh" ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-200"
                >
                  {data.cacheStatus === "stale" ? "Cache stale" : "No cache yet"}
                </Badge>
              ) : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <h4 className="text-sm font-semibold text-white">
                {data.brief.headline}
              </h4>
              <p className="mt-1 text-xs text-white/70">{data.brief.overview}</p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/55">
                  Key Points
                </div>
                <ul className="mt-2 space-y-1 text-xs text-white/75">
                  {data.brief.keyPoints.length ? (
                    data.brief.keyPoints.map((point, index) => (
                      <li key={`${index}-${point}`}>• {point}</li>
                    ))
                  ) : (
                    <li>• No key points available.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/55">
                  Recommended Actions
                </div>
                <ul className="mt-2 space-y-1 text-xs text-white/75">
                  {data.brief.recommendedActions.length ? (
                    data.brief.recommendedActions.map((action, index) => (
                      <li key={`${index}-${action}`}>• {action}</li>
                    ))
                  ) : (
                    <li>• No actions available.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  Updated: {formatDateTime(data.generatedAt)}
                </span>
                <span>Tokens today: {budget?.tokensUsedToday ?? 0}</span>
                <span>Remaining: {budget?.tokensRemainingToday ?? 0}</span>
                <span>Cost today: {formatUsd(budget?.estimatedCostUsdToday || 0)}</span>
              </div>
            </div>
          </>
        )}

        {budget && !budget.canGenerate ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <div className="mb-1 inline-flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              AI generation paused
            </div>
            <p>{budget.reason}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
