"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  RefreshCcw,
  RotateCw,
  ServerCog,
  Upload,
  Loader2,
} from "lucide-react";
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

type ProviderSyncOption = {
  value: string;
  label: string;
  autoSyncAvailable: boolean;
  note: string;
};

type ProviderSyncRunRecord = {
  id: string;
  provider: string;
  status: "running" | "completed" | "failed";
  triggerMode: "manual" | "scheduled";
  periodStart: string;
  periodEnd: string;
  metricsUpserted: number;
  costEntriesUpserted: number;
  triggeredByEmail: string | null;
  summary: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
};

type ProviderSyncResponse = {
  providers: ProviderSyncOption[];
  runs: ProviderSyncRunRecord[];
};

type SyncForm = {
  provider: string;
  periodStart: string;
  periodEnd: string;
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

function emptyForm(): SyncForm {
  const range = currentMonthRange();
  return {
    provider: "paystack",
    periodStart: range.start,
    periodEnd: range.end,
  };
}

function renderMetadataValue(value: unknown) {
  if (value === null || value === undefined) return "none";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const serialized = JSON.stringify(value);
  return serialized.length > 60 ? `${serialized.slice(0, 57)}...` : serialized;
}

export default function PlatformBillingSyncPage() {
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [data, setData] = React.useState<ProviderSyncResponse | null>(null);
  const [form, setForm] = React.useState<SyncForm>(emptyForm());

  const selectedProvider = React.useMemo(
    () =>
      (data?.providers || []).find((provider) => provider.value === form.provider) ||
      null,
    [data, form.provider]
  );

  const loadRuns = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/billing/provider-sync", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load provider sync runs");
      }

      const nextData = json.data as ProviderSyncResponse;
      setData(nextData);
      setForm((current) => ({
        ...current,
        provider:
          current.provider ||
          nextData.providers.find((provider) => provider.autoSyncAvailable)?.value ||
          nextData.providers[0]?.value ||
          "paystack",
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load provider sync runs"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const runSync = React.useCallback(async () => {
    if (!selectedProvider?.autoSyncAvailable) {
      toast.error("Automatic sync is not available for the selected provider.");
      return;
    }

    try {
      setRunning(true);
      const res = await fetch("/api/platform/billing/provider-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: form.provider,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to run provider sync");
      }

      const summary =
        typeof json.data?.summary === "string"
          ? json.data.summary
          : "Provider sync completed.";
      toast.success(summary);
      void loadRuns();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to run provider sync"
      );
    } finally {
      setRunning(false);
    }
  }, [form, loadRuns, selectedProvider]);

  const completedRuns = React.useMemo(
    () => (data?.runs || []).filter((run) => run.status === "completed").length,
    [data]
  );
  const failedRuns = React.useMemo(
    () => (data?.runs || []).filter((run) => run.status === "failed").length,
    [data]
  );

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
          <h1 className="text-3xl font-semibold text-white">
            Provider Sync And Imports
          </h1>
          <p className="text-sm text-white/60">
            Run backend sync jobs for providers we can derive from platform data
            today. Providers without direct integrations remain manual through the
            usage attribution and cost ledger screens.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700">
            <Link href="/platform/billing/usage">Usage Attribution</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="border border-white/10 text-white/70 hover:text-white"
          >
            <Link href="/platform/billing/costs">Cost Ledger</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ServerCog className="h-5 w-5 text-cyan-300" />
              Run Sync Job
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  {(data?.providers || []).map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {selectedProvider ? (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  selectedProvider.autoSyncAvailable
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-100"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {selectedProvider.autoSyncAvailable ? (
                    <RefreshCcw className="h-4 w-4" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {selectedProvider.autoSyncAvailable
                    ? "Automatic sync available"
                    : "Manual import only"}
                </div>
                <p className="mt-2">{selectedProvider.note}</p>
              </div>
            ) : null}

            <Button
              type="button"
              className="bg-cyan-600 text-white hover:bg-cyan-700"
              onClick={runSync}
              disabled={running || !selectedProvider?.autoSyncAvailable}
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Sync
                </>
              ) : (
                <>
                  <RotateCw className="mr-2 h-4 w-4" />
                  Run Provider Sync
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="text-lg">Run Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/60">Recent runs</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {data?.runs.length || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/60">Completed</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {completedRuns}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/60">Failed</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {failedRuns}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Sync Runs</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white"
                onClick={() => void loadRuns()}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading provider sync runs
                </div>
              ) : (data?.runs || []).length > 0 ? (
                data?.runs.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-white">
                            {run.provider}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] ${
                              run.status === "completed"
                                ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                : run.status === "failed"
                                  ? "border border-red-400/20 bg-red-400/10 text-red-200"
                                  : "border border-amber-400/20 bg-amber-400/10 text-amber-200"
                            }`}
                          >
                            {run.status}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                            {run.periodStart} to {run.periodEnd}
                          </span>
                        </div>

                        <p className="text-sm text-white/60">
                          {run.summary || run.errorMessage || "No summary recorded."}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                            {run.metricsUpserted} metrics
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                            {run.costEntriesUpserted} cost entries
                          </span>
                          {run.triggeredByEmail ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                              {run.triggeredByEmail}
                            </span>
                          ) : null}
                        </div>

                        {run.metadata ? (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(run.metadata).map(([key, value]) => (
                              <span
                                key={`${run.id}-${key}`}
                                className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-100"
                              >
                                {key}: {renderMetadataValue(value)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="text-right text-xs text-white/50">
                        <p>{format(new Date(run.startedAt), "MMM d, yyyy h:mm a")}</p>
                        {run.completedAt ? (
                          <p className="mt-1">
                            Done {format(new Date(run.completedAt), "MMM d, yyyy h:mm a")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/60">
                  No provider sync runs have been recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
