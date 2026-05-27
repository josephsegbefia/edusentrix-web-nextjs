import { redirect } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Eye,
  EyeOff,
  Layers,
  Settings2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { connectToDatabase } from "@/db/connectToDatabase";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import {
  PlatformPageHeader,
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformSection,
} from "@/components/platform/platform-page-primitives";
import { glassPanelClass, glassInsetClass } from "@/lib/ui/glass-surfaces";
import { PLAN_CODES, PLAN_META } from "@/lib/subscriptions/plan-codes";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PlanRow = {
  _id: unknown;
  code: string;
  name: string;
  description?: string | null;
  publicVisible: boolean;
  active: boolean;
  provisional: boolean;
  sortOrder: number;
  version: number;
  priceMinor: number;
  billingCadence: string;
  pricing?: {
    pricePerStudentPerTermMinor?: number | null;
    minimumTermFeeMinor?: number | null;
    annualDiscountPercent?: number | null;
  } | null;
  features: string[];
  limits?: Record<string, number | null> | null;
};

const PLAN_TONE: Record<string, string> = {
  pilot: "border-violet-500/30 bg-violet-500/10",
  starter: "border-cyan-500/30 bg-cyan-500/10",
  growth: "border-teal-500/30 bg-teal-500/10",
  premium: "border-amber-500/30 bg-amber-500/10",
};

const PLAN_ACCENT: Record<string, string> = {
  pilot: "text-violet-200",
  starter: "text-cyan-200",
  growth: "text-teal-200",
  premium: "text-amber-200",
};

const PLAN_ICON_TONE: Record<string, string> = {
  pilot: "bg-violet-500/10 text-violet-300",
  starter: "bg-cyan-500/10 text-cyan-300",
  growth: "bg-teal-500/10 text-teal-300",
  premium: "bg-amber-500/10 text-amber-300",
};

function PlanCard({ plan }: { plan: PlanRow }) {
  const tone = PLAN_TONE[plan.code] ?? "border-white/10 bg-white/5";
  const accent = PLAN_ACCENT[plan.code] ?? "text-white/80";
  const iconTone = PLAN_ICON_TONE[plan.code] ?? "bg-white/5 text-white/60";

  const perStudentLabel =
    plan.pricing?.pricePerStudentPerTermMinor != null
      ? `GHS ${(plan.pricing.pricePerStudentPerTermMinor / 100).toFixed(2)} / student / term`
      : null;

  const minFeeLabel =
    plan.pricing?.minimumTermFeeMinor != null
      ? `GHS ${(plan.pricing.minimumTermFeeMinor / 100).toLocaleString()} min / term`
      : null;

  return (
    <div className={cn(glassPanelClass, "flex flex-col gap-0 p-0")}>
      {/* Top shine */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

      {/* Header */}
      <div className={cn("rounded-t-2xl border-b border-white/10 p-5", tone)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", iconTone)}>
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <p className={cn("text-sm font-semibold uppercase tracking-wide", accent)}>
                {plan.code}
              </p>
              <h3 className="text-base font-semibold text-white">{plan.name}</h3>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {plan.active ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
                <CircleDashed className="h-3 w-3" /> Inactive
              </span>
            )}
            {plan.publicVisible ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
                <Eye className="h-3 w-3" /> Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
                <EyeOff className="h-3 w-3" /> Hidden
              </span>
            )}
          </div>
        </div>
        {plan.description ? (
          <p className="mt-3 text-xs leading-relaxed text-white/55">{plan.description}</p>
        ) : null}
      </div>

      {/* Pricing row */}
      <div className="border-b border-white/10 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
          {perStudentLabel ? (
            <span className="flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 text-white/40" />
              {perStudentLabel}
            </span>
          ) : (
            <span className="text-white/35">Custom pricing</span>
          )}
          {minFeeLabel ? (
            <span className="text-white/40">·</span>
          ) : null}
          {minFeeLabel ? <span>{minFeeLabel}</span> : null}
          {plan.pricing?.annualDiscountPercent ? (
            <>
              <span className="text-white/40">·</span>
              <span className="text-emerald-300">{plan.pricing.annualDiscountPercent}% annual discount</span>
            </>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-white/35">
          {plan.billingCadence} billing · v{plan.version}
        </p>
      </div>

      {/* Features summary */}
      <div className="flex-1 px-5 py-4">
        <p className="mb-2 text-xs font-medium text-white/50">Included features</p>
        <p className="text-sm font-semibold text-white">{plan.features.length}</p>
        {plan.features.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {plan.features.slice(0, 6).map((f) => (
              <span
                key={f}
                className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50"
              >
                {f}
              </span>
            ))}
            {plan.features.length > 6 ? (
              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                +{plan.features.length - 6} more
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-xs text-white/30">Configured per school (Pilot)</p>
        )}
      </div>

      {/* Footer action */}
      <div className="rounded-b-2xl border-t border-white/10 px-5 py-3">
        <Link
          href={`/platform/subscription-plans/${String(plan._id)}`}
          className="inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage plan
        </Link>
      </div>
    </div>
  );
}

export default async function PlatformSubscriptionPlansPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) redirect("/dashboard");

  if (!hasPlatformPermission(auth.actor, "platform.billing.read")) {
    redirect("/platform");
  }

  await connectToDatabase();

  const [plans, totalPlans, activePlans, publicPlans] = await Promise.all([
    SubscriptionTier.find({}).sort({ sortOrder: 1, active: -1 }).lean<PlanRow[]>(),
    SubscriptionTier.countDocuments({}),
    SubscriptionTier.countDocuments({ active: true }),
    SubscriptionTier.countDocuments({ publicVisible: true }),
  ]);

  const hasSeededPlans = plans.some((p) =>
    Object.values(PLAN_CODES).includes(p.code as any)
  );

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Revenue Management"
        title="Subscription plans"
        description="Manage the plan catalogue that schools are subscribed to. Pilot, Starter, Growth, and Premium. Run the seed script to initialise default plans."
        actions={
          <Link
            href="/platform/schools"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <Layers className="h-4 w-4" />
            View schools
          </Link>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={CreditCard}
          label="Total plans"
          value={String(totalPlans)}
          note="All plan records"
          tone="cyan"
        />
        <PlatformMetricCard
          icon={CheckCircle2}
          label="Active plans"
          value={String(activePlans)}
          note="Available for assignment"
          tone="emerald"
        />
        <PlatformMetricCard
          icon={Eye}
          label="Public plans"
          value={String(publicPlans)}
          note="Visible on pricing page"
          tone="violet"
        />
        <PlatformMetricCard
          icon={Sparkles}
          label="Canonical plans"
          value={hasSeededPlans ? "Seeded" : "Not seeded"}
          note={hasSeededPlans ? "Default plans present" : "Run seed:subscription-plans"}
          tone={hasSeededPlans ? "emerald" : "amber"}
        />
      </PlatformMetricGrid>

      {!hasSeededPlans ? (
        <div className={cn(glassInsetClass, "flex items-start gap-4 px-5 py-4")}>
          <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-200">Default plans not yet seeded</p>
            <p className="mt-1 text-xs text-white/55">
              Run{" "}
              <code className="rounded bg-white/10 px-1 font-mono text-white/70">
                npm run seed:subscription-plans
              </code>{" "}
              to create the Pilot, Starter, Growth, and Premium plans with their default features and
              limits. You can customise them here after seeding.
            </p>
          </div>
        </div>
      ) : null}

      <PlatformSection
        title="Plan catalogue"
        description="The four canonical plans. Pilot is platform-admin only. Starter, Growth, and Premium are available for assignment."
      >
        {plans.length === 0 ? (
          <div className={cn(glassInsetClass, "py-12 text-center")}>
            <CreditCard className="mx-auto mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/50">No plans found.</p>
            <p className="mt-1 text-xs text-white/30">
              Run <code className="font-mono">npm run seed:subscription-plans</code> to seed default plans.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <PlanCard key={String(plan._id)} plan={plan} />
            ))}
          </div>
        )}
      </PlatformSection>
    </div>
  );
}
