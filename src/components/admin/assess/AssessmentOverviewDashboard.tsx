"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  FileCheck2,
  FileText,
  GraduationCap,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  ScanLine,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  glassInsetClass,
  glassPanelClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { describeAssessAccessBlocker } from "@/lib/assess/assessment-ux-guidance";
import { cn } from "@/lib/utils";

type OverviewData = {
  school: { id: string; name: string };
  metrics: {
    publishedExaminations: number;
    evidenceRequiringAttention: number;
    markingAwaitingReview: number;
    approvedAwaitingHandoff: number;
  };
  attention: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string;
    count: number;
    href: string;
  }>;
  recentExaminations: Array<{
    id: string;
    title: string;
    status: string;
    version: number;
    resultBinding: string;
    updatedAt: string;
    href: string;
  }>;
};

type CoreExamination = {
  id: string | null;
  title: string;
  status: string;
  scope: "class_group" | "grade_wide";
  updatedAt: string | null;
};

type OverviewAction = {
  eyebrow: string;
  label: string;
  href: string;
  detail: string;
  icon: LucideIcon;
  journeyIndex: number;
};

type MetricCard = {
  label: string;
  value: number | null;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

type RecentItem = {
  id: string;
  title: string;
  context: string;
  status: string;
  updatedAt: string | null;
  href: string;
  action: string;
};

const JOURNEY_STEPS = [
  {
    label: "Create examination",
    description: "Set questions and choose the right classes.",
    href: "/admin/examinations",
    icon: GraduationCap,
  },
  {
    label: "Prepare paper",
    description: "Review and freeze a safe paper version.",
    href: "/admin/assessments/paper?focus=paper-delivery#paper-delivery",
    icon: FileCheck2,
  },
  {
    label: "Print and scan",
    description: "Issue secure copies and reconcile scripts.",
    href: "/admin/assessments/paper?focus=packets#packets",
    icon: PackageCheck,
  },
  {
    label: "Mark and review",
    description: "Assign, moderate and approve marking.",
    href: "/admin/assessments/paper?focus=marking#marking",
    icon: ClipboardCheck,
  },
  {
    label: "Send approved marks",
    description: "Hand off approved results to Gradebook.",
    href: "/admin/assessments/paper?focus=approved-results#approved-results",
    icon: Send,
  },
] as const;

function formatDate(value: string | null) {
  if (!value) return "Recently updated";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently updated"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function readableStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isDraftPaper(paper: CoreExamination) {
  return ["draft", "needs_revision"].includes(paper.status);
}

function isApprovedSourcePaper(paper: CoreExamination) {
  return ["approved", "completed"].includes(paper.status);
}

function buildOverviewAction(
  data: OverviewData,
  corePapers: CoreExamination[] | null,
): OverviewAction {
  const approvedCorePapers = (corePapers ?? []).filter(isApprovedSourcePaper);
  const publishedDelivery = data.recentExaminations.find(
    (delivery) => delivery.status === "published",
  );

  if (data.metrics.approvedAwaitingHandoff > 0) {
    return {
      eyebrow: "Ready for handoff",
      label: "Send approved marks",
      href: "/admin/assessments/paper?focus=approved-results#approved-results",
      detail: `${data.metrics.approvedAwaitingHandoff} approved ${
        data.metrics.approvedAwaitingHandoff === 1 ? "result is" : "results are"
      } ready for the existing Gradebook handoff review.`,
      icon: Send,
      journeyIndex: 4,
    };
  }

  if (data.metrics.evidenceRequiringAttention > 0) {
    return {
      eyebrow: "Scripts need attention",
      label: "Review scanned scripts",
      href: "/admin/assessments/paper?focus=evidence#evidence",
      detail: `${data.metrics.evidenceRequiringAttention} ${
        data.metrics.evidenceRequiringAttention === 1 ? "page needs" : "pages need"
      } reconciliation before marking can continue.`,
      icon: ScanLine,
      journeyIndex: 3,
    };
  }

  if (data.metrics.markingAwaitingReview > 0) {
    return {
      eyebrow: "Review marking",
      label: "Review submitted marking",
      href: "/admin/assessments/paper?focus=marking#marking",
      detail: `${data.metrics.markingAwaitingReview} submitted ${
        data.metrics.markingAwaitingReview === 1 ? "evaluation is" : "evaluations are"
      } awaiting independent review.`,
      icon: ClipboardCheck,
      journeyIndex: 3,
    };
  }

  if (publishedDelivery) {
    return {
      eyebrow: "Paper delivery ready",
      label: "Continue to printing",
      href: publishedDelivery.href,
      detail:
        "Open the latest published delivery to issue secure paper packets or continue its workflow.",
      icon: PackageCheck,
      journeyIndex: 2,
    };
  }

  if (approvedCorePapers.length === 1 && approvedCorePapers[0]?.id) {
    return {
      eyebrow: "Approved examination",
      label: "Prepare approved examination",
      href: `/admin/assessments/paper?sourceExamPaperId=${encodeURIComponent(
        approvedCorePapers[0].id,
      )}&focus=paper-delivery#paper-delivery`,
      detail:
        "It is ready for an explicit Premium paper publication. Completing a Core examination does not publish it automatically.",
      icon: FileCheck2,
      journeyIndex: 1,
    };
  }

  if (approvedCorePapers.length > 1) {
    return {
      eyebrow: "Approved examinations",
      label: "Choose an examination to prepare",
      href: "/admin/examinations",
      detail: `${approvedCorePapers.length} approved Core examinations can be prepared separately. Choose the right source paper before publishing an immutable version.`,
      icon: FileCheck2,
      journeyIndex: 1,
    };
  }

  if (data.metrics.publishedExaminations > 0) {
    return {
      eyebrow: "Paper versions ready",
      label: "Prepare a paper delivery",
      href: "/admin/assessments/paper?focus=paper-delivery#paper-delivery",
      detail:
        "A published paper version is ready to be prepared as a delivery. Printing remains a separate controlled step.",
      icon: PackageCheck,
      journeyIndex: 1,
    };
  }

  return {
    eyebrow: "Start here",
    label: "Create your first examination",
    href: "/admin/examinations",
    detail:
      "Create the examination in Core, then return here to prepare, issue, review and hand off its paper assessment work.",
    icon: GraduationCap,
    journeyIndex: 0,
  };
}

function buildRecentItems(
  data: OverviewData,
  corePapers: CoreExamination[] | null,
): RecentItem[] {
  const deliveryItems: RecentItem[] = data.recentExaminations.map((delivery) => ({
    id: `delivery:${delivery.id}`,
    title: delivery.title,
    context: `Premium paper v${delivery.version}`,
    status: delivery.status,
    updatedAt: delivery.updatedAt,
    href: delivery.href,
    action: "Open paper",
  }));

  const coreItems: RecentItem[] = (corePapers ?? [])
    .filter((paper) => paper.id)
    .map((paper) => ({
      id: `core:${paper.id}`,
      title: paper.title,
      context:
        paper.scope === "grade_wide"
          ? "Core examination · grade-wide"
          : "Core examination · class group",
      status: paper.status,
      updatedAt: paper.updatedAt,
      href: isApprovedSourcePaper(paper)
        ? `/admin/assessments/paper?sourceExamPaperId=${encodeURIComponent(
            paper.id ?? "",
          )}&focus=paper-delivery#paper-delivery`
        : `/admin/examinations/${encodeURIComponent(paper.id ?? "")}`,
      action: isApprovedSourcePaper(paper)
        ? "Prepare in Assess"
        : "Open examination",
    }));

  return [...deliveryItems, ...coreItems]
    .sort((left, right) => {
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 6);
}

function statusBadgeClass(status: string) {
  if (["approved", "published", "completed"].includes(status)) {
    return "border-emerald-400/30 bg-emerald-400/10 text-(--ws-emerald)";
  }
  if (["submitted", "review"].includes(status)) {
    return "border-amber-400/30 bg-amber-400/10 text-(--ws-amber)";
  }
  return "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)";
}

export function AssessmentOverviewDashboard() {
  const [data, setData] = React.useState<OverviewData | null>(null);
  const [corePapers, setCorePapers] = React.useState<CoreExamination[] | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [coreDataUnavailable, setCoreDataUnavailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [locked, setLocked] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setLocked(false);
    setCoreDataUnavailable(false);

    try {
      const response = await fetch("/api/admin/assess/overview", {
        cache: "no-store",
      });
      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: OverviewData;
        error?: string;
      } | null;

      if ([401, 403, 409].includes(response.status)) {
        setLocked(true);
        setError(
          json?.error ??
            "Premium Assess access is not available for the selected school.",
        );
        setData(null);
        setCorePapers(null);
        return;
      }

      if (!response.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? "Unable to load the Assess overview");
      }

      setData(json.data);

      const coreResponse = await fetch("/api/admin/examinations?limit=100", {
        cache: "no-store",
      });
      const coreJson = (await coreResponse.json().catch(() => null)) as {
        success?: boolean;
        data?: CoreExamination[];
      } | null;
      if (
        !coreResponse.ok ||
        !coreJson?.success ||
        !Array.isArray(coreJson.data)
      ) {
        setCoreDataUnavailable(true);
        setCorePapers(null);
        return;
      }

      setCorePapers(coreJson.data);
    } catch (cause) {
      setData(null);
      setCorePapers(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load the Assess overview",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const blocker = locked ? describeAssessAccessBlocker(error) : null;
  const action = data ? buildOverviewAction(data, corePapers) : null;
  const draftCount = corePapers ? corePapers.filter(isDraftPaper).length : null;
  const recentItems = data ? buildRecentItems(data, corePapers) : [];
  const metrics: MetricCard[] = data
    ? [
        {
          label: "Draft examinations",
          value: draftCount,
          description: coreDataUnavailable
            ? "Core examination data is unavailable right now."
            : "Core papers that still need authoring or revision.",
          href: "/admin/examinations",
          icon: FileText,
          tone: "border-slate-400/25 bg-slate-400/10 text-(--ws-fg-70)",
        },
        {
          label: "Ready to print",
          value: data.metrics.publishedExaminations,
          description: "Published versions ready to prepare for printing.",
          href: "/admin/assessments/paper?focus=paper-delivery#paper-delivery",
          icon: FileCheck2,
          tone: "border-sky-400/30 bg-sky-400/10 text-(--ws-cyan)",
        },
        {
          label: "Scans requiring review",
          value: data.metrics.evidenceRequiringAttention,
          description: "Captured pages that still need reconciliation.",
          href: "/admin/assessments/paper?focus=evidence#evidence",
          icon: ScanLine,
          tone: "border-amber-400/30 bg-amber-400/10 text-(--ws-amber)",
        },
        {
          label: "Marking in progress",
          value: data.metrics.markingAwaitingReview,
          description: "Submitted evaluations awaiting independent review.",
          href: "/admin/assessments/paper?focus=marking#marking",
          icon: ClipboardCheck,
          tone: "border-violet-400/30 bg-violet-400/10 text-(--ws-violet)",
        },
        {
          label: "Approved marks awaiting handoff",
          value: data.metrics.approvedAwaitingHandoff,
          description: "Approved results not yet sent to the Core Gradebook.",
          href: "/admin/assessments/paper?focus=approved-results#approved-results",
          icon: ShieldCheck,
          tone: "border-emerald-400/30 bg-emerald-400/10 text-(--ws-emerald)",
        },
      ]
    : [];

  return (
    <WorkspacePageShell
      ambient={false}
      className="mx-auto w-full max-w-[1440px] px-1 pb-4 sm:px-2"
    >
      <WorkspacePageHeader
        title="EduSentrix Assess"
        subtitle={
          data
            ? "Manage paper examinations from creation to Gradebook handoff."
            : "A guided workspace for secure paper examinations."
        }
        badge={
          <Badge className="gap-1.5 border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-(--ws-violet)">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            Premium
          </Badge>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("gap-2", glassSecondaryButtonClass)}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        }
      />
      {data ? (
        <p className="-mt-4 text-sm font-medium text-(--ws-fg-60)">
          {data.school.name}
        </p>
      ) : null}

      <section
        aria-labelledby="assessment-journey-heading"
        className="border-y border-(--ws-line) py-4 sm:py-5"
      >
        <h2 id="assessment-journey-heading" className="sr-only">
          Assessment journey
        </h2>
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5 xl:gap-0">
          {JOURNEY_STEPS.map((step, index) => {
            const Icon = step.icon;
            const suggested = action?.journeyIndex === index;
            return (
              <li key={step.label} className="relative min-w-0 xl:pr-5">
                {index < JOURNEY_STEPS.length - 1 ? (
                  <span
                    className="pointer-events-none absolute left-11 right-0 top-5 hidden h-px bg-(--ws-line-strong) xl:block"
                    aria-hidden="true"
                  />
                ) : null}
                <Link
                  href={step.href}
                  aria-label={`${step.label}${suggested ? " (suggested next step)" : ""}`}
                  className="group relative flex min-h-20 gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-(--ws-fill) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan)"
                >
                  <span
                    className={cn(
                      "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                      suggested
                        ? "border-violet-400/40 bg-violet-500/15 text-(--ws-violet)"
                        : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 pr-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-(--ws-fg)">
                      <Icon
                        className="h-4 w-4 text-(--ws-fg-50)"
                        aria-hidden="true"
                      />
                      {step.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-(--ws-fg-60)">
                      {step.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {locked && blocker ? (
        <GlassPanel className="p-5 sm:p-6" glow="cyan">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--ws-line) bg-(--ws-fill) text-(--ws-violet)">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">
                {blocker.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">
                {blocker.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-(--ws-fg-60)">
                {blocker.explanation}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-(--ws-fg-60)">
                {blocker.resolution}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild className={glassPrimaryButtonClass}>
                  <Link href="/admin/examinations">
                    Continue with Core examinations
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={glassSecondaryButtonClass}
                  onClick={() => void load()}
                  disabled={loading}
                >
                  Check access again
                </Button>
              </div>
            </div>
          </div>
        </GlassPanel>
      ) : null}

      {!locked && error ? (
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-(--ws-rose) sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-rose-400/30 bg-(--ws-fill) text-(--ws-rose) hover:bg-(--ws-fill-strong)"
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div
          className="space-y-5"
          aria-label="Loading Assess overview"
          aria-busy="true"
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
            <div className="h-56 animate-pulse rounded-2xl border border-(--ws-line) bg-(--ws-fill)" />
            <div className="h-56 animate-pulse rounded-2xl border border-(--ws-line) bg-(--ws-fill)" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl border border-(--ws-line) bg-(--ws-fill)"
              />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && data && !locked ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
            {action ? <PrimaryActionCard action={action} /> : null}
            <GuidancePanel />
          </div>

          <section aria-labelledby="assessment-summary-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-fg-50)">
                  At a glance
                </p>
                <h2
                  id="assessment-summary-heading"
                  className="mt-1 text-xl font-semibold text-(--ws-fg)"
                >
                  Assessment summary
                </h2>
              </div>
              <span className="text-xs text-(--ws-fg-50)">Live school data</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {metrics.map((metric) => (
                <MetricSummaryCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
            <RecentExaminationsPanel items={recentItems} />
            <OperationalGuidance attention={data.attention} />
          </div>
        </div>
      ) : null}
    </WorkspacePageShell>
  );
}

function PrimaryActionCard({ action }: { action: OverviewAction }) {
  const Icon = action.icon;

  return (
    <GlassPanel className="p-5 sm:p-6" glow="teal">
      <div className="flex h-full flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative hidden h-28 w-28 shrink-0 sm:block" aria-hidden="true">
          <div className="absolute inset-5 rotate-[-8deg] rounded-xl border border-(--ws-line) bg-(--ws-fill) shadow-[var(--ws-shadow)]" />
          <div className="absolute inset-3 rotate-[7deg] rounded-xl border border-violet-400/30 bg-violet-500/10" />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-(--ws-line-strong) bg-(--ws-panel-to) text-(--ws-violet)">
            <Icon className="h-9 w-9" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">
            {action.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-(--ws-fg) sm:text-3xl">
            {action.label}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-(--ws-fg-60)">
            {action.detail}
          </p>
          <Button asChild className={cn("mt-5", glassPrimaryButtonClass)}>
            <Link href={action.href}>
              {action.label}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}

function GuidancePanel() {
  const steps = [
    [
      "1",
      "Create and prepare",
      "Set up the Core examination, then explicitly prepare its paper version.",
    ],
    [
      "2",
      "Print, assign and scan",
      "Issue secure paper copies, match them to students and review incoming evidence.",
    ],
    [
      "3",
      "Review and hand off",
      "Moderate marking and send approved outcomes to the existing Gradebook.",
    ],
  ] as const;

  return (
    <GlassPanel className="p-5" glow="none">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--ws-line) bg-(--ws-fill) text-(--ws-cyan)">
          <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-fg-50)">
            Guided workflow
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-(--ws-fg)">
            How Assess works
          </h2>
        </div>
      </div>
      <ol className="mt-5 space-y-4">
        {steps.map(([number, title, description]) => (
          <li key={number} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-(--ws-line) bg-(--ws-fill) text-xs font-semibold text-(--ws-fg-70)">
              {number}
            </span>
            <span>
              <span className="block text-sm font-semibold text-(--ws-fg)">
                {title}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-(--ws-fg-60)">
                {description}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </GlassPanel>
  );
}

function MetricSummaryCard({ metric }: { metric: MetricCard }) {
  const Icon = metric.icon;

  return (
    <Link
      href={metric.href}
      className={cn(
        glassPanelClass,
        "group block min-h-[8.5rem] p-4 transition-colors hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan)",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border",
            metric.tone,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <ArrowRight
          className="mt-1 h-4 w-4 text-(--ws-fg-40) transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-(--ws-fg)">
        {metric.value === null ? "—" : metric.value.toLocaleString("en-GB")}
      </p>
      <h3 className="mt-1 text-sm font-semibold text-(--ws-fg)">
        {metric.label}
      </h3>
      <p className="mt-1 text-xs leading-5 text-(--ws-fg-60)">
        {metric.description}
      </p>
    </Link>
  );
}

function RecentExaminationsPanel({ items }: { items: RecentItem[] }) {
  return (
    <GlassPanel className="p-5" glow="none">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-fg-50)">
            Recent work
          </p>
          <h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">
            Recent examinations
          </h2>
          <p className="mt-1 text-sm text-(--ws-fg-60)">
            Continue a real Core examination or Premium paper delivery.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className={glassSecondaryButtonClass}>
          <Link href="/admin/examinations">
            View all examinations
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div
          className={cn(
            glassInsetClass,
            "flex min-h-44 flex-col items-center justify-center px-5 text-center",
          )}
        >
          <FileText className="h-7 w-7 text-(--ws-fg-40)" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-(--ws-fg)">No examinations yet</h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-(--ws-fg-60)">
            When you create an examination, its real progress and next step will
            appear here.
          </p>
          <Button asChild size="sm" className={cn("mt-4", glassPrimaryButtonClass)}>
            <Link href="/admin/examinations">Create examination</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-y border-(--ws-line) text-xs text-(--ws-fg-50)">
                  <th className="px-3 py-3 font-medium">Examination</th>
                  <th className="px-3 py-3 font-medium">Workspace</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Last updated</th>
                  <th className="px-3 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-(--ws-line) last:border-0">
                    <td className="px-3 py-3 font-medium text-(--ws-fg)">
                      {item.title}
                    </td>
                    <td className="px-3 py-3 text-(--ws-fg-60)">{item.context}</td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={statusBadgeClass(item.status)}>
                        {readableStatus(item.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-(--ws-fg-60)">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="text-(--ws-violet) hover:bg-(--ws-fill-strong) hover:text-(--ws-violet)"
                      >
                        <Link href={item.href}>
                          {item.action}
                          <ArrowRight
                            className="ml-1.5 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  glassInsetClass,
                  "block p-4 transition-colors hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan)",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-(--ws-fg)">{item.title}</p>
                    <p className="mt-1 text-xs text-(--ws-fg-60)">
                      {item.context} · updated {formatDate(item.updatedAt)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0", statusBadgeClass(item.status))}
                  >
                    {readableStatus(item.status)}
                  </Badge>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-(--ws-violet)">
                  {item.action}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </GlassPanel>
  );
}

function OperationalGuidance({
  attention,
}: {
  attention: OverviewData["attention"];
}) {
  return (
    <GlassPanel className="p-5" glow="cyan">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--ws-line) bg-(--ws-fill) text-(--ws-cyan)">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-fg-50)">
            Helpful guidance
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-(--ws-fg)">
            {attention.length ? "What needs attention" : "Tips for a smooth start"}
          </h2>
        </div>
      </div>

      {attention.length ? (
        <div className="mt-5 space-y-2">
          {attention.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                glassInsetClass,
                "group block p-3 transition-colors hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan)",
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-(--ws-fg)">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-(--ws-fg-60)">
                    {item.detail}
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-400/30 bg-amber-400/10 text-(--ws-amber)"
                >
                  {item.count}
                </Badge>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <ul className="mt-5 space-y-3 text-sm">
          <li className={cn(glassInsetClass, "p-3")}>
            <span className="font-semibold text-(--ws-fg)">Start with one class</span>
            <span className="mt-1 block text-xs leading-5 text-(--ws-fg-60)">
              Use a small examination first so the paper workflow is easy to review.
            </span>
          </li>
          <li className={cn(glassInsetClass, "p-3")}>
            <span className="font-semibold text-(--ws-fg)">Follow the guided steps</span>
            <span className="mt-1 block text-xs leading-5 text-(--ws-fg-60)">
              Each stage opens the next supported operation when its prerequisites are ready.
            </span>
          </li>
          <li className={cn(glassInsetClass, "p-3")}>
            <span className="font-semibold text-(--ws-fg)">Keep approval explicit</span>
            <span className="mt-1 block text-xs leading-5 text-(--ws-fg-60)">
              Core approval, Assess publication and Gradebook handoff remain separate decisions.
            </span>
          </li>
        </ul>
      )}

      <p className="mt-5 border-t border-(--ws-line) pt-4 text-xs leading-5 text-(--ws-fg-50)">
        Assess is a Premium workflow. Core examinations, marks, grading and report cards
        remain available through School OS.
      </p>
    </GlassPanel>
  );
}
