"use client";

import { AlertTriangle, CheckCircle2, Lightbulb, ListChecks } from "lucide-react";
import { LeoIcon } from "@/components/icons/LeoIcon";
import type { PromotionCycleDTO } from "@/hooks/admin/usePromotionCycles";
import type { PromotionPolicyDTO } from "@/hooks/admin/usePromotionPolicies";

type LeoPromotionGuideProps = {
  activeTab: string;
  activePolicy: PromotionPolicyDTO | null;
  latestCycle?: PromotionCycleDTO;
};

function formatStatus(status?: string) {
  return status ? status.replace(/_/g, " ") : "not started";
}

function guidanceForStep({
  activeTab,
  activePolicy,
  latestCycle,
}: LeoPromotionGuideProps) {
  if (!activePolicy) {
    return {
      tone: "warning" as const,
      title: "Start with a promotion policy",
      body:
        "Leo recommends defining the minimum attendance, academic average, and fee hold rules before running a preview. This keeps the promotion decisions explainable.",
      actions: [
        "Create and activate a policy.",
        "Keep criteria simple for the first real cycle.",
        "Run preview only after attendance and results are reasonably complete.",
      ],
    };
  }

  if (!latestCycle) {
    return {
      tone: "info" as const,
      title: "Ready to run a safe preview",
      body:
        "A preview will evaluate students and create reviewable decisions, but it will not move anyone yet.",
      actions: [
        "Choose the completed academic period as source.",
        "Scope by grade if you want to test with a smaller group first.",
        "Review holds and repeats before approval.",
      ],
    };
  }

  if (["preview_ready", "review_in_progress"].includes(latestCycle.status)) {
    return {
      tone: "warning" as const,
      title: "Review before approval",
      body:
        "Leo suggests checking repeat, hold, and placement-conflict decisions before approving this cycle.",
      actions: [
        `${latestCycle.totals.hold} hold decisions need human judgment.`,
        `${latestCycle.totals.repeat} repeat decisions should be reviewed for fairness.`,
        "Use Placement to resolve promote decisions without target classes.",
      ],
    };
  }

  if (latestCycle.status === "approved") {
    return {
      tone: "success" as const,
      title: "Approved and ready to finalize",
      body:
        "Finalizing will update live student grades/classes. Confirm that placements and overrides are complete first.",
      actions: [
        "Check that promoted students have target classes.",
        "Confirm the cycle totals match expectations.",
        "Finalize during a quiet operational window.",
      ],
    };
  }

  if (latestCycle.status.includes("failed")) {
    return {
      tone: "warning" as const,
      title: "Resolve the failed run",
      body:
        "Leo sees a failed promotion operation. Review conflicts and retry only after the underlying issue is fixed.",
      actions: [
        "Look for missing target placements or capacity conflicts.",
        "Resolve them in Review or Placement.",
        "Retry the failed operation from Finalize.",
      ],
    };
  }

  return {
    tone: "info" as const,
    title: `Current cycle is ${formatStatus(latestCycle.status)}`,
    body:
      activeTab === "history"
        ? "Leo can help interpret past cycles by looking at totals, overrides, and failed operations."
        : "Use the workflow steps from left to right. Each step keeps the final student update auditable.",
    actions: [
      "Use Preview for non-destructive checks.",
      "Use Review for human judgment.",
      "Use Finalize only after approval.",
    ],
  };
}

export function LeoPromotionGuide(props: LeoPromotionGuideProps) {
  const guidance = guidanceForStep(props);
  const toneClass =
    guidance.tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
      : guidance.tone === "warning"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
        : "border-cyan-500/25 bg-cyan-500/10 text-cyan-100";
  const Icon = guidance.tone === "success" ? CheckCircle2 : guidance.tone === "warning" ? AlertTriangle : Lightbulb;

  return (
    <aside className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
          <LeoIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <p className="text-sm font-semibold">Leo guidance</p>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-white">{guidance.title}</h3>
          <p className="mt-1 text-sm text-white/65">{guidance.body}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
          <ListChecks className="h-3.5 w-3.5" />
          Suggested next checks
        </div>
        <ul className="space-y-1.5 text-sm text-white/70">
          {guidance.actions.map((action) => (
            <li key={action} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
