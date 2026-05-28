/**
 * LockedModulePage — shown when a school's plan does not include a module.
 *
 * Usage (server component):
 *
 *   const snapshot = await resolveSchoolEntitlements(schoolId);
 *   if (!snapshot?.hasFeature(FEATURE_KEYS.ACADEMICS_SCHEMES)) {
 *     return <LockedModulePage featureKey={FEATURE_KEYS.ACADEMICS_SCHEMES} />;
 *   }
 *
 * Usage (client component boundary):
 *
 *   <LockedModulePage featureKey="academics.schemes" planName="Growth" />
 *
 * Spec §13.3.
 */

import * as React from "react";
import Link from "next/link";
import {
  Lock,
  ArrowRight,
  Sparkles,
  Zap,
  BookOpen,
  BarChart3,
  Brain,
  Video,
  CreditCard,
} from "lucide-react";
import { glassPanelClass, glassInsetClass } from "@/lib/ui/glass-surfaces";
import { FEATURE_DEFINITIONS } from "@/lib/subscriptions/feature-keys";
import { PLAN_META } from "@/lib/subscriptions/plan-codes";
import { cn } from "@/lib/utils";

type LockedModulePageProps = {
  /** The canonical feature key that is locked. */
  featureKey: string;
  /**
   * Which plan unlocks this feature.
   * If omitted, the component derives it from PLAN_META.
   */
  requiredPlan?: "starter" | "growth" | "enterprise";
  /** Current plan name — shown as "you are on X". */
  currentPlanName?: string | null;
  /** Whether the enforcement is actually on. When false, shows a softer message. */
  enforcementEnabled?: boolean;
};

const MODULE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  academics: BookOpen,
  assessment: BookOpen,
  ai: Brain,
  analytics: BarChart3,
  learn: Sparkles,
  meetings: Video,
  communications: Zap,
};

const PLAN_REQUIRED_FOR_FEATURE: Record<string, "starter" | "growth" | "enterprise"> = {
  "academics.schemes": "growth",
  "academics.lesson_notes": "growth",
  "academics.curriculum": "growth",
  "academics.lessons": "growth",
  "assessment.examinations": "growth",
  "assessment.question_bank": "growth",
  "ai.leo": "growth",
  "ai.lesson_generation": "growth",
  "ai.exam_generation": "growth",
  "ai.analytics": "enterprise",
  "analytics.advanced": "enterprise",
  "learn.manage": "growth",
  "learn.student_access": "growth",
  "meetings.video": "enterprise",
  "communications.messaging": "growth",
  "communications.community": "enterprise",
  "finance.reconciliation": "starter",
  "finance.disbursements": "growth",
  "support.priority": "growth",
  "developer.api_access": "enterprise",
};

export function LockedModulePage({
  featureKey,
  requiredPlan: requiredPlanProp,
  currentPlanName,
  enforcementEnabled = false,
}: LockedModulePageProps) {
  const def = FEATURE_DEFINITIONS[featureKey as keyof typeof FEATURE_DEFINITIONS];
  const featureModule = def?.module ?? featureKey.split(".")[0];
  const label = def?.label ?? featureKey;
  const description = def?.description ?? "This module is not available on your current plan.";

  const requiredPlanCode = requiredPlanProp ?? PLAN_REQUIRED_FOR_FEATURE[featureKey] ?? "growth";
  const requiredPlanMeta = PLAN_META[requiredPlanCode];

  const Icon = MODULE_ICON_MAP[featureModule] ?? Lock;

  return (
    <div className="flex min-h-[480px] items-center justify-center px-4 py-12">
      <div className={cn(glassPanelClass, "w-full max-w-lg px-0 py-0")}>
        {/* Top shine */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-violet-500/8 blur-3xl" />

        {/* Lock badge */}
        <div className="flex flex-col items-center px-8 pb-6 pt-8 text-center">
          <div className="relative mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Icon className="h-7 w-7 text-white/40" />
            </div>
            <div className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-slate-900 shadow-lg">
              <Lock className="h-3 w-3 text-white/50" />
            </div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-white">{label}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">{description}</p>

          {/* Plan callout */}
          <div className={cn(glassInsetClass, "mt-5 w-full px-4 py-3 text-left")}>
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
              <div>
                <p className="text-xs font-semibold text-white/70">
                  Available on the{" "}
                  <span className="text-teal-300">{requiredPlanMeta.label}</span> plan
                  {requiredPlanCode !== "growth" ? ` and above` : " and above"}
                </p>
                <p className="mt-0.5 text-xs text-white/40">{requiredPlanMeta.description}</p>
                {currentPlanName ? (
                  <p className="mt-1 text-xs text-white/30">
                    Your school is currently on <span className="text-white/50">{currentPlanName}</span>.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {enforcementEnabled ? (
            // Enforcement is on — show upgrade path
            <div className="mt-5 flex w-full flex-col gap-2">
              <Link
                href="/admin/subscription"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-400/30 bg-teal-500/15 px-4 py-2.5 text-sm font-medium text-teal-100 transition hover:bg-teal-500/25"
              >
                View subscription details
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <p className="text-xs text-white/30">
                Contact the EduSentrix platform team to upgrade your plan.
              </p>
            </div>
          ) : (
            // Enforcement is off — show info-only state
            <div className={cn(glassInsetClass, "mt-5 w-full px-4 py-3 text-center")}>
              <p className="text-xs text-white/40">
                Subscription gating is currently being set up. This module will be
                available once your school is on a compatible plan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * LockedFeatureInline — a smaller inline locked state for action buttons inside pages.
 * Use this when a feature within an accessible page is gated (spec §13.4).
 */
export function LockedFeatureInline({
  featureKey,
  children,
}: {
  featureKey: string;
  children?: React.ReactNode;
}) {
  const def = FEATURE_DEFINITIONS[featureKey as keyof typeof FEATURE_DEFINITIONS];
  const label = def?.label ?? featureKey;
  const requiredPlanCode = PLAN_REQUIRED_FOR_FEATURE[featureKey] ?? "growth";
  const requiredPlanMeta = PLAN_META[requiredPlanCode];

  return (
    <div className={cn(glassInsetClass, "flex items-center gap-3 px-4 py-3")}>
      <Lock className="h-4 w-4 shrink-0 text-white/30" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/60">
          <span className="font-medium text-white/80">{label}</span> is available on the{" "}
          <span className="text-teal-300">{requiredPlanMeta.label}</span> plan.
        </p>
        {children ? <div className="mt-1">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * LockedAccessModeBanner — shown inside pages when access mode restricts writes.
 */
export function LockedAccessModeBanner({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div>
        <p className="text-sm text-amber-200">{message}</p>
        <Link
          href="/admin/subscription"
          className="mt-1 inline-flex items-center gap-1 text-xs text-amber-300 underline-offset-2 hover:underline"
        >
          View subscription
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
