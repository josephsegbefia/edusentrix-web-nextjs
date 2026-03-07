"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Layers3, Loader2, PencilLine, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/fees/money";

type TierRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMinor: number;
  billingCadence: "monthly";
  studentLimit: number | null;
  features: string[];
  provisional: boolean;
  active: boolean;
  sortOrder: number;
  assignedSchoolCount: number;
  updatedAt: string | null;
};

type TiersResponse = {
  tiers: TierRecord[];
};

type TierForm = {
  code: string;
  name: string;
  description: string;
  priceMinor: string;
  studentLimit: string;
  featuresText: string;
  provisional: "true" | "false";
  active: "true" | "false";
  sortOrder: string;
};

function emptyForm(): TierForm {
  return {
    code: "",
    name: "",
    description: "",
    priceMinor: "",
    studentLimit: "",
    featuresText: "",
    provisional: "true",
    active: "true",
    sortOrder: "0",
  };
}

function parseFeatures(featuresText: string) {
  return Array.from(
    new Set(
      featuresText
        .split(/[\n,]/)
        .map((feature) => feature.trim())
        .filter(Boolean)
    )
  );
}

function formFromTier(tier: TierRecord): TierForm {
  return {
    code: tier.code,
    name: tier.name,
    description: tier.description || "",
    priceMinor: String(tier.priceMinor),
    studentLimit:
      typeof tier.studentLimit === "number" ? String(tier.studentLimit) : "",
    featuresText: tier.features.join("\n"),
    provisional: tier.provisional ? "true" : "false",
    active: tier.active ? "true" : "false",
    sortOrder: String(tier.sortOrder),
  };
}

export default function PlatformBillingTiersPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [data, setData] = React.useState<TiersResponse | null>(null);
  const [editingTierId, setEditingTierId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<TierForm>(emptyForm());

  const activeCount = React.useMemo(
    () => (data?.tiers || []).filter((tier) => tier.active).length,
    [data]
  );
  const provisionalCount = React.useMemo(
    () => (data?.tiers || []).filter((tier) => tier.provisional).length,
    [data]
  );
  const assignedSchools = React.useMemo(
    () =>
      (data?.tiers || []).reduce(
        (sum, tier) => sum + (tier.assignedSchoolCount || 0),
        0
      ),
    [data]
  );

  const loadTiers = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/billing/tiers", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load subscription tiers");
      }
      setData(json.data as TiersResponse);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load subscription tiers"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTiers();
  }, [loadTiers]);

  const resetForm = React.useCallback(() => {
    setEditingTierId(null);
    setForm(emptyForm());
  }, []);

  const startEditingTier = React.useCallback((tier: TierRecord) => {
    setEditingTierId(tier.id);
    setForm(formFromTier(tier));
  }, []);

  const saveTier = React.useCallback(async () => {
    if (!editingTierId && !form.code.trim()) {
      toast.error("Tier code is required.");
      return;
    }

    if (!form.name.trim()) {
      toast.error("Tier name is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...(editingTierId ? {} : { code: form.code.trim() }),
        name: form.name.trim(),
        description: form.description.trim() || null,
        priceMinor: Number(form.priceMinor || 0),
        studentLimit:
          form.studentLimit.trim() === "" ? null : Number(form.studentLimit),
        features: parseFeatures(form.featuresText),
        provisional: form.provisional === "true",
        active: form.active === "true",
        sortOrder: Number(form.sortOrder || 0),
      };

      const res = await fetch(
        editingTierId
          ? `/api/platform/billing/tiers/${encodeURIComponent(editingTierId)}`
          : "/api/platform/billing/tiers",
        {
          method: editingTierId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save subscription tier");
      }

      toast.success(editingTierId ? "Subscription tier updated." : "Subscription tier created.");
      resetForm();
      void loadTiers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save subscription tier"
      );
    } finally {
      setSaving(false);
    }
  }, [editingTierId, form, loadTiers, resetForm]);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-fit px-0 text-white/70 hover:text-white"
          >
            <Link href="/platform/billing">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Billing
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold text-white">Subscription Tiers</h1>
          <p className="text-sm text-white/60">
            Create and maintain provisional pilot tiers without code changes.
            Tier codes are immutable after creation, and assigned tiers cannot
            be deactivated until schools are moved off them.
          </p>
        </div>
        <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700">
          <Link href="/platform/billing/events">Open Subscription Timeline</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Layers3 className="h-5 w-5 text-cyan-300" />
              {editingTierId ? "Edit Tier" : "New Tier"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Tier Code
                </label>
                <Input
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                  disabled={Boolean(editingTierId)}
                  className="border-white/10 bg-white/5 text-white disabled:opacity-60"
                  placeholder="pilot_growth_plus"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Tier Name
                </label>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="Pilot Growth Plus"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Monthly Price (minor units)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.priceMinor}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priceMinor: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="e.g. 450000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Student Limit
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.studentLimit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      studentLimit: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="Leave empty for no cap"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Provisional
                </label>
                <Select
                  value={form.provisional}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      provisional: value as TierForm["provisional"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Active
                </label>
                <Select
                  value={form.active}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      active: value as TierForm["active"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Sort Order
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/50">
                Description
              </label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="border-white/10 bg-white/5 text-white"
                placeholder="What kind of pilot schools this tier is intended for."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/50">
                Features
              </label>
              <Textarea
                value={form.featuresText}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    featuresText: event.target.value,
                  }))
                }
                className="min-h-32 border-white/10 bg-white/5 text-white"
                placeholder={"core_school_ops\npayments\nreports"}
              />
              <p className="text-xs text-white/45">
                Use commas or new lines. Duplicate values are removed automatically.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="bg-cyan-600 text-white hover:bg-cyan-700"
                onClick={saveTier}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : editingTierId ? (
                  <>
                    <PencilLine className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Tier
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="border border-white/10 text-white/70 hover:text-white"
                onClick={resetForm}
                disabled={saving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="text-lg">Tier Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/60">Total tiers</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {data?.tiers.length || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/60">Active tiers</p>
                <p className="mt-1 text-xl font-semibold text-white">{activeCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/60">Assigned schools</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {assignedSchools}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-3">
                <p className="text-sm text-white/60">Provisional tiers</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {provisionalCount}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Existing Tiers</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white"
                onClick={() => void loadTiers()}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tiers
                </div>
              ) : (data?.tiers || []).length > 0 ? (
                data?.tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">{tier.name}</p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                            {tier.code}
                          </span>
                          {!tier.active ? (
                            <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-[11px] text-red-200">
                              Inactive
                            </span>
                          ) : null}
                          {tier.provisional ? (
                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] text-amber-200">
                              Provisional
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-white/60">
                          {tier.description || "No description"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                            {formatMoney(tier.priceMinor)} / month
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                            {tier.studentLimit
                              ? `${tier.studentLimit} students`
                              : "No student cap"}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                            {tier.assignedSchoolCount} assigned schools
                          </span>
                        </div>
                        {tier.features.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {tier.features.map((feature) => (
                              <span
                                key={`${tier.id}-${feature}`}
                                className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-100"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3 sm:text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          className="border border-white/10 text-white/70 hover:text-white"
                          onClick={() => startEditingTier(tier)}
                        >
                          <PencilLine className="mr-2 h-4 w-4" />
                          Edit Tier
                        </Button>
                        <p className="text-xs text-white/50">
                          {tier.updatedAt
                            ? format(new Date(tier.updatedAt), "MMM d, yyyy h:mm a")
                            : "No timestamp"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/60">
                  No subscription tiers have been created yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
