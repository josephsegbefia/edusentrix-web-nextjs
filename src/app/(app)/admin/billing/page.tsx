"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees/money";
import { useSubscription } from "@/hooks/useSubscription";
import FeatureGate from "@/components/billing/FeatureGate";
import LimitIndicator from "@/components/billing/LimitIndicator";
import SubscriptionBadge from "@/components/billing/SubscriptionBadge";
import UpgradePrompt from "@/components/billing/UpgradePrompt";

type PricingTier = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMinor: number;
  studentLimit: number | null;
  features: string[];
  provisional: boolean;
};

export default function AdminBillingPage() {
  const { data, loading, error, refresh } = useSubscription();
  const searchParams = useSearchParams();
  const [tiers, setTiers] = React.useState<PricingTier[]>([]);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const handledCheckoutRef = React.useRef<string | null>(null);

  const loadPricing = React.useCallback(async () => {
    try {
      const res = await fetch("/api/public/pricing", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load pricing");
      }
      setTiers((json.data?.tiers || []) as PricingTier[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pricing");
    }
  }, []);

  React.useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  React.useEffect(() => {
    const reference = searchParams.get("subscriptionRef");
    if (!reference || handledCheckoutRef.current === reference) {
      return;
    }

    handledCheckoutRef.current = reference;

    void (async () => {
      try {
        const res = await fetch(
          `/api/subscription/checkout-status?reference=${encodeURIComponent(reference)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Failed to verify subscription payment");
        }

        const status = json.data?.status;
        if (status === "succeeded") {
          toast.success(`Subscription upgraded to ${json.data?.tierName || "the selected tier"}.`);
          await refresh();
        } else if (status === "awaiting_webhook" || status === "initiated") {
          toast.message("Payment received. Waiting for confirmation from Paystack.");
        } else {
          toast.error(
            json.data?.failureReason || "Subscription payment was not completed."
          );
        }
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to verify subscription payment"
        );
      } finally {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/admin/billing");
        }
      }
    })();
  }, [refresh, searchParams]);

  const upgrade = React.useCallback(
    async (tierId: string) => {
      try {
        setBusyAction(tierId);
        const res = await fetch("/api/subscription/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tierId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Failed to upgrade subscription");
        }

        if (json.data?.alreadyCurrent) {
          toast.message(`${json.data?.tierName || "This tier"} is already active.`);
          await refresh();
          return;
        }

        if (json.data?.paymentRequired && json.data?.checkoutUrl) {
          if (typeof window !== "undefined") {
            window.location.assign(String(json.data.checkoutUrl));
          }
          return;
        }

        toast.success("Subscription updated.");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to upgrade subscription");
      } finally {
        setBusyAction((current) => (current === tierId ? null : current));
      }
    },
    [refresh]
  );

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

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Subscription & Billing</h1>
          <p className="mt-2 text-sm text-white/60">
            View your current plan, usage limits, enabled features, and available pilot tiers.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          onClick={() => void Promise.all([refresh(), loadPricing()])}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Current Plan</p><p className="mt-2 text-xl font-semibold text-white">{data?.subscription?.tierName || "Unassigned"}</p><div className="mt-2"><SubscriptionBadge status={data?.subscription?.status || "draft"} tierName={data?.subscription?.tierName || "Unassigned"} /></div></CardContent></Card>
        <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Monthly Price</p><p className="mt-2 text-xl font-semibold text-white">{formatMoney(data?.subscription?.effectivePriceMinor || 0)}</p><p className="text-xs text-white/50">Payment ready: {data?.paymentReady ? "yes" : "no"}</p></CardContent></Card>
        <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Discount</p><p className="mt-2 text-xl font-semibold text-white">{formatMoney(data?.pricing?.discountAmountMinor || 0)}</p><p className="text-xs text-white/50">subscription only</p></CardContent></Card>
      </div>

      {data?.subscription?.status === "draft" ? (
        <UpgradePrompt
          title="Activate Billing"
          description="Choose a tier to start the paid subscription flow. Plan changes are applied only after checkout clears."
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-6">
          <LimitIndicator label="Students" current={data?.usage?.students || 0} limit={data?.limits?.maxStudents ?? null} />
          <LimitIndicator label="Teachers" current={data?.usage?.teachers || 0} limit={data?.limits?.maxTeachers ?? null} />
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader><CardTitle className="text-base">Enabled Features</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(data?.features || []).map((feature: string) => (
                <span key={feature} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">{feature}</span>
              ))}
              {(data?.features || []).length === 0 ? <p className="text-sm text-white/60">No tier features assigned yet.</p> : null}
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader><CardTitle className="text-xl">Available Pilot Tiers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {tiers.map((tier) => (
              <div key={tier.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium text-white">{tier.name}</p>
                    <p className="text-sm text-white/60">{tier.description || "No description"}</p>
                    <p className="mt-2 text-xs text-white/50">
                      {tier.studentLimit !== null ? `Up to ${tier.studentLimit} students` : "Unlimited students"}
                      {tier.provisional ? " • pilot provisional" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{formatMoney(tier.priceMinor)}</p>
                    <p className="text-xs text-white/50">monthly</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={() => void upgrade(tier.id)} disabled={busyAction === tier.id}>{busyAction === tier.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating</> : "Choose Tier"}</Button>
                  <FeatureGate enabled={(data?.subscription?.status || "draft") !== "cancelled"}>
                    <Button type="button" size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => void cancelSubscription()} disabled={busyAction === "cancel"}>{busyAction === "cancel" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling</> : "Cancel Subscription"}</Button>
                  </FeatureGate>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
