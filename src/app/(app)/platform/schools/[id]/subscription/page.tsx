"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { formatMoney } from "@/lib/fees/money";
import { computeSubscriptionPricing } from "@/lib/platform-billing/subscription-pricing";

type SubscriptionStatus =
  | "draft"
  | "trial"
  | "trialing"
  | "pilot"
  | "active"
  | "past_due"
  | "grace"
  | "restricted_read_only"
  | "suspended"
  | "cancelled"
  | "expired"
  | "archived";
type BillingCadence = "term" | "annual" | "monthly" | "custom";
type LifecycleMode = "trial" | "pilot" | "paid" | "custom";
type DateField =
  | "startsAt"
  | "endsAt"
  | "trialEndsAt"
  | "pilotStartsAt"
  | "pilotEndsAt"
  | "gracePeriodEndsAt";
type TierRow = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  billingCadence?: BillingCadence;
  version?: number;
};
type SubscriptionResponse = {
  school: { id: string; name: string; status: string };
  tiers: TierRow[];
  subscription: {
    tierId: string | null;
    status: SubscriptionStatus;
    lifecycleMode: LifecycleMode | null;
    billingCadence: BillingCadence | null;
    startsAt: string | null;
    endsAt: string | null;
    trialEndsAt: string | null;
    manualPriceOverrideMinor: number | null;
    discountMode: "none" | "percent" | "fixed";
    discountValue: number | null;
    note: string | null;
    pilotEndsAt: string | null;
    gracePeriodEndsAt: string | null;
    usageResetPolicy: "term" | "annual" | "custom" | null;
  } | null;
};

type FormState = {
  tierId: string;
  status: SubscriptionStatus;
  billingCadence: BillingCadence | "";
  startsAt: string;
  endsAt: string;
  trialEndsAt: string;
  pilotStartsAt: string;
  manualPriceOverrideMinor: string;
  discountMode: "none" | "percent" | "fixed";
  discountValue: string;
  note: string;
  pilotEndsAt: string;
  gracePeriodEndsAt: string;
  usageResetPolicy: "term" | "annual" | "custom" | "";
};

function dateStringToDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToDateString(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lifecycleModeFromStatus(status: SubscriptionStatus): LifecycleMode | null {
  if (status === "trial" || status === "trialing") return "trial";
  if (status === "pilot") return "pilot";
  if (
    status === "active" ||
    status === "past_due" ||
    status === "grace" ||
    status === "restricted_read_only" ||
    status === "suspended" ||
    status === "expired"
  ) {
    return "paid";
  }
  return null;
}

function humanize(value?: string | null) {
  if (!value) return "Not set";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PlatformSchoolSubscriptionPage() {
  const params = useParams<{ id: string }>();
  const schoolId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [data, setData] = React.useState<SubscriptionResponse | null>(null);
  const [form, setForm] = React.useState<FormState>({
    tierId: "",
    status: "draft",
    billingCadence: "",
    startsAt: "",
    endsAt: "",
    trialEndsAt: "",
    pilotStartsAt: "",
    manualPriceOverrideMinor: "",
    discountMode: "none",
    discountValue: "",
    note: "",
    pilotEndsAt: "",
    gracePeriodEndsAt: "",
    usageResetPolicy: "",
  });

  const loadData = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/subscription`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load school subscription");
      const next = json.data as SubscriptionResponse;
      const currentTierIsAssignable = next.tiers.some(
        (tier) => tier.id === next.subscription?.tierId
      );
      setData(next);
      setForm({
        tierId:
          currentTierIsAssignable && next.subscription?.tierId
            ? next.subscription.tierId
            : next.tiers[0]?.id || "",
        status: next.subscription?.status || "draft",
        billingCadence:
          next.subscription?.billingCadence || next.tiers[0]?.billingCadence || "",
        startsAt: next.subscription?.startsAt || "",
        endsAt: next.subscription?.endsAt || "",
        trialEndsAt: next.subscription?.trialEndsAt || "",
        pilotStartsAt: "",
        manualPriceOverrideMinor: typeof next.subscription?.manualPriceOverrideMinor === "number" ? String(next.subscription.manualPriceOverrideMinor) : "",
        discountMode: next.subscription?.discountMode || "none",
        discountValue: typeof next.subscription?.discountValue === "number" ? String(next.subscription.discountValue) : "",
        note: next.subscription?.note || "",
        pilotEndsAt: next.subscription?.pilotEndsAt || "",
        gracePeriodEndsAt: next.subscription?.gracePeriodEndsAt || "",
        usageResetPolicy: next.subscription?.usageResetPolicy || "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load school subscription");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => { void loadData(); }, [loadData]);

  const selectedTier = React.useMemo(
    () => (data?.tiers || []).find((tier) => tier.id === form.tierId) || null,
    [data, form.tierId]
  );

  const pricingPreview = React.useMemo(() => {
    if (!selectedTier) return null;
    return computeSubscriptionPricing({
      basePriceMinor: selectedTier.priceMinor,
      manualPriceOverrideMinor: form.manualPriceOverrideMinor.trim() ? Number(form.manualPriceOverrideMinor) : null,
      discountMode: form.discountMode,
      discountValue: form.discountMode === "none" || !form.discountValue.trim() ? null : Number(form.discountValue),
    });
  }, [selectedTier, form]);

  const saveSubscription = React.useCallback(async () => {
    if (!schoolId || !form.tierId) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: form.tierId,
          status: form.status,
          lifecycleMode: lifecycleModeFromStatus(form.status),
          billingCadence: form.billingCadence || null,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
          trialEndsAt: form.trialEndsAt || null,
          pilotStartsAt: form.pilotStartsAt || null,
          manualPriceOverrideMinor: form.manualPriceOverrideMinor.trim() ? Number(form.manualPriceOverrideMinor) : null,
          discountMode: form.discountMode,
          discountValue: form.discountMode === "none" || !form.discountValue.trim() ? null : Number(form.discountValue),
          note: form.note.trim() || null,
          pilotEndsAt: form.pilotEndsAt || null,
          gracePeriodEndsAt: form.gracePeriodEndsAt || null,
          usageResetPolicy: form.usageResetPolicy || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to update school subscription");
      toast.success("School subscription updated.");
      void loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update school subscription");
    } finally {
      setSaving(false);
    }
  }, [form, loadData, schoolId]);

  const setDateField = React.useCallback((field: DateField, date: Date | null) => {
    setForm((current) => ({ ...current, [field]: dateToDateString(date) }));
  }, []);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white"><Link href={schoolId ? `/platform/schools/${schoolId}` : "/platform/schools"}><ArrowLeft className="mr-2 h-4 w-4" />Back to School</Link></Button>
        <h1 className="text-3xl font-semibold text-white">{data?.school.name || "School Subscription"}</h1>
      </div>

      {loading && !data ? <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60"><Loader2 className="h-4 w-4 animate-spin" />Loading school subscription</div> : null}

      {data ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader><CardTitle className="text-base">School</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium text-white">{data.school.name}</p>
              <p className="text-white/60">Status: {data.school.status}</p>
              {selectedTier ? (
                <p className="text-white/60">
                  Base {selectedTier.billingCadence || "term"} price:{" "}
                  {formatMoney(selectedTier.priceMinor)}
                </p>
              ) : null}
              {selectedTier ? (
                <p className="text-white/60">
                  Tier cadence: {humanize(selectedTier.billingCadence || "term")} · Version{" "}
                  {selectedTier.version || 1}
                </p>
              ) : null}
              {pricingPreview ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-white/70">
                  <p>
                    Price after override/discount:{" "}
                    <span className="font-medium text-white">
                      {formatMoney(pricingPreview.finalPriceMinor)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    This equals the base price when no manual override or discount is set.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
            <CardHeader><CardTitle className="text-xl">Subscription Controls</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Tier</label><Select value={form.tierId} onValueChange={(value) => setForm((current) => ({ ...current, tierId: value }))}><SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue placeholder="Select tier" /></SelectTrigger><SelectContent className="border-white/10 bg-slate-950 text-white">{data.tiers.map((tier) => <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Status</label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as FormState["status"] }))}><SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-slate-950 text-white"><SelectItem value="draft">Draft</SelectItem><SelectItem value="trialing">Trialing</SelectItem><SelectItem value="pilot">Pilot</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="past_due">Past Due</SelectItem><SelectItem value="grace">Grace</SelectItem><SelectItem value="restricted_read_only">Read Only</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Cadence</label><Select value={form.billingCadence || "none"} onValueChange={(value) => setForm((current) => ({ ...current, billingCadence: value === "none" ? "" : value as FormState["billingCadence"] }))}><SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-slate-950 text-white"><SelectItem value="none">Use tier</SelectItem><SelectItem value="term">Term</SelectItem><SelectItem value="annual">Annual</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Usage Reset</label><Select value={form.usageResetPolicy || "none"} onValueChange={(value) => setForm((current) => ({ ...current, usageResetPolicy: value === "none" ? "" : value as FormState["usageResetPolicy"] }))}><SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-slate-950 text-white"><SelectItem value="none">Not set</SelectItem><SelectItem value="term">Term</SelectItem><SelectItem value="annual">Annual</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <CustomDatePicker label="Starts At" value={dateStringToDate(form.startsAt)} onChange={(date) => setDateField("startsAt", date)} placeholder="Select start date" />
                <CustomDatePicker label="Ends At" value={dateStringToDate(form.endsAt)} onChange={(date) => setDateField("endsAt", date)} placeholder="Select end date" />
                <CustomDatePicker label="Grace Ends At" value={dateStringToDate(form.gracePeriodEndsAt)} onChange={(date) => setDateField("gracePeriodEndsAt", date)} placeholder="Select grace end date" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Manual Override (minor units)</label><Input type="number" min="0" step="1" value={form.manualPriceOverrideMinor} onChange={(event) => setForm((current) => ({ ...current, manualPriceOverrideMinor: event.target.value }))} className="border-white/10 bg-white/5 text-white" /></div>
                <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Discount Mode</label><Select value={form.discountMode} onValueChange={(value) => setForm((current) => ({ ...current, discountMode: value as FormState["discountMode"] }))}><SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-slate-950 text-white"><SelectItem value="none">None</SelectItem><SelectItem value="percent">Percent</SelectItem><SelectItem value="fixed">Fixed</SelectItem></SelectContent></Select></div>
              </div>
              {form.discountMode !== "none" ? <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Discount Value</label><Input type="number" min="0" step="0.01" value={form.discountValue} onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))} className="border-white/10 bg-white/5 text-white" /></div> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <CustomDatePicker label="Trial Ends At" value={dateStringToDate(form.trialEndsAt)} onChange={(date) => setDateField("trialEndsAt", date)} placeholder="Select trial end date" />
                <CustomDatePicker label="Pilot Ends At" value={dateStringToDate(form.pilotEndsAt)} onChange={(date) => setDateField("pilotEndsAt", date)} placeholder="Select pilot end date" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Price After Override/Discount</label><div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">{pricingPreview ? formatMoney(pricingPreview.finalPriceMinor) : formatMoney(0)}</div></div>
              </div>
              <div className="space-y-2"><label className="text-xs uppercase tracking-wide text-white/50">Internal Note</label><Textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className="border-white/10 bg-white/5 text-white" /></div>
              <Button type="button" className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={saveSubscription} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving</> : "Save Subscription"}</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
