"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";

type SchoolRow = {
  id: string;
  name: string;
  status: string;
  paymentReady: boolean;
  paymentSetupStatus:
    | "not_started"
    | "awaiting_billing_owner"
    | "details_submitted"
    | "pending_provisioning"
    | "review_required"
    | "provisioned"
    | "failed";
  subscription: {
    tierName: string | null;
    status: string;
    effectivePriceMinor: number;
  } | null;
  usage: {
    totalEstimatedCostMinor: number;
    metricsCount: number;
  };
};

type QueueFilter =
  | "all"
  | "review_required"
  | "failed"
  | "setup_pending"
  | "payment_ready";

function paymentStatusTone(status: SchoolRow["paymentSetupStatus"]) {
  if (status === "provisioned") {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
  }
  if (status === "review_required") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-200";
  }
  if (status === "failed") {
    return "border-rose-500/30 bg-rose-500/15 text-rose-200";
  }
  if (status === "pending_provisioning") {
    return "border-cyan-500/30 bg-cyan-500/15 text-cyan-200";
  }
  return "border-white/10 bg-white/5 text-white/65";
}

function paymentStatusLabel(status: SchoolRow["paymentSetupStatus"]) {
  return status.replace(/_/g, " ");
}

function isSetupPending(status: SchoolRow["paymentSetupStatus"]) {
  return !["provisioned", "review_required", "failed"].includes(status);
}

function urgencyRank(status: SchoolRow["paymentSetupStatus"]) {
  switch (status) {
    case "review_required":
      return 0;
    case "failed":
      return 1;
    case "pending_provisioning":
      return 2;
    case "details_submitted":
      return 3;
    case "awaiting_billing_owner":
      return 4;
    case "not_started":
      return 5;
    case "provisioned":
    default:
      return 6;
  }
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "amber" | "rose" | "cyan" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/25 bg-linear-to-br from-amber-500/15 via-transparent to-transparent text-amber-100"
      : tone === "rose"
        ? "border-rose-500/25 bg-linear-to-br from-rose-500/15 via-transparent to-transparent text-rose-100"
        : tone === "cyan"
          ? "border-cyan-500/25 bg-linear-to-br from-cyan-500/15 via-transparent to-transparent text-cyan-100"
          : "border-emerald-500/25 bg-linear-to-br from-emerald-500/15 via-transparent to-transparent text-emerald-100";

  return (
    <Card className={cn("overflow-hidden border text-white shadow-xl shadow-black/25", toneClass)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
              {label}
            </p>
            <p className="mt-3 text-3xl font-bold text-white">{value.toLocaleString()}</p>
            <p className="mt-2 text-sm text-white/65">{helper}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Icon className="h-5 w-5 text-white/80" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformSchoolsPage() {
  const [loading, setLoading] = React.useState(true);
  const [backfilling, setBackfilling] = React.useState(false);
  const [schools, setSchools] = React.useState<SchoolRow[]>([]);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<QueueFilter>("all");
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());

  const loadSchools = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/schools", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load platform schools");
      }
      setSchools((json.data?.schools || []) as SchoolRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load platform schools");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  async function handleBackfill() {
    try {
      setBackfilling(true);
      const res = await fetch("/api/platform/schools/payment-setup/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to backfill payment setup states");
      }
      toast.success(
        `Backfill complete. ${json.data.changed} school${json.data.changed === 1 ? "" : "s"} updated.`
      );
      await loadSchools();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to backfill payment setup states"
      );
    } finally {
      setBackfilling(false);
    }
  }

  const counts = {
    reviewRequired: schools.filter((school) => school.paymentSetupStatus === "review_required").length,
    failed: schools.filter((school) => school.paymentSetupStatus === "failed").length,
    setupPending: schools.filter((school) => isSetupPending(school.paymentSetupStatus)).length,
    paymentReady: schools.filter((school) => school.paymentReady).length,
  };

  const filteredSchools = schools
    .filter((school) => {
      if (!deferredQuery) return true;
      const subscriptionLabel = school.subscription?.tierName || "";
      return `${school.name} ${school.status} ${subscriptionLabel} ${school.paymentSetupStatus}`
        .toLowerCase()
        .includes(deferredQuery);
    })
    .filter((school) => {
      if (filter === "all") return true;
      if (filter === "review_required") return school.paymentSetupStatus === "review_required";
      if (filter === "failed") return school.paymentSetupStatus === "failed";
      if (filter === "setup_pending") return isSetupPending(school.paymentSetupStatus);
      if (filter === "payment_ready") return school.paymentReady;
      return true;
    })
    .sort((left, right) => {
      const urgency = urgencyRank(left.paymentSetupStatus) - urgencyRank(right.paymentSetupStatus);
      if (urgency !== 0) return urgency;
      return left.name.localeCompare(right.name);
    });

  const priorityQueue = filteredSchools.filter((school) =>
    ["review_required", "failed"].includes(school.paymentSetupStatus)
  );
  const standardQueue = filteredSchools.filter(
    (school) => !["review_required", "failed"].includes(school.paymentSetupStatus)
  );

  const filterOptions: Array<{
    id: QueueFilter;
    label: string;
    count: number;
  }> = [
    { id: "all", label: "All Schools", count: schools.length },
    { id: "review_required", label: "Needs Review", count: counts.reviewRequired },
    { id: "failed", label: "Failed", count: counts.failed },
    { id: "setup_pending", label: "Setup Pending", count: counts.setupPending },
    { id: "payment_ready", label: "Payment Ready", count: counts.paymentReady },
  ];

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white">
          <Link href="/platform">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Platform
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold text-white">Schools</h1>
        <p className="text-sm text-white/60">
          Platform-wide school commercial profile, subscription state, and attributed cost.
        </p>
      </div>

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-black p-6 text-white shadow-2xl shadow-black/40">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Operator Queue
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Payment Setup Triage
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-white/60">
                Prioritize flagged payout setups first, then work through the schools still waiting on billing owner handoff, payout validation, or final provisioning.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void loadSchools()}
              disabled={loading}
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh Queue
            </Button>
            <Button
              type="button"
              onClick={() => void handleBackfill()}
              disabled={backfilling}
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className={cn("h-4 w-4", backfilling && "animate-spin")} />
              Run Backfill
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Needs Review"
              value={counts.reviewRequired}
              helper="Flagged payout setups waiting on platform review."
              icon={AlertCircle}
              tone="amber"
            />
            <MetricCard
              label="Failed Setup"
              value={counts.failed}
              helper="Schools blocked by payout errors or rejected details."
              icon={XCircle}
              tone="rose"
            />
            <MetricCard
              label="Setup Pending"
              value={counts.setupPending}
              helper="Still waiting on owner handoff, saved details, or provisioning."
              icon={Clock3}
              tone="cyan"
            />
            <MetricCard
              label="Payment Ready"
              value={counts.paymentReady}
              helper="Schools with live settlement rails and parent checkout enabled."
              icon={CheckCircle2}
              tone="emerald"
            />
          </div>
        </div>
      </section>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search schools, subscription tiers, or payment setup state"
                className="h-11 border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/35"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => {
                const active = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                      active
                        ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/65 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <span>{option.label}</span>
                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs text-white/70">
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {priorityQueue.length > 0 ? (
        <Card className="border-amber-500/20 bg-linear-to-br from-amber-500/10 via-slate-950 to-slate-950 text-white shadow-2xl shadow-black/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-5 w-5 text-amber-300" />
              Priority Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityQueue.map((school) => (
              <div
                key={school.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{school.name}</p>
                      <Badge
                        variant="outline"
                        className={cn("text-[11px]", paymentStatusTone(school.paymentSetupStatus))}
                      >
                        {paymentStatusLabel(school.paymentSetupStatus)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-white/60">
                      {school.subscription
                        ? `${school.subscription.tierName || "Unassigned"} • ${school.subscription.status}`
                        : "No subscription assigned"}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {school.paymentSetupStatus === "review_required"
                        ? "Manual payout review is blocking online payment activation."
                        : "This school needs intervention before payment setup can move forward."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" className="bg-amber-400 text-slate-950 hover:bg-amber-300">
                      <Link href={`/platform/schools/${school.id}`}>
                        {school.paymentSetupStatus === "review_required" ? "Review Payout" : "Investigate"}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Link href={`/platform/schools/${school.id}/subscription`}>Subscription</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-cyan-300" />
            School Directory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading schools
            </div>
          ) : null}

          {!loading && filteredSchools.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
              <p className="text-base font-medium text-white">No schools match the current queue filter.</p>
              <p className="mt-2 text-sm text-white/55">
                Adjust the search term or switch back to a broader payment setup view.
              </p>
            </div>
          ) : null}

          {!loading && filteredSchools.length > 0 && standardQueue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
              <p className="text-sm font-medium text-white">All matching schools are already in the priority queue above.</p>
              <p className="mt-1 text-xs text-white/55">
                Clear the filter or move to a broader view to inspect the rest of the school directory.
              </p>
            </div>
          ) : null}

          {standardQueue.map((school) => (
            <div key={school.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-medium text-white">{school.name}</p>
                  <p className="text-xs text-white/50">
                    {school.status} • {school.paymentReady ? "payment ready" : "payment setup pending"}
                  </p>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={cn("text-[11px]", paymentStatusTone(school.paymentSetupStatus))}
                    >
                      {paymentStatusLabel(school.paymentSetupStatus)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    {school.subscription
                      ? `${school.subscription.tierName || "Unassigned"} • ${school.subscription.status}`
                      : "No subscription assigned"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-white">
                    {formatMoney(school.subscription?.effectivePriceMinor || 0)}
                  </p>
                  <p className="text-xs text-white/50">current subscription</p>
                  <p className="mt-2 text-white/60">
                    Cost {formatMoney(school.usage.totalEstimatedCostMinor)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="bg-cyan-600 text-white hover:bg-cyan-700">
                  <Link href={`/platform/schools/${school.id}`}>Overview</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <Link href={`/platform/schools/${school.id}/subscription`}>Subscription</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <Link href={`/platform/schools/${school.id}/usage`}>Usage</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
