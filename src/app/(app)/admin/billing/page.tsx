"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  Gauge,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees/money";
import { useSubscription } from "@/hooks/useSubscription";
import FeatureGate from "@/components/billing/FeatureGate";
import LimitIndicator from "@/components/billing/LimitIndicator";
import SubscriptionBadge from "@/components/billing/SubscriptionBadge";
import UpgradePrompt from "@/components/billing/UpgradePrompt";

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function humanize(value?: string | null) {
  if (!value) return "Not set";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusTone(accessMode?: string | null) {
  if (accessMode === "full" || accessMode === "trial_limited" || accessMode === "pilot_limited") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  }
  if (accessMode === "grace") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return "border-red-400/25 bg-red-400/10 text-red-100";
}

export default function AdminBillingPage() {
  const { data, loading, error, refresh } = useSubscription();
  const [busyAction, setBusyAction] = React.useState<string | null>(null);

  const accessMode = data?.subscription?.accessMode || "suspended";
  const billingCadence = data?.subscription?.billingCadence || "Not set";
  const periodLabel =
    data?.subscription?.startsAt || data?.subscription?.endsAt
      ? `${formatDate(data?.subscription?.startsAt)} - ${formatDate(data?.subscription?.endsAt)}`
      : "Current period not set";
  const renewalDate =
    data?.subscription?.endsAt ||
    data?.subscription?.trialEndsAt ||
    data?.subscription?.pilotEndsAt ||
    data?.subscription?.gracePeriodEndsAt ||
    null;
  const featureGroups = [
    {
      label: "Core Administration",
      keys: ["core_school_ops", "students", "teachers", "invitations"],
    },
    {
      label: "Payments & Finance",
      keys: ["fees", "payments", "parent_payments", "disbursements"],
    },
    {
      label: "Academics",
      keys: ["curriculum_scheme", "lesson_notes", "examinations", "question_bank"],
    },
    {
      label: "AI / Leo",
      keys: ["ai_leo_copilot", "ai_lesson_notes"],
    },
    {
      label: "Advanced",
      keys: ["analytics", "community", "enterprise", "api_access", "priority_support"],
    },
  ];
  const featureSet = new Set((data?.features || []).map((feature: string) => feature));

  const cancelSubscription = React.useCallback(async () => {
    try {
      setBusyAction("cancel");
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to cancel subscription");
      }
      toast.success("Subscription cancelled.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setBusyAction((current) => (current === "cancel" ? null : current));
    }
  }, [refresh]);

  const requestPlanReview = React.useCallback(async () => {
    try {
      setBusyAction("request-plan-review");
      const res = await fetch("/api/subscription/request-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedCadence: data?.subscription?.billingCadence || null,
          message: "School admin requested a subscription review from billing page.",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to request plan review");
      }
      toast.success("Plan review request sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request plan review");
    } finally {
      setBusyAction((current) =>
        current === "request-plan-review" ? null : current
      );
    }
  }, [data?.subscription?.billingCadence]);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Subscription & Billing</h1>
          <p className="mt-2 text-sm text-white/60">
            View your current plan, usage limits, enabled features, and billing status.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          onClick={() => void refresh()}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <Card className="overflow-hidden border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-black text-white shadow-2xl">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <SubscriptionBadge
                  status={data?.subscription?.status || "draft"}
                  tierName={data?.subscription?.tierName || "Unassigned"}
                />
                <Badge className={statusTone(accessMode)}>
                  {humanize(accessMode)}
                </Badge>
                <Badge className="border-white/10 bg-white/10 text-white">
                  {humanize(String(billingCadence))}
                </Badge>
              </div>
              <div>
                <p className="text-sm uppercase tracking-wide text-white/50">Current plan</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  {data?.subscription?.tierName || "Unassigned"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-white/60">
                  {accessMode === "restricted_read_only" || accessMode === "suspended"
                    ? "Existing school data remains available according to the access mode, but new costly actions are restricted until renewal."
                    : "Your school can use the enabled modules and limits shown below. Plan changes are handled through a billing review."}
                </p>
              </div>
            </div>
            <div className="grid gap-3 border-t border-white/10 bg-white/[0.03] p-6 lg:border-l lg:border-t-0">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 text-cyan-200" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Period</p>
                  <p className="mt-1 text-sm font-medium text-white">{periodLabel}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-200" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Renewal / End Date</p>
                  <p className="mt-1 text-sm font-medium text-white">{formatDate(renewalDate)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 h-4 w-4 text-amber-200" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Effective Fee</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {formatMoney(data?.subscription?.effectivePriceMinor || 0)}
                  </p>
                  <p className="text-xs text-white/45">Payment ready: {data?.paymentReady ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {data?.subscription?.status === "draft" ? (
        <UpgradePrompt
          title="Activate Billing"
          description="Choose a tier to start the paid subscription flow. Plan changes are applied only after checkout clears."
        />
      ) : null}

      {(accessMode === "grace" ||
        accessMode === "restricted_read_only" ||
        accessMode === "suspended") ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Subscription attention needed</p>
            <p className="mt-1 text-amber-100/75">
              Some actions may be restricted. Request a plan review or contact EduSentrix to renew or adjust this subscription.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-cyan-200" />
                Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <LimitIndicator label="Students" current={data?.usage?.students || 0} limit={data?.limits?.maxStudents ?? null} />
              <LimitIndicator label="Teachers" current={data?.usage?.teachers || 0} limit={data?.limits?.maxTeachers ?? null} />
              <LimitIndicator label="AI actions" current={0} limit={data?.limits?.maxAICallsPerMonth ?? null} />
              <LimitIndicator label="Storage" current={0} limit={data?.limits?.maxStorageBytes ?? null} />
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader><CardTitle className="text-base">Billing Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-white/60">
              <p>Base subscription, transaction fees, SMS/WhatsApp credits, storage, video, and AI usage are treated separately.</p>
              <p>Trial and pilot schools can still have transaction or overage fees depending on platform configuration.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader><CardTitle className="text-xl">Feature Access & Plan Review</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {featureGroups.map((group) => (
                <div key={group.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">{group.label}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.keys.map((feature) => {
                      const enabled = featureSet.has(feature);
                      return (
                        <Badge
                          key={feature}
                          className={
                            enabled
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                              : "border-white/10 bg-white/5 text-white/45"
                          }
                        >
                          {enabled ? "Enabled" : "Locked"}: {humanize(feature)}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-medium text-white">Need a plan change?</p>
              <p className="mt-2 text-sm text-white/60">
                Subscription changes are reviewed by EduSentrix so your school gets
                the right term, annual, trial, pilot, usage, and transaction-fee setup.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-cyan-600 text-white hover:bg-cyan-700"
                  onClick={() => void requestPlanReview()}
                  disabled={busyAction === "request-plan-review"}
                >
                  {busyAction === "request-plan-review" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Request Plan Review
                    </>
                  )}
                </Button>
                <FeatureGate enabled={(data?.subscription?.status || "draft") !== "cancelled"}>
                  <Button type="button" size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => void cancelSubscription()} disabled={busyAction === "cancel"}>{busyAction === "cancel" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling</> : "Cancel Subscription"}</Button>
                </FeatureGate>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
