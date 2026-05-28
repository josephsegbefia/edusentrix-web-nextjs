"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Banknote,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Database,
  FileDown,
  Loader2,
  Lock,
  RefreshCw,
  Settings,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { glassPanelClass, glassInsetClass } from "@/lib/ui/glass-surfaces";
import { SubscriptionEventLog } from "@/components/subscriptions/SubscriptionEventLog";
import { cn } from "@/lib/utils";
import { LIMIT_KEYS, ONE_GB } from "@/lib/subscriptions/limit-keys";
import { getAccessModeBannerMessage } from "@/lib/subscriptions/access-mode";
import type { SchoolEntitlementSnapshot } from "@/lib/subscriptions/resolve-school-entitlements";

type SubscriptionData = Omit<SchoolEntitlementSnapshot, "hasFeature" | "getLimit"> & {
  features: string[];
  limits: Record<string, number | null>;
};

const STATUS_TONE: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  pilot: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  grace: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  restricted_read_only: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  suspended: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  draft: "border-white/10 bg-white/5 text-white/40",
  cancelled: "border-white/10 bg-white/5 text-white/40",
  expired: "border-white/10 bg-white/5 text-white/40",
  past_due: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

function formatGHS(minor: number) {
  return `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "Unlimited";
  if (bytes === 0) return "0 B";
  const gb = bytes / ONE_GB;
  return `${gb.toFixed(0)} GB`;
}

function UsageBar({
  label,
  used,
  limit,
  unit = "",
  icon: Icon,
}: {
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pct = limit !== null && limit > 0 ? Math.min(100, (used / limit) * 100) : null;
  const isUnlimited = limit === null;
  const isDanger = pct !== null && pct >= 90;
  const isWarning = pct !== null && pct >= 70 && pct < 90;

  return (
    <div className={cn(glassInsetClass, "px-4 py-3")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-white/40" />
          <span className="text-xs text-white/60">{label}</span>
        </div>
        <span className="text-xs text-white/50">
          {isUnlimited ? (
            <span className="text-emerald-300/70">Unlimited</span>
          ) : (
            <>
              <span className={cn("font-medium", isDanger ? "text-rose-300" : "text-white/80")}>
                {used.toLocaleString()}{unit}
              </span>
              {" / "}
              {limit !== null ? `${limit.toLocaleString()}${unit}` : "—"}
            </>
          )}
        </span>
      </div>
      {!isUnlimited && limit !== null && limit > 0 ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isDanger ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-teal-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      {enabled ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-400" />
      ) : (
        <Lock className="h-3.5 w-3.5 shrink-0 text-white/20" />
      )}
      <span className={cn("text-xs", enabled ? "text-white/70" : "text-white/30 line-through")}>
        {label}
      </span>
    </div>
  );
}

const DISPLAY_FEATURE_GROUPS: Array<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keys: string[];
}> = [
  {
    label: "Core",
    icon: Settings,
    keys: ["core.students", "core.teachers", "core.parents", "core.invitations", "core.academic_periods", "core.classes"],
  },
  {
    label: "Admissions & Finance",
    icon: Banknote,
    keys: ["admissions.applications", "admissions.fees", "finance.fees", "finance.invoices", "finance.payments", "finance.parent_payments", "finance.reconciliation", "finance.reports"],
  },
  {
    label: "Academics",
    icon: BookOpen,
    keys: ["academics.subjects", "academics.curriculum", "academics.schemes", "academics.lesson_notes", "academics.lessons"],
  },
  {
    label: "Assessment",
    icon: CheckCircle2,
    keys: ["assessment.examinations", "assessment.question_bank"],
  },
  {
    label: "AI & Leo",
    icon: Brain,
    keys: ["ai.leo", "ai.lesson_generation", "ai.exam_generation", "ai.analytics"],
  },
  {
    label: "Analytics",
    icon: BarChart3,
    keys: ["analytics.basic", "analytics.advanced"],
  },
  {
    label: "Learn & Meetings",
    icon: Video,
    keys: ["learn.manage", "learn.student_access", "meetings.video"],
  },
  {
    label: "Communications",
    icon: Zap,
    keys: ["communications.notices", "communications.messaging"],
  },
];

const FEATURE_LABELS: Record<string, string> = {
  "core.students": "Students",
  "core.teachers": "Teachers & Staff",
  "core.parents": "Parents",
  "core.invitations": "Invitations",
  "core.academic_periods": "Academic Periods",
  "core.classes": "Grades & Classes",
  "admissions.applications": "Admissions",
  "admissions.fees": "Admission Fees",
  "finance.fees": "Fee Setup",
  "finance.invoices": "Invoices",
  "finance.payments": "Payments",
  "finance.parent_payments": "Parent Payments",
  "finance.reconciliation": "Reconciliation",
  "finance.reports": "Finance Reports",
  "academics.subjects": "Subject Offerings",
  "academics.curriculum": "Curriculum",
  "academics.schemes": "Schemes of Learning",
  "academics.lesson_notes": "Lesson Notes",
  "academics.lessons": "Lessons",
  "assessment.examinations": "Examinations",
  "assessment.question_bank": "Question Bank",
  "ai.leo": "Leo AI",
  "ai.lesson_generation": "AI Lesson Generation",
  "ai.exam_generation": "AI Exam Generation",
  "ai.analytics": "AI Analytics",
  "analytics.basic": "Basic Analytics",
  "analytics.advanced": "Advanced Analytics",
  "learn.manage": "EduSentrix Learn",
  "learn.student_access": "Learn Student Access",
  "meetings.video": "Video Meetings",
  "communications.notices": "Notices",
  "communications.messaging": "Messaging",
};

export default function AdminSubscriptionPage() {
  const [data, setData] = React.useState<SubscriptionData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscription");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "subscription") return;
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) return;

    (async () => {
      try {
        const res = await fetch(`/api/admin/subscription/checkout-status?reference=${encodeURIComponent(reference)}`);
        const json = await res.json();
        if (json.success && json.data?.status === "succeeded") {
          await load();
        }
      } catch {
        // Non-blocking. Webhook still fulfills the payment.
      }
    })();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-64 items-center justify-center text-white/40">
        <p>Unable to load subscription information.</p>
      </div>
    );
  }

  const sub = data.subscription;
  const featureSet = new Set(data.features);
  const bannerMessage = getAccessModeBannerMessage(sub.accessMode, sub.gracePeriodEndsAt ?? undefined);
  const isEnforcementOn = process.env.NEXT_PUBLIC_SUBSCRIPTION_ENFORCEMENT_ENABLED === "true";

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className={cn(glassPanelClass, "px-5 py-5")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Subscription & Billing
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Your subscription
            </h1>
            <p className="mt-1 text-xs text-white/50">
              Plan details, feature access, and usage for {data.schoolName}.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/40 transition hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Access mode banner */}
      {bannerMessage ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-200">{bannerMessage}</p>
        </div>
      ) : null}

      {/* Enforcement off notice */}
      {!isEnforcementOn && (
        <div className={cn(glassInsetClass, "flex items-start gap-3 px-4 py-3")}>
          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
          <p className="text-xs text-white/40">
            Subscription gating is currently disabled. You have full access to all features while
            the billing system is being set up.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Subscription summary */}
        <div className="space-y-5">
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-white/50" />
              <p className="text-sm font-semibold text-white/80">Plan details</p>
            </div>

            {sub.planName ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{sub.planName}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      STATUS_TONE[sub.status] ?? STATUS_TONE.draft
                    )}
                  >
                    {sub.status}
                  </span>
                </div>

                {sub.effectivePriceMinor > 0 ? (
                  <p className="text-xs text-white/50">
                    {formatGHS(sub.effectivePriceMinor)} / {sub.billingCadence ?? "term"}
                  </p>
                ) : null}

                <div className="space-y-1 pt-2 text-xs">
                  {sub.startsAt ? (
                    <Row
                      label="Active since"
                      value={new Date(sub.startsAt).toLocaleDateString("en-GH", { dateStyle: "medium" })}
                    />
                  ) : null}
                  {sub.endsAt ? (
                    <Row
                      label="Renewal date"
                      value={new Date(sub.endsAt).toLocaleDateString("en-GH", { dateStyle: "medium" })}
                    />
                  ) : null}
                  {sub.gracePeriodEndsAt ? (
                    <Row
                      label="Grace period ends"
                      value={new Date(sub.gracePeriodEndsAt).toLocaleDateString("en-GH", { dateStyle: "medium" })}
                    />
                  ) : null}
                  {sub.lifecycleMode ? (
                    <Row label="Mode" value={sub.lifecycleMode} />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <CircleDashed className="mx-auto mb-2 h-6 w-6 text-white/20" />
                <p className="text-xs text-white/40">No active subscription.</p>
                <p className="mt-1 text-xs text-white/30">
                  Contact EduSentrix to set up your school&apos;s plan.
                </p>
              </div>
            )}
          </div>

          {/* Usage */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-3 text-sm font-semibold text-white/80">Usage</p>
            <div className="space-y-2">
              <UsageBar
                label="Students"
                used={data.usage.students}
                limit={data.limits[LIMIT_KEYS.maxStudents] ?? null}
                icon={Users}
              />
              <UsageBar
                label="Teachers"
                used={data.usage.teachers}
                limit={data.limits[LIMIT_KEYS.maxTeachers] ?? null}
                icon={Users}
              />
              <UsageBar
                label="Leo AI credits"
                used={data.usage.leoCreditsRemaining !== null
                  ? Math.max(0, (data.limits[LIMIT_KEYS.leoCreditsPerTerm] ?? 0) - data.usage.leoCreditsRemaining)
                  : 0}
                limit={data.limits[LIMIT_KEYS.leoCreditsPerTerm] ?? null}
                icon={Brain}
              />
              <UsageBar
                label="Storage"
                used={Math.round(data.usage.storageBytesUsed / ONE_GB)}
                limit={data.usage.storageBytesLimit !== null ? Math.round(data.usage.storageBytesLimit / ONE_GB) : null}
                unit=" GB"
                icon={Database}
              />
            </div>
          </div>

          {/* Payments */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-3 text-sm font-semibold text-white/80">Payment charges</p>
            <div className="space-y-1 text-xs">
              <Row label="Payer mode" value={data.transactionChargeSummary.defaultPayerMode.replace(/_/g, " ")} />
              <Row label="School fees" value={data.transactionChargeSummary.schoolFeesRateLabel} />
              <Row label="Admission fees" value={data.transactionChargeSummary.admissionFeesRateLabel} />
            </div>
            <p className="mt-3 text-[11px] text-white/30">
              Transaction charges are applied to parent payments. Contact EduSentrix for details.
            </p>
          </div>

          {/* Invoices */}
          <PlanChangePanel currentPlanCode={sub.planCode ?? null} />

          {/* Invoices */}
          <InvoicePanel />

          {/* Event history */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <SubscriptionEventLog
              apiPath="/api/admin/subscription/events"
              title="Subscription history"
              maxVisible={10}
            />
          </div>
        </div>

        {/* Feature access */}
        <div className={cn(glassPanelClass, "lg:col-span-2 px-0 py-0")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Feature access</h2>
            <p className="text-xs text-white/40">
              {featureSet.size} feature{featureSet.size !== 1 ? "s" : ""} enabled on your current plan.
            </p>
          </div>

          <div className="divide-y divide-white/5 p-4">
            {DISPLAY_FEATURE_GROUPS.map((group) => (
              <div key={group.label} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex items-center gap-2">
                  <group.icon className="h-3.5 w-3.5 text-white/30" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    {group.label}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  {group.keys.map((key) => (
                    <FeatureRow
                      key={key}
                      label={FEATURE_LABELS[key] ?? key}
                      enabled={featureSet.has(key)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span className="text-white/70">{value}</span>
    </div>
  );
}

type InvoiceItem = {
  _id: string;
  invoiceNumber: string;
  status: string;
  totalMinor: number;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  dueAt: string | null;
  paidAt: string | null;
  issuedAt: string | null;
};

type PlanOption = {
  _id: string;
  code: string;
  name: string;
  description?: string | null;
  pricing?: {
    pricePerStudentPerTermMinor?: number | null;
    minimumTermFeeMinor?: number | null;
    annualDiscountPercent?: number | null;
  } | null;
};

type PlanChangeQuote = {
  kind: "upgrade" | "downgrade" | "lateral";
  amountDueNowMinor: number;
  targetPeriodPriceMinor: number;
  currentPeriodPriceMinor: number;
  proratedCreditMinor: number;
  proratedTargetChargeMinor: number;
  effectiveAt: "immediate" | "renewal";
  scheduledAt: string | null;
  note: string;
};

const INV_STATUS_PILL: Record<string, string> = {
  issued: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  overdue: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  forgiven: "border-violet-500/30 bg-violet-500/10 text-violet-200",
};

function PlanChangePanel({ currentPlanCode }: { currentPlanCode: string | null }) {
  const [plans, setPlans] = React.useState<PlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState("");
  const [quote, setQuote] = React.useState<PlanChangeQuote | null>(null);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoadingPlans(true);
      try {
        const res = await fetch("/api/admin/subscription/plan-change");
        const json = await res.json();
        if (json.success) setPlans(json.data);
      } catch {
        // Non-blocking.
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, []);

  const selectedPlan = plans.find((plan) => plan._id === selectedPlanId) ?? null;

  async function requestQuote() {
    if (!selectedPlanId) return;
    setRequesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/subscription/plan-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId: selectedPlanId }),
      });
      const json = await res.json();
      if (json.success) {
        setQuote(json.data.quote ?? json.data);
        setMessage(
          json.data.invoice
            ? `Invoice ${json.data.invoice.invoiceNumber} issued. Use Pay on the invoice below to complete the upgrade.`
            : json.data.pendingPlanChange
              ? `Downgrade scheduled for ${new Date(json.data.pendingPlanChange.effectiveAt).toLocaleDateString("en-GH", { dateStyle: "medium" })}.`
            : "Plan change request recorded. EduSentrix billing will review and confirm the change."
        );
      } else {
        setMessage(typeof json.error === "string" ? json.error : "Unable to request plan change.");
      }
    } catch {
      setMessage("Unable to request plan change.");
    } finally {
      setRequesting(false);
    }
  }

  if (loadingPlans) return null;
  const visiblePlans = plans.filter((plan) => plan.code !== currentPlanCode);
  if (!visiblePlans.length) return null;

  return (
    <div className={cn(glassPanelClass, "px-5 py-4")}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      <div className="mb-3 flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-white/50" />
        <p className="text-sm font-semibold text-white/80">Plan changes</p>
      </div>
      <div className="space-y-3">
        <div className="grid gap-2">
          {visiblePlans.map((plan) => (
            <button
              key={plan._id}
              type="button"
              onClick={() => {
                setSelectedPlanId(plan._id);
                setQuote(null);
                setMessage(null);
              }}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition",
                selectedPlanId === plan._id
                  ? "border-cyan-400/40 bg-cyan-400/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white/80">{plan.name}</span>
                {plan.pricing?.pricePerStudentPerTermMinor ? (
                  <span className="text-[11px] text-white/40">
                    {formatGHS(plan.pricing.pricePerStudentPerTermMinor)} / student / term
                  </span>
                ) : null}
              </div>
              {plan.description ? (
                <p className="mt-1 text-xs text-white/40">{plan.description}</p>
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!selectedPlanId || requesting}
          onClick={requestQuote}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
          Request smart quote
        </button>

        {quote && selectedPlan ? (
          <div className={cn(glassInsetClass, "space-y-1 px-4 py-3 text-xs")}>
            <Row label="Target plan" value={selectedPlan.name} />
            <Row label="Change type" value={quote.kind} />
            <Row label="Current plan value" value={formatGHS(quote.currentPeriodPriceMinor)} />
            <Row label="Target plan value" value={formatGHS(quote.targetPeriodPriceMinor)} />
            <Row label="Prorated credit" value={formatGHS(quote.proratedCreditMinor)} />
            <Row label="Prorated target charge" value={formatGHS(quote.proratedTargetChargeMinor)} />
            <Row label="Amount due now" value={formatGHS(quote.amountDueNowMinor)} />
            <Row
              label="Effective"
              value={quote.effectiveAt === "renewal" && quote.scheduledAt
                ? new Date(quote.scheduledAt).toLocaleDateString("en-GH", { dateStyle: "medium" })
                : "After billing confirmation"}
            />
            <p className="pt-2 text-[11px] text-white/35">{quote.note}</p>
          </div>
        ) : null}

        {message ? <p className="text-xs text-white/40">{message}</p> : null}
      </div>
    </div>
  );
}

function InvoicePanel() {
  const [invoices, setInvoices] = React.useState<InvoiceItem[]>([]);
  const [loadingInv, setLoadingInv] = React.useState(true);
  const [payingId, setPayingId] = React.useState<string | null>(null);

  const loadInvoices = React.useCallback(async () => {
      try {
        const res = await fetch("/api/admin/subscription/invoices");
        const json = await res.json();
        if (json.success) setInvoices(json.data);
      } catch { /* silent */ }
      finally { setLoadingInv(false); }
  }, []);

  React.useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  async function startCheckout(invoiceId: string) {
    setPayingId(invoiceId);
    try {
      const res = await fetch(`/api/admin/subscription/invoices/${invoiceId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: "/admin/subscription" }),
      });
      const json = await res.json();
      if (json.success && json.data?.authorizationUrl) {
        window.location.href = json.data.authorizationUrl;
      }
    } catch {
      // Keep the panel stable; user can retry.
    } finally {
      setPayingId(null);
    }
  }
  if (loadingInv) return null;
  if (invoices.length === 0) return null;

  return (
    <div className={cn(glassPanelClass, "px-0 py-0")}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      <div className="border-b border-white/10 px-5 py-3">
        <p className="text-sm font-semibold text-white/80">Invoices</p>
      </div>
      <div className="divide-y divide-white/5">
        {invoices.map((inv) => (
          <div key={inv._id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="font-mono text-xs text-white/60">{inv.invoiceNumber}</p>
              {inv.billingPeriodStart && inv.billingPeriodEnd && (
                <p className="text-[10px] text-white/30">
                  {new Date(inv.billingPeriodStart).toLocaleDateString("en-GH", { dateStyle: "medium" })} –{" "}
                  {new Date(inv.billingPeriodEnd).toLocaleDateString("en-GH", { dateStyle: "medium" })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px]", INV_STATUS_PILL[inv.status] ?? "border-white/10 bg-white/5 text-white/40")}>
                {inv.status}
              </span>
              <span className="font-mono text-xs text-white/60">
                GHS {(inv.totalMinor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
              </span>
              {inv.status === "issued" || inv.status === "overdue" ? (
                <button
                  type="button"
                  onClick={() => startCheckout(inv._id)}
                  disabled={payingId === inv._id}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {payingId === inv._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                  Pay
                </button>
              ) : null}
              {inv.status === "paid" ? (
                <a
                  href={`/api/admin/subscription/invoices/${inv._id}/receipt`}
                  className="rounded-lg border border-white/10 bg-white/5 p-1 text-white/45 transition hover:text-white"
                  aria-label={`Download receipt for ${inv.invoiceNumber}`}
                >
                  <FileDown className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
