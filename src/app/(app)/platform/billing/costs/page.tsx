"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Database, Loader2, Plus } from "lucide-react";
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

type ProviderTotal = {
  provider: string;
  label: string;
  amountMinor: number;
};

type CostEntry = {
  id: string;
  provider: string;
  providerLabel: string;
  category: string;
  description: string | null;
  amountMinor: number;
  currency: string;
  allocationMethod: "shared" | "direct" | "n_a";
  sourceType: "manual" | "provider_sync" | "invoice_import";
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  createdByEmail: string | null;
  updatedAt: string | null;
};

type CostResponse = {
  periodStart: string;
  periodEnd: string;
  totalAmountMinor: number;
  providers: ProviderTotal[];
  entries: CostEntry[];
};

type CostForm = {
  provider: string;
  category: string;
  description: string;
  amountMinor: string;
  allocationMethod: "shared" | "direct" | "n_a";
  sourceType: "manual" | "provider_sync" | "invoice_import";
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

function emptyForm(): CostForm {
  const range = currentMonthRange();
  return {
    provider: "vercel",
    category: "",
    description: "",
    amountMinor: "",
    allocationMethod: "shared",
    sourceType: "manual",
    periodStart: range.start,
    periodEnd: range.end,
    notes: "",
  };
}

export default function PlatformBillingCostsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [data, setData] = React.useState<CostResponse | null>(null);
  const [form, setForm] = React.useState<CostForm>(emptyForm());

  const loadCosts = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/billing/costs", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load service costs");
      }
      setData(json.data as CostResponse);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load service costs"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadCosts();
  }, [loadCosts]);

  const saveCostEntry = React.useCallback(async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/platform/billing/costs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: form.provider,
          category: form.category.trim(),
          description: form.description.trim() || null,
          amountMinor: Number(form.amountMinor || 0),
          allocationMethod: form.allocationMethod,
          sourceType: form.sourceType,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          notes: form.notes.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save cost entry");
      }

      toast.success("Service cost entry saved.");
      setForm(emptyForm());
      void loadCosts();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save cost entry"
      );
    } finally {
      setSaving(false);
    }
  }, [form, loadCosts]);

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
          <h1 className="text-3xl font-semibold text-white">Service Cost Ledger</h1>
          <p className="text-sm text-white/60">
            Record backend provider costs for Clerk, MongoDB, Vercel, OpenAI,
            UploadThing, and other services. This is the ledger layer for
            margin analysis and pricing review.
          </p>
        </div>
        <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700">
          <Link href="/platform/billing/usage">Open Usage Attribution</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5 text-cyan-300" />
              New Cost Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
                    {[
                      "clerk",
                      "mongodb",
                      "vercel",
                      "openai",
                      "uploadthing",
                      "paystack",
                      "email",
                      "storage",
                      "internal",
                    ].map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Category
                </label>
                <Input
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="Hosting, tokens, storage, auth, etc."
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Amount (minor units)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.amountMinor}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amountMinor: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="e.g. 250000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Allocation Method
                </label>
                <Select
                  value={form.allocationMethod}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      allocationMethod: value as CostForm["allocationMethod"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select allocation method" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    <SelectItem value="shared">Shared</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="n_a">N/A</SelectItem>
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
                Description
              </label>
              <Input
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="border-white/10 bg-white/5 text-white"
                placeholder="Optional provider invoice line or context"
              />
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
                placeholder="Why this cost matters, how it should be allocated, or invoice references."
              />
            </div>

            <Button
              type="button"
              className="bg-cyan-600 text-white hover:bg-cyan-700"
              onClick={saveCostEntry}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Cost
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Save Cost Entry
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
                  Loading cost ledger
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-white/60">Total recorded cost</p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {formatMoney(data?.totalAmountMinor || 0)}
                    </p>
                    {data ? (
                      <p className="mt-1 text-xs text-white/50">
                        {data.periodStart} to {data.periodEnd}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {(data?.providers || []).map((provider) => (
                      <div
                        key={provider.provider}
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <p className="text-sm text-white/60">{provider.label}</p>
                        <p className="mt-1 font-medium text-white">
                          {formatMoney(provider.amountMinor)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Cost Entries</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white"
                onClick={() => void loadCosts()}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? null : (data?.entries || []).length > 0 ? (
                data?.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {entry.providerLabel} • {entry.category}
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          {entry.description || "No description"}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {entry.periodStart} to {entry.periodEnd}
                          {entry.createdByEmail ? ` • ${entry.createdByEmail}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">
                          {formatMoney(entry.amountMinor)}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {entry.updatedAt
                            ? format(new Date(entry.updatedAt), "MMM d, yyyy h:mm a")
                            : "No timestamp"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/60">
                  No provider cost entries recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
