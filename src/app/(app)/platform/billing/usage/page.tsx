"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Activity, ArrowLeft, Loader2, Plus } from "lucide-react";
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

type ProviderOption = {
  value: string;
  label: string;
};

type SchoolOption = {
  id: string;
  name: string;
  status: string;
};

type AggregateProvider = {
  provider: string;
  label: string;
  amountMinor: number;
};

type UsageAggregate = {
  schoolId: string;
  schoolName: string;
  totalEstimatedCostMinor: number;
  metricsCount: number;
  providers: AggregateProvider[];
};

type UsageMetricRow = {
  id: string;
  schoolId: string;
  schoolName: string;
  provider: string;
  providerLabel: string;
  metricKey: string;
  quantity: number;
  unitLabel: string;
  unitCostMinor: number;
  estimatedCostMinor: number;
  allocationMethod: "direct" | "weighted" | "manual";
  sourceType: "manual" | "provider_sync" | "system_estimate";
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  updatedAt: string | null;
};

type UsageResponse = {
  periodStart: string;
  periodEnd: string;
  providerOptions: ProviderOption[];
  schools: SchoolOption[];
  aggregates: UsageAggregate[];
  metrics: UsageMetricRow[];
};

type UsageForm = {
  schoolId: string;
  provider: string;
  metricKey: string;
  quantity: string;
  unitLabel: string;
  unitCostMinor: string;
  allocationMethod: "direct" | "weighted" | "manual";
  sourceType: "manual" | "provider_sync" | "system_estimate";
  periodStart: string;
  periodEnd: string;
  notes: string;
};

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  );
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function emptyForm(): UsageForm {
  const range = currentMonthRange();
  return {
    schoolId: "",
    provider: "mongodb",
    metricKey: "",
    quantity: "",
    unitLabel: "",
    unitCostMinor: "",
    allocationMethod: "manual",
    sourceType: "manual",
    periodStart: range.start,
    periodEnd: range.end,
    notes: "",
  };
}

export default function PlatformBillingUsagePage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [data, setData] = React.useState<UsageResponse | null>(null);
  const [form, setForm] = React.useState<UsageForm>(emptyForm());

  const totalEstimatedCostMinor = React.useMemo(
    () =>
      (data?.aggregates || []).reduce(
        (sum, item) => sum + item.totalEstimatedCostMinor,
        0
      ),
    [data]
  );

  const loadUsage = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/billing/usage", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load usage attribution");
      }

      const nextData = json.data as UsageResponse;
      setData(nextData);
      setForm((current) => ({
        ...current,
        schoolId: current.schoolId || nextData.schools[0]?.id || "",
        provider: current.provider || nextData.providerOptions[0]?.value || "mongodb",
        periodStart: current.periodStart || nextData.periodStart,
        periodEnd: current.periodEnd || nextData.periodEnd,
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load usage attribution"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const saveUsageMetric = React.useCallback(async () => {
    if (!form.schoolId) {
      toast.error("Select a school before saving usage.");
      return;
    }

    if (!form.metricKey.trim()) {
      toast.error("Metric key is required.");
      return;
    }

    if (!form.unitLabel.trim()) {
      toast.error("Unit label is required.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/platform/billing/usage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId: form.schoolId,
          provider: form.provider,
          metricKey: form.metricKey.trim(),
          quantity: Number(form.quantity || 0),
          unitLabel: form.unitLabel.trim(),
          unitCostMinor: Number(form.unitCostMinor || 0),
          allocationMethod: form.allocationMethod,
          sourceType: form.sourceType,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          notes: form.notes.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save usage metric");
      }

      toast.success("Usage metric saved.");
      setForm((current) => ({
        ...emptyForm(),
        schoolId: current.schoolId,
        periodStart: current.periodStart,
        periodEnd: current.periodEnd,
      }));
      void loadUsage();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save usage metric"
      );
    } finally {
      setSaving(false);
    }
  }, [form, loadUsage]);

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
          <h1 className="text-3xl font-semibold text-white">Usage Attribution</h1>
          <p className="text-sm text-white/60">
            Attribute vendor and platform usage to each school using strict
            backend records. These metrics drive cost-to-serve analysis, pilot
            closeout pricing, and margin forecasting.
          </p>
        </div>
        <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700">
          <Link href="/platform/billing/costs">Open Cost Ledger</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5 text-cyan-300" />
              Upsert Usage Metric
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  School
                </label>
                <Select
                  value={form.schoolId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, schoolId: value }))
                  }
                  disabled={(data?.schools.length || 0) === 0}
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    {(data?.schools || []).map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Provider
                </label>
                <Select
                  value={form.provider}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, provider: value }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    {(data?.providerOptions || []).map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Metric Key
                </label>
                <Input
                  value={form.metricKey}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      metricKey: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="active_users, function_invocations, tokens_in"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Unit Label
                </label>
                <Input
                  value={form.unitLabel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unitLabel: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="users, requests, MB, tokens"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Quantity
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="e.g. 4500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Unit Cost (minor units)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitCostMinor}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unitCostMinor: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="e.g. 3.5"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Allocation Method
                </label>
                <Select
                  value={form.allocationMethod}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      allocationMethod: value as UsageForm["allocationMethod"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select allocation method" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="weighted">Weighted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Source Type
                </label>
                <Select
                  value={form.sourceType}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      sourceType: value as UsageForm["sourceType"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="provider_sync">Provider Sync</SelectItem>
                    <SelectItem value="system_estimate">System Estimate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Period Start
                </label>
                <Input
                  type="date"
                  value={form.periodStart}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      periodStart: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Period End
                </label>
                <Input
                  type="date"
                  value={form.periodEnd}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      periodEnd: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/50">
                Notes
              </label>
              <Textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="border-white/10 bg-white/5 text-white"
                placeholder="Explain allocation basis, provider invoice mapping, or why this metric was adjusted."
              />
            </div>

            <Button
              type="button"
              className="bg-cyan-600 text-white hover:bg-cyan-700"
              onClick={saveUsageMetric}
              disabled={saving || (data?.schools.length || 0) === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Metric
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Save Usage Metric
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="text-lg">Current Period Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading usage attribution
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-white/60">
                      Total estimated attributed cost
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {formatMoney(totalEstimatedCostMinor)}
                    </p>
                    {data ? (
                      <p className="mt-1 text-xs text-white/50">
                        {data.periodStart} to {data.periodEnd}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-white/60">Tracked schools</p>
                      <p className="mt-1 font-medium text-white">
                        {data?.aggregates.length || 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-white/60">Recorded metrics</p>
                      <p className="mt-1 font-medium text-white">
                        {data?.metrics.length || 0}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(data?.aggregates || []).slice(0, 6).map((aggregate) => (
                      <div
                        key={aggregate.schoolId}
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-medium text-white">
                              {aggregate.schoolName}
                            </p>
                            <p className="mt-1 text-xs text-white/50">
                              {aggregate.metricsCount} tracked metrics
                            </p>
                          </div>
                          <p className="font-medium text-white">
                            {formatMoney(aggregate.totalEstimatedCostMinor)}
                          </p>
                        </div>
                        {aggregate.providers.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {aggregate.providers.slice(0, 4).map((provider) => (
                              <span
                                key={`${aggregate.schoolId}-${provider.provider}`}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
                              >
                                {provider.label}: {formatMoney(provider.amountMinor)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Usage Metrics</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white"
                onClick={() => void loadUsage()}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? null : (data?.metrics || []).length > 0 ? (
                data?.metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {metric.schoolName} • {metric.providerLabel}
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          {metric.metricKey} • {metric.quantity} {metric.unitLabel}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {metric.periodStart} to {metric.periodEnd} •{" "}
                          {metric.allocationMethod} • {metric.sourceType}
                        </p>
                        {metric.notes ? (
                          <p className="mt-2 text-xs text-white/60">
                            {metric.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">
                          {formatMoney(metric.estimatedCostMinor)}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {metric.updatedAt
                            ? format(new Date(metric.updatedAt), "MMM d, yyyy h:mm a")
                            : "No timestamp"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/60">
                  No usage metrics have been attributed yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
