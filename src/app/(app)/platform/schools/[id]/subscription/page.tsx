"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Calendar,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { glassPanelClass, glassInsetClass, glassPrimaryButtonClass } from "@/lib/ui/glass-surfaces";
import { SubscriptionEventLog } from "@/components/subscriptions/SubscriptionEventLog";
import { cn } from "@/lib/utils";
import { PLAN_META } from "@/lib/subscriptions/plan-codes";
import { ACCESS_MODE_LABELS } from "@/lib/subscriptions/access-mode";

type PlanOption = {
  _id: string;
  code: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  pricing?: {
    pricePerStudentPerTermMinor?: number | null;
    minimumTermFeeMinor?: number | null;
    annualDiscountPercent?: number | null;
  } | null;
  features: string[];
  active: boolean;
};

type SubData = {
  school: { id: string; name: string; status: string };
  subscription: {
    _id: string;
    tierId: string | null;
    tierCode: string | null;
    tierName: string | null;
    status: string;
    lifecycleMode: string | null;
    billingCadence: string | null;
    startsAt: string | null;
    endsAt: string | null;
    pilotEndsAt: string | null;
    gracePeriodEndsAt: string | null;
    effectivePriceMinor: number;
    basePriceMinor: number;
    manualPriceOverrideMinor: number | null;
    discountMode: string;
    discountValue: number | null;
    featuresSnapshot: string[];
    note: string | null;
  } | null;
  plan: PlanOption | null;
  events: Array<{
    _id: string;
    eventType: string;
    summary: string;
    actorEmail: string | null;
    createdAt: string;
  }>;
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

function minorToGHS(minor: number): string {
  return `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

export default function SchoolSubscriptionPage() {
  const params = useParams<{ id: string }>();
  const schoolId = params.id;

  const [data, setData] = React.useState<SubData | null>(null);
  const [plans, setPlans] = React.useState<PlanOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");
  const [lifecycleMode, setLifecycleMode] = React.useState<"pilot" | "paid" | "custom">("paid");
  const [billingCadence, setBillingCadence] = React.useState<"term" | "annual" | "monthly" | "custom">("term");
  const [startsAt, setStartsAt] = React.useState<Date | null>(new Date());
  const [endsAt, setEndsAt] = React.useState<Date | null>(null);
  const [pilotEndsAt, setPilotEndsAt] = React.useState<Date | null>(null);
  const [gracePeriodDays, setGracePeriodDays] = React.useState("14");
  const [manualPrice, setManualPrice] = React.useState("");
  const [discountMode, setDiscountMode] = React.useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = React.useState("");
  const [note, setNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, plansRes] = await Promise.all([
        fetch(`/api/platform/schools/${schoolId}/subscription`),
        fetch("/api/platform/subscription-plans"),
      ]);
      const [subJson, plansJson] = await Promise.all([subRes.json(), plansRes.json()]);

      if (subJson.success) {
        setData(subJson.data);
        const sub = subJson.data.subscription;
        if (sub) {
          if (sub.tierId) setSelectedPlanId(sub.tierId);
          if (sub.lifecycleMode) setLifecycleMode(sub.lifecycleMode as any);
          if (sub.billingCadence) setBillingCadence(sub.billingCadence as any);
          if (sub.startsAt) setStartsAt(new Date(sub.startsAt));
          if (sub.endsAt) setEndsAt(new Date(sub.endsAt));
          if (sub.pilotEndsAt) setPilotEndsAt(new Date(sub.pilotEndsAt));
          if (sub.manualPriceOverrideMinor != null)
            setManualPrice(String(sub.manualPriceOverrideMinor / 100));
          if (sub.discountMode) setDiscountMode(sub.discountMode as any);
          if (sub.discountValue != null) setDiscountValue(String(sub.discountValue));
          if (sub.note) setNote(sub.note);
        }
      }

      if (plansJson.success) {
        setPlans(plansJson.data);
        // Pre-select first plan if none assigned
        if (!subJson.data?.subscription?.tierId && plansJson.data.length > 0) {
          const starter = plansJson.data.find((p: PlanOption) => p.code === "starter");
          setSelectedPlanId(starter?._id ?? plansJson.data[0]._id);
        }
      }
    } catch {
      toast.error("Failed to load subscription data.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    if (!selectedPlanId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/platform/schools/${schoolId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          lifecycleMode,
          billingCadence,
          startsAt: startsAt?.toISOString() ?? null,
          endsAt: endsAt?.toISOString() ?? null,
          pilotEndsAt: pilotEndsAt?.toISOString() ?? null,
          gracePeriodDays: parseInt(gracePeriodDays) || 14,
          manualPriceOverrideMinor: manualPrice ? Math.round(parseFloat(manualPrice) * 100) : null,
          discountMode,
          discountValue: discountValue ? parseFloat(discountValue) : null,
          note: note || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(data?.subscription ? "Subscription updated." : "Subscription assigned.");
        await load();
      } else {
        toast.error(
          typeof json.error === "string" ? json.error : "Failed to save subscription."
        );
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  const currentSub = data?.subscription;
  const selectedPlan = plans.find((p) => p._id === selectedPlanId);

  type TabId = "overview" | "pricing" | "features" | "charges" | "usage" | "events";
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "pricing", label: "Pricing" },
    { id: "features", label: "Features" },
    { id: "charges", label: "Charges" },
    { id: "usage", label: "Usage & Add-ons" },
    { id: "events", label: "Events" },
  ];

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className={cn(glassPanelClass, "px-5 py-4")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
        <Link
          href={`/platform/schools/${schoolId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to school
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Subscription Management
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              {data?.school.name ?? "School"}
            </h1>
            {currentSub ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                    STATUS_TONE[currentSub.status] ?? STATUS_TONE.draft
                  )}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {currentSub.status}
                </span>
                {currentSub.tierName ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60">
                    {currentSub.tierName}
                  </span>
                ) : null}
                {currentSub.effectivePriceMinor > 0 ? (
                  <span className="text-xs text-white/40">
                    {minorToGHS(currentSub.effectivePriceMinor)} / {currentSub.billingCadence ?? "term"}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-xs text-white/40">No subscription assigned yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!selectedPlanId || saving}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
                glassPrimaryButtonClass,
                (!selectedPlanId || saving) && "cursor-not-allowed opacity-50"
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {currentSub ? "Update subscription" : "Assign subscription"}
            </button>
          </div>
        </div>
      </div>

      {/* Tab navigation — §14.5 */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/3 p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-xl px-3.5 py-1.5 text-xs font-medium transition",
              activeTab === tab.id
                ? "bg-teal-500/20 text-teal-200 border border-teal-500/30"
                : "text-white/50 hover:text-white/80"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* FORM — 3 cols (Pricing tab) */}
        <div className={cn("space-y-5 lg:col-span-3", activeTab !== "pricing" && "hidden")}>
          {/* Plan selector */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-3 text-sm font-semibold text-white/80">Subscription plan</p>
            <PremiumSelect value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Select a plan…" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {plans.map((plan) => (
                  <PremiumSelectItem key={plan._id} value={plan._id}>
                    {plan.name}
                    {plan.code === "pilot" ? " (Platform admin only)" : ""}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            {selectedPlan ? (
              <div className={cn(glassInsetClass, "mt-3 px-4 py-3")}>
                <p className="text-xs font-semibold text-white/60">{selectedPlan.name}</p>
                {selectedPlan.description ? (
                  <p className="mt-0.5 text-xs text-white/40">{selectedPlan.description}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/50">
                  <span>{selectedPlan.features.length} features</span>
                  {selectedPlan.pricing?.pricePerStudentPerTermMinor != null && (
                    <span>
                      GHS {(selectedPlan.pricing.pricePerStudentPerTermMinor / 100).toFixed(2)} / student / term
                    </span>
                  )}
                  {selectedPlan.pricing?.minimumTermFeeMinor != null && (
                    <span>
                      Min: GHS {(selectedPlan.pricing.minimumTermFeeMinor / 100).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Lifecycle + billing cadence */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-4 text-sm font-semibold text-white/80">Lifecycle</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Mode</label>
                <PremiumSelect value={lifecycleMode} onValueChange={(v) => setLifecycleMode(v as any)}>
                  <PremiumSelectTrigger className="w-full">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="paid">Paid</PremiumSelectItem>
                    <PremiumSelectItem value="pilot">Pilot</PremiumSelectItem>
                    <PremiumSelectItem value="custom">Custom</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Billing cadence</label>
                <PremiumSelect value={billingCadence} onValueChange={(v) => setBillingCadence(v as any)}>
                  <PremiumSelectTrigger className="w-full">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="term">Per term</PremiumSelectItem>
                    <PremiumSelectItem value="annual">Annual</PremiumSelectItem>
                    <PremiumSelectItem value="monthly">Monthly</PremiumSelectItem>
                    <PremiumSelectItem value="custom">Custom</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Start date</label>
                <CustomDatePicker
                  value={startsAt}
                  onChange={setStartsAt}
                  placeholder="Start date"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/50">End date</label>
                <div className="space-y-1">
                  <CustomDatePicker
                    value={endsAt}
                    onChange={setEndsAt}
                    placeholder="No end date"
                  />
                  {endsAt && (
                    <button type="button" onClick={() => setEndsAt(null)} className="text-[11px] text-white/30 hover:text-white/60">
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {lifecycleMode === "pilot" ? (
              <div className="mt-4">
                <label className="mb-1.5 block text-xs text-white/50">Pilot ends at</label>
                <div className="space-y-1">
                  <CustomDatePicker
                    value={pilotEndsAt}
                    onChange={setPilotEndsAt}
                    placeholder="Pilot end date"
                  />
                  {pilotEndsAt && (
                    <button type="button" onClick={() => setPilotEndsAt(null)} className="text-[11px] text-white/30 hover:text-white/60">
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <label className="mb-1.5 block text-xs text-white/50">
                Grace period after expiry (days)
              </label>
              <input
                type="number"
                min="0"
                max="90"
                value={gracePeriodDays}
                onChange={(e) => setGracePeriodDays(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
                placeholder="14"
              />
            </div>
          </div>

          {/* Pricing overrides */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-4 text-sm font-semibold text-white/80">Pricing overrides</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-white/50">
                  Manual price override (GHS)
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-xs text-white/40">GHS</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="Plan default"
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Discount mode</label>
                <PremiumSelect value={discountMode} onValueChange={(v) => setDiscountMode(v as any)}>
                  <PremiumSelectTrigger className="w-full">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="none">No discount</PremiumSelectItem>
                    <PremiumSelectItem value="percent">Percentage</PremiumSelectItem>
                    <PremiumSelectItem value="fixed">Fixed amount</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>

            {discountMode !== "none" ? (
              <div className="mt-4">
                <label className="mb-1.5 block text-xs text-white/50">
                  {discountMode === "percent" ? "Discount (%)" : "Discount amount (GHS)"}
                </label>
                <input
                  type="number"
                  min="0"
                  max={discountMode === "percent" ? "100" : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
                  placeholder="0"
                />
              </div>
            ) : null}

            <div className="mt-4">
              <label className="mb-1.5 block text-xs text-white/50">Internal note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. Special pilot school, board-agreed price, etc."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
              />
            </div>
          </div>
        </div>

        {/* RIGHT — current state sidebar (visible on Pricing and Overview tabs) */}
        <div className={cn("space-y-5 lg:col-span-2", activeTab !== "pricing" && "hidden")}>
          {/* Current subscription summary */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-3 text-xs font-semibold text-white/50">Current subscription</p>
            {currentSub ? (
              <div className="space-y-2 text-xs">
                <Row label="Plan" value={currentSub.tierName ?? "—"} />
                <Row label="Code" value={currentSub.tierCode ?? "—"} mono />
                <Row label="Status" value={currentSub.status} />
                <Row label="Mode" value={currentSub.lifecycleMode ?? "—"} />
                <Row label="Cadence" value={currentSub.billingCadence ?? "—"} />
                <Row
                  label="Starts"
                  value={currentSub.startsAt ? new Date(currentSub.startsAt).toLocaleDateString("en-GH") : "—"}
                />
                <Row
                  label="Ends"
                  value={currentSub.endsAt ? new Date(currentSub.endsAt).toLocaleDateString("en-GH") : "Open-ended"}
                />
                {currentSub.gracePeriodEndsAt ? (
                  <Row
                    label="Grace ends"
                    value={new Date(currentSub.gracePeriodEndsAt).toLocaleDateString("en-GH")}
                  />
                ) : null}
                <Row
                  label="Effective price"
                  value={currentSub.effectivePriceMinor > 0 ? minorToGHS(currentSub.effectivePriceMinor) : "Free / Custom"}
                />
                <Row label="Features" value={`${currentSub.featuresSnapshot?.length ?? 0} enabled`} />
              </div>
            ) : (
              <div className={cn(glassInsetClass, "py-6 text-center")}>
                <CircleDashed className="mx-auto mb-2 h-6 w-6 text-white/20" />
                <p className="text-xs text-white/40">No subscription assigned.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-4 text-sm font-semibold text-white/80">Subscription summary</p>
            {currentSub ? (
              <div className="space-y-2 text-sm">
                <Row label="Plan" value={currentSub.tierName ?? "—"} />
                <Row label="Status" value={currentSub.status} />
                <Row label="Lifecycle mode" value={currentSub.lifecycleMode ?? "—"} />
                <Row label="Billing cadence" value={currentSub.billingCadence ?? "—"} />
                <Row
                  label="Starts"
                  value={currentSub.startsAt ? new Date(currentSub.startsAt).toLocaleDateString("en-GH") : "—"}
                />
                <Row
                  label="Expires"
                  value={currentSub.endsAt ? new Date(currentSub.endsAt).toLocaleDateString("en-GH") : "Open-ended"}
                />
                {currentSub.gracePeriodEndsAt && (
                  <Row
                    label="Grace period ends"
                    value={new Date(currentSub.gracePeriodEndsAt).toLocaleDateString("en-GH")}
                  />
                )}
                <Row
                  label="Effective price"
                  value={currentSub.effectivePriceMinor > 0 ? minorToGHS(currentSub.effectivePriceMinor) : "Free / Custom"}
                />
                {currentSub.discountMode !== "none" && (
                  <Row
                    label="Discount"
                    value={`${currentSub.discountMode} — ${currentSub.discountValue ?? 0}`}
                  />
                )}
                <Row label="Features enabled" value={`${currentSub.featuresSnapshot?.length ?? 0}`} />
              </div>
            ) : (
              <div className={cn(glassInsetClass, "py-6 text-center")}>
                <CircleDashed className="mx-auto mb-2 h-6 w-6 text-white/20" />
                <p className="text-sm text-white/40">No subscription assigned yet.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("pricing")}
                  className="mt-3 text-xs text-teal-400 hover:text-teal-300 underline underline-offset-4"
                >
                  Assign subscription →
                </button>
              </div>
            )}
          </div>
          <div className="space-y-5">
            <RenewalPanel schoolId={schoolId} currentSub={currentSub} reload={load} />
            <AccessModePanel schoolId={schoolId} currentSub={currentSub} reload={load} />
          </div>
        </div>
      )}

      {/* Features tab */}
      {activeTab === "features" && (
        <div className={cn(glassPanelClass, "px-5 py-4")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          <p className="mb-4 text-sm font-semibold text-white/80">Feature access snapshot</p>
          {currentSub?.featuresSnapshot && currentSub.featuresSnapshot.length > 0 ? (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {currentSub.featuresSnapshot.map((feature) => (
                <div
                  key={feature}
                  className={cn(glassInsetClass, "flex items-center gap-2 px-3 py-2")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span className="text-xs font-mono text-white/70">{feature}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn(glassInsetClass, "py-8 text-center")}>
              <CircleDashed className="mx-auto mb-2 h-6 w-6 text-white/20" />
              <p className="text-sm text-white/40">No feature snapshot yet. Assign a subscription to see feature access.</p>
            </div>
          )}
          {currentSub && (
            <p className="mt-4 text-xs text-white/35">
              {currentSub.featuresSnapshot?.length ?? 0} features enabled from plan{" "}
              <span className="font-mono text-white/50">{currentSub.tierCode ?? "unknown"}</span>.
              School-specific overrides are applied on top of this snapshot.
            </p>
          )}
        </div>
      )}

      {/* Charges tab */}
      {activeTab === "charges" && (
        <AccessModePanel schoolId={schoolId} currentSub={currentSub} reload={load} />
      )}

      {/* Usage & Add-ons tab */}
      {activeTab === "usage" && (
        <AddOnsPanel schoolId={schoolId} />
      )}

      {/* Events tab */}
      {activeTab === "events" && (
        <div className="space-y-5">
          <RenewalPanel schoolId={schoolId} currentSub={currentSub} reload={load} />
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <SubscriptionEventLog
              apiPath={`/api/platform/schools/${schoolId}/subscription/events`}
              title="Subscription event log"
              platformMode
              maxVisible={25}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Renewal Panel
// ---------------------------------------------------------------------------

function RenewalPanel({
  schoolId,
  currentSub,
  reload,
}: {
  schoolId: string;
  currentSub: SubData["subscription"] | null;
  reload: () => void;
}) {
  const [newEndsAt, setNewEndsAt] = React.useState<Date | null>(null);
  const [graceDays, setGraceDays] = React.useState("14");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function onRenew() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/platform/schools/${schoolId}/subscription/renew`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newEndsAt: newEndsAt?.toISOString() ?? null,
            gracePeriodDays: parseInt(graceDays) || 14,
            note: note || null,
            confirmedByPlatformAdmin: true,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        toast.success("Subscription renewed.");
        setNewEndsAt(null);
        setNote("");
        reload();
      } else {
        toast.error(typeof json.error === "string" ? json.error : "Renewal failed.");
      }
    } catch { toast.error("Network error."); }
    finally { setSaving(false); }
  }

  if (!currentSub) return null;

  return (
    <div className={cn(glassPanelClass, "px-5 py-4")}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      <p className="mb-1 text-xs font-semibold text-white/50">Renew subscription</p>
      <p className="mb-3 text-[10px] text-white/30">
        Set a new period, restore status to active, and reset grace period.
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] text-white/40">New end date (leave blank = auto from cadence)</label>
          <div className="space-y-1">
            <CustomDatePicker
              value={newEndsAt}
              onChange={setNewEndsAt}
              placeholder="Auto-calculate from cadence"
            />
            {newEndsAt && (
              <button
                type="button"
                onClick={() => setNewEndsAt(null)}
                className="text-[11px] text-white/30 hover:text-white/60"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-white/40">Grace period days</label>
          <input
            type="number"
            min="0"
            max="90"
            value={graceDays}
            onChange={(e) => setGraceDays(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-white/40">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Renewal for Term 2 2026…"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-white/20"
          />
        </div>
        <button
          type="button"
          onClick={onRenew}
          disabled={saving}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition",
            "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25",
            saving && "cursor-not-allowed opacity-50"
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Renew subscription
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access Mode Override Panel
// ---------------------------------------------------------------------------

const ACCESS_MODES = [
  { value: "full", label: "Full access", desc: "Restore complete access", tone: "text-emerald-300" },
  { value: "grace", label: "Grace period", desc: "Read/write with expiry warning", tone: "text-amber-300" },
  { value: "restricted_read_only", label: "Restricted read-only", desc: "Cannot create or pay", tone: "text-orange-300" },
  { value: "suspended", label: "Suspended", desc: "No access to app features", tone: "text-rose-300" },
];

function AccessModePanel({
  schoolId,
  currentSub,
  reload,
}: {
  schoolId: string;
  currentSub: SubData["subscription"] | null;
  reload: () => void;
}) {
  const [mode, setMode] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function onApply() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/platform/schools/${schoolId}/subscription/access-mode`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessMode: mode || null,
            reason: reason || null,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        toast.success("Access mode updated.");
        setMode("");
        setReason("");
        reload();
      } else {
        toast.error(typeof json.error === "string" ? json.error : "Failed to update.");
      }
    } catch { toast.error("Network error."); }
    finally { setSaving(false); }
  }

  return (
    <div className={cn(glassPanelClass, "px-5 py-4")}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      <p className="mb-1 text-xs font-semibold text-white/50">Access mode override</p>
      <p className="mb-3 text-[10px] text-white/30">
        Manually set this school&apos;s access mode. Takes effect immediately regardless of global enforcement flags.
      </p>

      {currentSub?.status ? (
        <p className="mb-3 text-[10px] text-white/40">
          Current status: <span className="text-white/60">{currentSub.status}</span>
        </p>
      ) : null}

      <div className="space-y-1.5 mb-3">
        {ACCESS_MODES.map((m) => (
          <label key={m.value} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 transition hover:bg-white/5">
            <input
              type="radio"
              name="accessMode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="accent-teal-400"
            />
            <div>
              <p className={cn("text-xs font-medium", m.tone)}>{m.label}</p>
              <p className="text-[10px] text-white/30">{m.desc}</p>
            </div>
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl p-2 transition hover:bg-white/5">
          <input
            type="radio"
            name="accessMode"
            value=""
            checked={mode === ""}
            onChange={() => setMode("")}
            className="accent-teal-400"
          />
          <div>
            <p className="text-xs font-medium text-white/50">Clear override</p>
            <p className="text-[10px] text-white/30">Let the system resolve naturally</p>
          </div>
        </label>
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Reason (recorded in event log)…"
        className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-white/20"
      />

      <button
        type="button"
        onClick={onApply}
        disabled={saving}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition",
          glassPrimaryButtonClass,
          saving && "cursor-not-allowed opacity-50"
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Apply override
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-ons Panel
// ---------------------------------------------------------------------------

type AddOnRow = {
  _id: string;
  addonType: string;
  quantity: number;
  priceMinor: number;
  status: string;
  creditedAt?: string | null;
  createdAt: string;
  note?: string | null;
};

const ADDON_LABELS: Record<string, string> = {
  leo_credits: "Leo AI Credits",
  learn_seats: "Learn Seats",
  storage_gb: "Storage (GB)",
  meeting_minutes: "Meeting Minutes",
  sms_credits: "SMS Credits",
  whatsapp_credits: "WhatsApp Credits",
};

const ADDON_STATUS_TONE: Record<string, string> = {
  pending: "border-white/10 bg-white/5 text-white/40",
  paid: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  credited: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  cancelled: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  refunded: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

function AddOnsPanel({ schoolId }: { schoolId: string }) {
  const [addons, setAddons] = React.useState<AddOnRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newType, setNewType] = React.useState("leo_credits");
  const [newQty, setNewQty] = React.useState("100");
  const [newPrice, setNewPrice] = React.useState("0");
  const [newNote, setNewNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/schools/${schoolId}/addons`);
      const json = await res.json();
      if (json.success) setAddons(json.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => { load(); }, [load]);

  async function onCreate() {
    if (!newQty || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/platform/schools/${schoolId}/addons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addonType: newType,
          quantity: parseInt(newQty),
          priceMinor: newPrice ? Math.round(parseFloat(newPrice) * 100) : 0,
          note: newNote || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Add-on created.");
        setShowCreate(false);
        setNewType("leo_credits");
        setNewQty("100");
        setNewPrice("0");
        setNewNote("");
        load();
      } else {
        toast.error(typeof json.error === "string" ? json.error : "Failed to create add-on.");
      }
    } catch { toast.error("Network error."); }
    finally { setCreating(false); }
  }

  async function onCredit(addonId: string) {
    const res = await fetch(`/api/platform/schools/${schoolId}/addons/${addonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "credited" }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Add-on credited to balance."); load(); }
    else toast.error("Failed to credit add-on.");
  }

  return (
    <div className={cn(glassPanelClass, "px-5 py-4")}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-white/50">Add-ons</p>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/50 transition hover:text-white"
        >
          {showCreate ? <XCircle className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showCreate ? "Cancel" : "Add"}
        </button>
      </div>

      {showCreate && (
        <div className={cn(glassInsetClass, "mb-3 space-y-2 px-3 py-3")}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-white/40">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
              >
                {Object.entries(ADDON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/40">Quantity</label>
              <input
                type="number"
                min="1"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-white/40">Price (GHS)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/40">Note</label>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Optional internal note"
              className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/25"
            />
          </div>
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-500/15 py-1.5 text-xs text-teal-100 transition hover:bg-teal-500/25 disabled:opacity-50"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create add-on
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-white/30" />
        </div>
      ) : addons.length === 0 ? (
        <p className="text-xs text-white/30">No add-ons yet.</p>
      ) : (
        <div className="space-y-1.5">
          {addons.map((a) => (
            <div key={a._id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-white/70">
                  {ADDON_LABELS[a.addonType] ?? a.addonType} × {a.quantity.toLocaleString()}
                </p>
                {a.note && <p className="text-[10px] text-white/30">{a.note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px]", ADDON_STATUS_TONE[a.status] ?? "")}>
                  {a.status}
                </span>
                {a.status === "paid" && (
                  <button
                    type="button"
                    onClick={() => onCredit(a._id)}
                    className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    Credit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span className={cn("text-white/70", mono && "font-mono")}>{value}</span>
    </div>
  );
}
