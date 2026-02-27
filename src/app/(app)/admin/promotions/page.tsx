// src/app/(app)/admin/promotions/page.tsx
// PROMO-FE-001/002: Promotion Center – modern revamp
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  Eye,
  Users,
  MapPin,
  CheckCircle,
  History,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PolicyTab } from "@/components/admin/promotions/PolicyTab";
import { PreviewTab } from "@/components/admin/promotions/PreviewTab";
import { ReviewTab } from "@/components/admin/promotions/ReviewTab";
import { PlacementTab } from "@/components/admin/promotions/PlacementTab";
import { FinalizeTab } from "@/components/admin/promotions/FinalizeTab";
import { HistoryTab } from "@/components/admin/promotions/HistoryTab";
import { usePromotionPolicyActive } from "@/hooks/admin/usePromotionPolicies";
import { usePromotionCycles } from "@/hooks/admin/usePromotionCycles";

const STEPS = [
  { id: "policy", label: "Policy", short: "Set rules", icon: BookOpen },
  { id: "preview", label: "Preview", short: "Evaluate", icon: Eye },
  { id: "review", label: "Review", short: "Adjust", icon: Users },
  { id: "placement", label: "Placement", short: "Assign", icon: MapPin },
  { id: "finalize", label: "Finalize", short: "Apply", icon: CheckCircle },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type TabId = StepId | "overview" | "history";

export default function PromotionsPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");
  const { data: policyData } = usePromotionPolicyActive();
  const { data: cyclesData } = usePromotionCycles({ status: undefined, limit: 5 });

  const hasActivePolicy = !!policyData?.data;
  const cycles = cyclesData?.data ?? [];
  const latestCycle = cycles[0];
  const needsReview =
    latestCycle && ["preview_ready", "review_in_progress"].includes(latestCycle.status);
  const needsFinalize =
    latestCycle && ["approved", "finalize_failed"].includes(latestCycle.status);

  const currentStepIndex = STEPS.findIndex((s) => s.id === activeTab);

  return (
    <div className="space-y-8 pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-950 px-6 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <Sparkles className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-sm font-medium uppercase tracking-wider text-amber-400/90">
                Grade Transitions
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Promotion Center
            </h1>
            <p className="mt-2 max-w-xl text-base text-white/70">
              Manage end-of-year grade promotions step by step. Set rules, evaluate students, review
              decisions, then apply changes when you&apos;re ready.
            </p>
          </div>
          {latestCycle && (
            <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Latest cycle
              </p>
              <p className="mt-1 font-semibold text-white">{latestCycle.sourceYearLabel}</p>
              <p className="mt-0.5 text-sm capitalize text-amber-300/90">{latestCycle.status.replace(/_/g, " ")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Step navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav
          className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1.5"
          aria-label="Promotion workflow"
        >
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
              activeTab === "overview"
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white/80"
            )}
          >
            Overview
          </button>
          {STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveTab(step.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                activeTab === step.id
                  ? "bg-amber-500/20 text-amber-200"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              )}
            >
              <step.icon className="h-4 w-4" />
              {step.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
              activeTab === "history"
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white/80"
            )}
          >
            <History className="h-4 w-4" />
            History
          </button>
        </nav>
      </div>

      {/* Content */}
      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-xl">
        <CardContent className="p-6 sm:p-8">
          {activeTab === "overview" && (
            <div className="space-y-10">
              {/* What to do next */}
              <section>
                <h2 className="mb-4 text-lg font-semibold text-white">What to do next</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {!hasActivePolicy && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("policy")}
                      className="group flex flex-col rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-left transition-colors hover:border-amber-500/50 hover:bg-amber-500/15"
                    >
                      <BookOpen className="mb-3 h-10 w-10 text-amber-400" />
                      <h3 className="font-semibold text-white">Create a policy</h3>
                      <p className="mt-1 text-sm text-white/60">
                        Define promotion criteria (attendance, grades, fees) before evaluating
                        students.
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-400">
                        Get started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-6 text-left transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/5"
                  >
                    <Eye className="mb-3 h-10 w-10 text-emerald-400" />
                    <h3 className="font-semibold text-white">Run a preview</h3>
                    <p className="mt-1 text-sm text-white/60">
                      Evaluate students for the selected term. No changes are made — it&apos;s
                      read-only.
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-400">
                      Run preview <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </button>
                  {needsReview && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("review")}
                      className="group flex flex-col rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-left transition-colors hover:border-amber-500/50 hover:bg-amber-500/15"
                    >
                      <Users className="mb-3 h-10 w-10 text-amber-400" />
                      <h3 className="font-semibold text-white">Review decisions</h3>
                      <p className="mt-1 text-sm text-white/60">
                        Check promote / repeat / hold outcomes and override where needed.
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-400">
                        Review now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </button>
                  )}
                  {needsFinalize && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("finalize")}
                      className="group flex flex-col rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-left transition-colors hover:border-amber-500/50 hover:bg-amber-500/15"
                    >
                      <CheckCircle className="mb-3 h-10 w-10 text-amber-400" />
                      <h3 className="font-semibold text-white">Approve & finalize</h3>
                      <p className="mt-1 text-sm text-white/60">
                        Apply grade transitions after approval. This updates student placements.
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-400">
                        Go to Finalize <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </button>
                  )}
                </div>
              </section>

              {/* The 5 steps */}
              <section>
                <h2 className="mb-6 text-lg font-semibold text-white">How it works</h2>
                <div className="flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-0">
                  {STEPS.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <div className="group flex flex-1 flex-col items-center rounded-xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04]">
                        <div
                          className={cn(
                            "mb-3 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold",
                            currentStepIndex >= idx
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-white/10 text-white/40"
                          )}
                        >
                          {idx + 1}
                        </div>
                        <h3 className="font-semibold text-white">{step.label}</h3>
                        <p className="mt-1 text-center text-sm text-white/50">{step.short}</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab(step.id)}
                          className="mt-4 text-sm font-medium text-amber-400 hover:text-amber-300"
                        >
                          Open →
                        </button>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div className="hidden shrink-0 items-center px-2 sm:flex">
                          <ChevronRight className="h-5 w-5 text-white/20" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </section>

              {/* Quick link to history */}
              <section>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="flex items-center gap-2 text-white">
                    <History className="h-5 w-5 text-white/50" />
                    View cycle history
                  </span>
                  <ChevronRight className="h-5 w-5 text-white/40" />
                </button>
              </section>
            </div>
          )}

          {activeTab === "policy" && <PolicyTab />}
          {activeTab === "preview" && <PreviewTab />}
          {activeTab === "review" && <ReviewTab />}
          {activeTab === "placement" && <PlacementTab />}
          {activeTab === "finalize" && <FinalizeTab />}
          {activeTab === "history" && <HistoryTab />}
        </CardContent>
      </Card>
    </div>
  );
}
