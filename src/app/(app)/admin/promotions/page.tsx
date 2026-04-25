"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  GraduationCap,
  History,
  Layers3,
  MapPin,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { ReviewTab } from "@/components/admin/promotions/ReviewTab";
import { PlacementTab } from "@/components/admin/promotions/PlacementTab";
import { FinalizeTab } from "@/components/admin/promotions/FinalizeTab";
import { HistoryTab } from "@/components/admin/promotions/HistoryTab";
import { PromotionPolicyWizard } from "@/components/admin/promotions/PromotionPolicyWizard";
import { PromotionPreviewWizard } from "@/components/admin/promotions/PromotionPreviewWizard";
import { PromotionPolicyDetailsModal } from "@/components/admin/promotions/PromotionPolicyDetailsModal";
import {
  type PromotionPolicyDTO,
  useDeletePromotionPolicy,
  usePromotionPolicies,
  usePromotionPolicyActive,
} from "@/hooks/admin/usePromotionPolicies";
import { useDeletePromotionCycle, usePromotionCycles } from "@/hooks/admin/usePromotionCycles";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

type WorkspaceTab = "overview" | "review" | "placement" | "finalize" | "history";

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: Layers3,
    description: "Policies, Leo guidance, and recent promotion runs.",
  },
  {
    id: "review",
    label: "Review",
    icon: Eye,
    description: "Check who is being promoted, held, repeated, or graduated.",
  },
  {
    id: "placement",
    label: "Placement",
    icon: MapPin,
    description: "Resolve students who still need target classes.",
  },
  {
    id: "finalize",
    label: "Finalize",
    icon: CheckCircle2,
    description: "Approve and apply the final promotion cycle.",
  },
  {
    id: "history",
    label: "History",
    icon: History,
    description: "Look back at previous cycles and outcomes.",
  },
] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: "border-white/10 bg-white/[0.04] text-white/70",
  preview_ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  review_in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  approved: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
  finalizing: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  finalized: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  finalize_failed: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  rolled_back: "border-white/10 bg-white/[0.04] text-white/70",
  rollback_failed: "border-rose-500/30 bg-rose-500/10 text-rose-100",
};

const DELETABLE_CYCLE_STATUSES = new Set([
  "draft",
  "preview_ready",
  "review_in_progress",
  "approved",
  "cancelled",
  "finalize_failed",
  "finalized",
  "rolled_back",
  "rollback_failed",
]);

function formatStatus(value?: string) {
  if (!value) return "Not started";
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return "Dates not set";
  const format = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Unknown";
  return `${format(startDate)} - ${format(endDate)}`;
}

function describeCycleAction(status?: string): WorkspaceTab {
  if (status === "approved" || status === "finalize_failed") return "finalize";
  if (status === "preview_ready" || status === "review_in_progress") return "review";
  if (status === "finalized" || status === "rolled_back" || status === "rollback_failed") {
    return "history";
  }
  return "overview";
}

function renderWorkspace(tab: WorkspaceTab) {
  if (tab === "review") return <ReviewTab />;
  if (tab === "placement") return <PlacementTab />;
  if (tab === "finalize") return <FinalizeTab />;
  if (tab === "history") return <HistoryTab />;
  return null;
}

export default function PromotionsPage() {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>("overview");
  const [policyWizardOpen, setPolicyWizardOpen] = React.useState(false);
  const [previewWizardOpen, setPreviewWizardOpen] = React.useState(false);
  const [selectedPolicy, setSelectedPolicy] = React.useState<PromotionPolicyDTO | null>(null);
  const [policyDetailsOpen, setPolicyDetailsOpen] = React.useState(false);

  const { data: policyData } = usePromotionPolicyActive();
  const { data: policiesData } = usePromotionPolicies();
  const { data: cyclesData } = usePromotionCycles({ limit: 6 });
  const deletePolicy = useDeletePromotionPolicy();
  const deleteCycle = useDeletePromotionCycle();
  const { data: periodsData } = useAcademicPeriods();
  const { data: gradesData } = useGradeOptions();

  const activePolicies = policyData?.policies ?? [];
  const allPolicies = policiesData?.data ?? [];
  const inactivePolicies = allPolicies.filter((policy) => !policy.isActive);
  const cycles = cyclesData?.data ?? [];
  const periods = periodsData?.periods ?? [];
  const grades = gradesData ?? [];

  const latestCycle = cycles[0];
  const pendingReviewCycle = cycles.find((cycle) =>
    ["preview_ready", "review_in_progress"].includes(cycle.status)
  );
  const pendingFinalizeCycle = cycles.find((cycle) =>
    ["approved", "finalize_failed"].includes(cycle.status)
  );

  const periodById = React.useMemo(
    () => new Map(periods.map((period) => [String(period._id), period])),
    [periods]
  );
  const gradeNameById = React.useMemo(
    () => new Map(grades.map((grade) => [grade._id, grade.name])),
    [grades]
  );

  const nextAction = !latestCycle
    ? activePolicies.length > 0
      ? "Run a preview"
      : "Create a policy"
    : pendingFinalizeCycle
      ? "Finalize the approved cycle"
      : pendingReviewCycle
        ? "Review preview decisions"
        : "Run the next preview";

  const leoGuidance = React.useMemo(() => {
    if (activePolicies.length === 0) {
      return {
        title: "Start with a promotion policy",
        body:
          "Leo can explain every promotion decision much more clearly when there is an active policy for the grades you are promoting.",
        actions: [
          "Create a whole-school policy if all grades share the same rules.",
          "Scope policies by grade when junior and primary sections promote differently.",
          "After the policy is active, let Leo run a read-only preview before touching live records.",
        ],
      };
    }

    if (pendingFinalizeCycle) {
      return {
        title: "An approved cycle is waiting",
        body:
          "Leo has already prepared a cycle that passed review. Use Finalize only after placements and exceptions look correct.",
        actions: [
          `${pendingFinalizeCycle.totals.promote} students are set to promote in the current approved cycle.`,
          "Same-section placement is preferred automatically, like JHS 1 A -> JHS 2 A.",
          "Finalize is the only step that changes live student grade and class records.",
        ],
      };
    }

    if (pendingReviewCycle) {
      return {
        title: "Review the latest preview",
        body:
          "Leo has already simulated the promotion run. The next safe step is to review holds, repeats, and any placement conflicts before approval.",
        actions: [
          `${pendingReviewCycle.totals.hold} hold decisions may need a human call.`,
          `${pendingReviewCycle.totals.repeat} repeat decisions should be checked for fairness.`,
          "Use Placement for promoted students who still need target classes.",
        ],
      };
    }

    return {
      title: "Leo is ready for the next year-end run",
      body:
        "Use the overview to keep policy setup simple, then let Leo run a preview for the academic period students are finishing.",
      actions: [
        "Previews are academic-period aware and do not move students yet.",
        "Leo prefers the next grade and the same section name when assigning placements.",
        "Review and approval still stay in your hands before finalization.",
      ],
    };
  }, [activePolicies.length, pendingFinalizeCycle, pendingReviewCycle]);

  const handleDeletePolicy = React.useCallback(
    async (policy: PromotionPolicyDTO) => {
      const ok = await confirm({
        title: "Delete promotion policy?",
        description: policy.isActive
          ? `This will remove the active policy "${policy.name}". Existing promotion cycles remain intact because they already store a policy snapshot.`
          : `This will permanently delete "${policy.name}".`,
        confirmLabel: "Delete policy",
        intent: "destructive",
      });
      if (ok !== "confirm") return;

      try {
        await busy.promise(deletePolicy.mutateAsync(policy.id), {
          loading: "Deleting promotion policy...",
          success: "Promotion policy deleted",
          error: (error: Error) => error.message,
        });
        setPolicyDetailsOpen(false);
        setSelectedPolicy(null);
      } catch {
        // busy toast handles the error state
      }
    },
    [busy, confirm, deletePolicy]
  );

  const handleDeleteCycle = React.useCallback(
    async (cycleId: string, sourceYearLabel: string) => {
      const ok = await confirm({
        title: "Delete promotion run?",
        description: `This will permanently delete the promotion run "${sourceYearLabel}" and all of its review decisions.`,
        confirmLabel: "Delete run",
        intent: "destructive",
      });
      if (ok !== "confirm") return;

      try {
        await busy.promise(deleteCycle.mutateAsync(cycleId), {
          loading: "Deleting promotion run...",
          success: "Promotion run deleted",
          error: (error: Error) => error.message,
        });
      } catch {
        // busy toast handles the error state
      }
    },
    [busy, confirm, deleteCycle]
  );

  return (
    <>
      <div className="space-y-8 pb-10">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section className="relative overflow-hidden rounded-[1.8rem] border border-amber-500/20 bg-linear-to-br from-amber-950/40 via-slate-950 to-slate-950 p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_45%)]" />
            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
                <Sparkles className="h-3.5 w-3.5" />
                Academic Promotions
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.4rem]">
                  Keep promotions clear, staged, and easy to trust.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                  This page is now centered on Leo. Create or inspect active policies, let Leo run
                  a safe preview for the chosen academic period, then step into review, placements,
                  and finalization only when needed.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    Active policies
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">{activePolicies.length}</p>
                  <p className="mt-1 text-sm text-white/50">
                    {activePolicies.length > 0 ? "Ready for Leo previews" : "Create one to begin"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    Latest cycle
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {latestCycle?.sourceYearLabel ?? "No preview yet"}
                  </p>
                  <p className="mt-1 text-sm text-white/50">
                    {latestCycle ? formatStatus(latestCycle.status) : "Run the first preview"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    Next action
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">{nextAction}</p>
                  <p className="mt-1 text-sm text-white/50">Leo will guide the safe order.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setPolicyWizardOpen(true)} className="gap-2">
                  <BookOpenCheck className="h-4 w-4" />
                  Create policy
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                  onClick={() => setPreviewWizardOpen(true)}
                >
                  <GraduationCap className="h-4 w-4" />
                  Let Leo run preview
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-cyan-500/20 bg-cyan-500/10 p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <LeoIcon className="h-5 w-5 text-cyan-100" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Wand2 className="h-4 w-4" />
                  <p className="text-sm font-semibold">Leo promotion guide</p>
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {leoGuidance.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/70">{leoGuidance.body}</p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Leo will help you with
              </p>
              <ul className="mt-3 space-y-2.5 text-sm text-white/72">
                {leoGuidance.actions.map((action) => (
                  <li key={action} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Promotion workspace</h2>
            <p className="mt-1 text-sm text-white/50">
              Keep the detailed tools available, but only open them when you need them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                    isActive
                      ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeTab === "overview" ? (
          <div className="space-y-8">
            <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Active policies</h3>
                    <p className="mt-1 text-sm text-white/50">
                      Click any active policy to inspect the exact rules Leo will use.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                    onClick={() => setPolicyWizardOpen(true)}
                  >
                    <BookOpenCheck className="h-4 w-4" />
                    New policy
                  </Button>
                </div>

                {activePolicies.length === 0 ? (
                  <div className="mt-5 space-y-5">
                    <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                      <p className="text-base font-medium text-white">No active promotion policy yet</p>
                      <p className="mt-2 text-sm text-white/50">
                        Create one policy first, then Leo can use it to explain promotion outcomes.
                      </p>
                      <Button onClick={() => setPolicyWizardOpen(true)} className="mt-4 gap-2">
                        Create first policy
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {inactivePolicies.length > 0 ? (
                      <div className="rounded-[1.4rem] border border-white/10 bg-black/10 p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">Saved drafts</p>
                          <p className="mt-1 text-sm text-white/45">
                            These policies are not active yet, but you can still open or delete them.
                          </p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {inactivePolicies.map((policy) => (
                            <button
                              key={policy.id}
                              type="button"
                              onClick={() => {
                                setSelectedPolicy(policy);
                                setPolicyDetailsOpen(true);
                              }}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                            >
                              {policy.name} • v{policy.version}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="grid gap-4">
                      {activePolicies.map((policy) => {
                        const scopedGrades =
                          policy.appliesTo.gradeIds?.map(
                            (gradeId) => gradeNameById.get(gradeId) ?? "Unknown grade"
                          ) ?? [];
                        return (
                          <button
                            key={policy.id}
                            type="button"
                            onClick={() => {
                              setSelectedPolicy(policy);
                              setPolicyDetailsOpen(true);
                            }}
                            className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-5 text-left transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-white">{policy.name}</p>
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                              >
                                Active
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-white/10 bg-white/[0.04] text-white/70"
                              >
                                v{policy.version}
                              </Badge>
                            </div>

                            <p className="mt-3 text-sm text-white/55">
                              {scopedGrades.length > 0
                                ? `Applies to ${scopedGrades.join(", ")}`
                                : "Applies to all grades"}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {policy.criteria.map((criterion) => (
                                <Badge
                                  key={`${policy.id}-${criterion.key}-${criterion.operator}-${criterion.value}`}
                                  variant="outline"
                                  className="border-white/10 bg-white/[0.04] text-white/65"
                                >
                                  {criterion.key.replace(/_/g, " ")} {criterion.operator} {criterion.value}
                                </Badge>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {inactivePolicies.length > 0 ? (
                      <div className="rounded-[1.4rem] border border-white/10 bg-black/10 p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">Saved drafts</p>
                          <p className="mt-1 text-sm text-white/45">
                            Old or inactive policies can also be opened and deleted here.
                          </p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {inactivePolicies.map((policy) => (
                            <button
                              key={policy.id}
                              type="button"
                              onClick={() => {
                                setSelectedPolicy(policy);
                                setPolicyDetailsOpen(true);
                              }}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                            >
                              {policy.name} • v{policy.version}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">How Leo runs promotion</h3>
                    <p className="mt-1 text-sm text-white/50">
                      The engine already understands academic periods, next grades, and same-section
                      placements.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                    onClick={() => setPreviewWizardOpen(true)}
                  >
                    <GraduationCap className="h-4 w-4" />
                    Run preview
                  </Button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-100">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">Academic-period aware</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Leo evaluates students inside the source academic period you choose for the year-end run.
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-100">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">Smart placement</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Same-section promotion is preferred first, such as JHS 1 A to JHS 2 A, before other fallbacks.
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-100">
                      <Eye className="h-4 w-4" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">Preview first</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Leo creates a reviewable cycle first, so live student records stay untouched until finalization.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Recent promotion runs</h3>
                  <p className="mt-1 text-sm text-white/50">
                    Open the latest cycle directly where work is still pending.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  onClick={() => setActiveTab("history")}
                >
                  <History className="h-4 w-4" />
                  View all history
                </Button>
              </div>

              {cycles.length === 0 ? (
                <div className="mt-5 rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                  <p className="text-base font-medium text-white">No promotion cycles yet</p>
                  <p className="mt-2 text-sm text-white/50">
                    Use Leo to run the first preview for the academic period students are completing.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {cycles.map((cycle) => {
                    const sourcePeriod = cycle.sourceAcademicPeriodId
                      ? periodById.get(cycle.sourceAcademicPeriodId)
                      : undefined;
                    const targetPeriod = cycle.targetAcademicPeriodId
                      ? periodById.get(cycle.targetAcademicPeriodId)
                      : undefined;

                    return (
                      <article
                        key={cycle.id}
                        className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-white">{cycle.sourceYearLabel}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize",
                                STATUS_STYLES[cycle.status] ?? "border-white/10 bg-white/[0.04] text-white/70"
                              )}
                            >
                              {formatStatus(cycle.status)}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-white/40 hover:bg-rose-500/10 hover:text-rose-300"
                            onClick={() => handleDeleteCycle(cycle.id, cycle.sourceYearLabel)}
                            disabled={
                              deleteCycle.isPending ||
                              !DELETABLE_CYCLE_STATUSES.has(cycle.status)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              Source period
                            </p>
                            <p className="mt-2 text-sm font-medium text-white">
                              {sourcePeriod
                                ? `${sourcePeriod.yearLabel} • ${sourcePeriod.term}`
                                : cycle.sourceYearLabel}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {sourcePeriod
                                ? formatDateRange(sourcePeriod.startDate, sourcePeriod.endDate)
                                : "Period details unavailable"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              Target period
                            </p>
                            <p className="mt-2 text-sm font-medium text-white">
                              {targetPeriod
                                ? `${targetPeriod.yearLabel} • ${targetPeriod.term}`
                                : "Not set"}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {targetPeriod
                                ? formatDateRange(targetPeriod.startDate, targetPeriod.endDate)
                                : "Optional during preview setup"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              Evaluated
                            </p>
                            <p className="mt-1 text-lg font-semibold text-white">
                              {cycle.totals.studentsEvaluated}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              Promote
                            </p>
                            <p className="mt-1 text-lg font-semibold text-emerald-200">
                              {cycle.totals.promote}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              Hold
                            </p>
                            <p className="mt-1 text-lg font-semibold text-white">
                              {cycle.totals.hold}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              Created
                            </p>
                            <p className="mt-1 text-sm font-medium text-white/75">
                              {formatDate(cycle.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Button
                            type="button"
                            className="gap-2"
                            onClick={() => setActiveTab(describeCycleAction(cycle.status))}
                          >
                            Open {formatStatus(describeCycleAction(cycle.status))}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          {["preview_ready", "review_in_progress", "approved"].includes(cycle.status) ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                              onClick={() => setActiveTab("placement")}
                            >
                              Check placements
                              <MapPin className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-6">
            <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  Promotion workspace
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {WORKSPACE_TABS.find((tab) => tab.id === activeTab)?.label}
                </h3>
                <p className="mt-2 text-sm text-white/50">
                  {WORKSPACE_TABS.find((tab) => tab.id === activeTab)?.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  onClick={() => setActiveTab("overview")}
                >
                  <Layers3 className="h-4 w-4" />
                  Back to overview
                </Button>
                <Button onClick={() => setPreviewWizardOpen(true)} className="gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Run another preview
                </Button>
              </div>
            </div>

            {renderWorkspace(activeTab)}
          </section>
        )}
      </div>

      <PromotionPolicyWizard open={policyWizardOpen} onOpenChange={setPolicyWizardOpen} />
      <PromotionPreviewWizard
        open={previewWizardOpen}
        onOpenChange={setPreviewWizardOpen}
        onJumpToWorkspace={(tab) => setActiveTab(tab)}
      />
      <PromotionPolicyDetailsModal
        open={policyDetailsOpen}
        onOpenChange={setPolicyDetailsOpen}
        policy={selectedPolicy}
        gradeNameById={gradeNameById}
        onDelete={handleDeletePolicy}
        isDeleting={deletePolicy.isPending}
      />
      {confirmationDialog}
    </>
  );
}
