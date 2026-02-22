// src/components/admin/students/detail/AIInsightsPanel.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIInsights } from "@/hooks/admin/useAIInsights";
import { LeoIcon } from "@/components/icons/LeoIcon";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  studentId: string;
  termId: string | null;
};

export function AIInsightsPanel({ studentId, termId }: Props) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [hasRequestedInsights, setHasRequestedInsights] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"student" | "parent" | "teacher">("student");

  const { data, isLoading, isError, refetch } = useAIInsights(
    studentId,
    termId,
    hasRequestedInsights && isExpanded // only fetch when user explicitly requested
  );

  const insights = data?.data;

  const riskColors = {
    low: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
    medium: "bg-amber-500/20 text-amber-200 border-amber-400/40",
    high: "bg-red-500/20 text-red-200 border-red-400/40",
  };

  const showGenerateCTA = !hasRequestedInsights && !data && !isLoading && !isError;

  return (
    <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <LeoIcon className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Leo Insights & Recommendations
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {showGenerateCTA && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-6 py-8 text-center">
              <div className="flex justify-center mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/20">
                  <LeoIcon className="h-6 w-6 text-primary-200" />
                </div>
              </div>
              <p className="text-sm text-white/70 mb-4">
                Get AI-powered insights and recommendations for this student&apos;s academic performance.
              </p>
              <Button
                onClick={() => setHasRequestedInsights(true)}
                className="gap-2 rounded-xl bg-primary hover:bg-primary/90"
              >
                <LeoIcon className="h-4 w-4" />
                Generate with Leo
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Leo is analyzing...
              </span>
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-6 text-center">
              <p className="text-sm text-destructive mb-2">
                Leo couldn&apos;t generate insights
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {insights && (
            <>
              {/* Risk Level Badge */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Risk Level:</span>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold border",
                    riskColors[insights.riskLevel as keyof typeof riskColors] ||
                      riskColors.low
                  )}
                >
                  {insights.riskLevel.toUpperCase()}
                </span>
              </div>

              {/* Summary */}
              <div>
                <p className="text-sm text-white/90 leading-relaxed">
                  {insights.summary}
                </p>
              </div>

              {/* Strengths */}
              {insights.strengths && insights.strengths.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold text-white/90 uppercase tracking-wide">
                      Strengths
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {insights.strengths.map((strength, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-emerald-200">
                            {strength.subject}
                          </span>
                          <span className="text-xs text-emerald-100">
                            {strength.score}%
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-100/80">
                          {strength.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weaknesses */}
              {insights.weaknesses && insights.weaknesses.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <h4 className="text-xs font-semibold text-white/90 uppercase tracking-wide">
                      Areas for Improvement
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {insights.weaknesses.map((weakness, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-red-200">
                            {weakness.subject}
                          </span>
                          <div className="flex items-center gap-2">
                            {weakness.trend === "improving" && (
                              <TrendingUp className="h-3 w-3 text-emerald-400" />
                            )}
                            {weakness.trend === "declining" && (
                              <TrendingDown className="h-3 w-3 text-red-400" />
                            )}
                            <span className="text-xs text-red-100">
                              {weakness.score}%
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-red-100/80">
                          {weakness.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Actions */}
              {insights.suggestedActions && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h4 className="text-xs font-semibold text-white/90 uppercase tracking-wide">
                      Recommended Actions
                    </h4>
                  </div>
                  {/* Tabs */}
                  <div className="flex gap-2 mb-3 border-b border-white/10">
                    {(["student", "parent", "teacher"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-[1px]",
                          activeTab === tab
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-white/70"
                        )}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  {/* Actions List */}
                  <div className="space-y-2">
                    {insights.suggestedActions[activeTab]?.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-sm text-white/80"
                      >
                        <span className="text-primary mt-0.5">•</span>
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority Subjects */}
              {insights.prioritySubjects &&
                insights.prioritySubjects.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white/90 uppercase tracking-wide mb-2">
                      Priority Focus Areas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {insights.prioritySubjects.map((subject, idx) => (
                        <span
                          key={idx}
                          className="rounded-full px-3 py-1 text-xs font-medium bg-primary/20 text-primary-200 border border-primary/30"
                        >
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Additional Insights */}
              {insights.insights && (
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-white/90 uppercase tracking-wide">
                    Additional Insights
                  </h4>
                  {insights.insights.overallTrend && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-white/80">
                        Overall Trend:{" "}
                      </span>
                      {insights.insights.overallTrend}
                    </p>
                  )}
                  {insights.insights.examVsCA && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-white/80">
                        CA vs Exam:{" "}
                      </span>
                      {insights.insights.examVsCA}
                    </p>
                  )}
                  {insights.insights.classComparison && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-white/80">
                        Class Comparison:{" "}
                      </span>
                      {insights.insights.classComparison}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
