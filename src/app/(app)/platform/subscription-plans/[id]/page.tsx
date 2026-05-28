"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Settings2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { glassPanelClass, glassInsetClass, glassPrimaryButtonClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { FEATURE_KEYS, FEATURE_DEFINITIONS } from "@/lib/subscriptions/feature-keys";
import { LIMIT_KEYS, ONE_GB } from "@/lib/subscriptions/limit-keys";
import { PLAN_CODES } from "@/lib/subscriptions/plan-codes";
import { getFeaturePlanDiff, getDefaultFeaturesForPlan } from "@/lib/subscriptions/plan-defaults";
import { cn } from "@/lib/utils";

type PlanData = {
  _id: string;
  code: string;
  name: string;
  description?: string | null;
  publicVisible: boolean;
  active: boolean;
  provisional: boolean;
  sortOrder: number;
  version: number;
  priceMinor: number;
  billingCadence: string;
  pricing?: {
    pricePerStudentPerTermMinor?: number | null;
    minimumTermFeeMinor?: number | null;
    annualDiscountPercent?: number | null;
    onboardingFeeMinor?: number | null;
  } | null;
  features: string[];
  limits?: Record<string, number | null> | null;
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Unlimited";
  if (bytes === 0) return "0 B";
  const gb = bytes / ONE_GB;
  return `${gb.toFixed(0)} GB`;
}

function formatLimit(key: string, val: number | null): string {
  if (val === null) return "Unlimited";
  if (val === 0) return "Not included";
  if (key === LIMIT_KEYS.maxStorageBytes) return formatBytes(val);
  return String(val);
}

const FEATURE_MODULE_ORDER = [
  "core", "admissions", "finance", "communications",
  "academics", "assessment", "ai", "learn", "meetings",
  "analytics", "documents", "support", "developer",
];

function groupFeaturesByModule() {
  const groups: Record<string, { key: string; label: string; description: string }[]> = {};
  for (const [, key] of Object.entries(FEATURE_KEYS)) {
    const def = FEATURE_DEFINITIONS[key];
    if (!def) continue;
    if (!groups[def.module]) groups[def.module] = [];
    groups[def.module].push({ key, label: def.label, description: def.description });
  }
  return groups;
}

export default function PlatformSubscriptionPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = React.useState<PlanData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [expandedModules, setExpandedModules] = React.useState<Set<string>>(new Set(["core", "admissions", "finance"]));

  // Editable fields
  const [selectedFeatures, setSelectedFeatures] = React.useState<Set<string>>(new Set());
  const [active, setActive] = React.useState(true);
  const [publicVisible, setPublicVisible] = React.useState(false);
  const [pricePerStudent, setPricePerStudent] = React.useState<string>("");
  const [minFee, setMinFee] = React.useState<string>("");
  const [minimumStudents, setMinimumStudents] = React.useState<string>("");
  const [annualDiscount, setAnnualDiscount] = React.useState<string>("");

  React.useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    fetch(`/api/platform/subscription-plans/${params.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const p: PlanData = json.data;
          setPlan(p);
          setSelectedFeatures(new Set(p.features));
          setActive(p.active);
          setPublicVisible(p.publicVisible);
          setPricePerStudent(
            p.pricing?.pricePerStudentPerTermMinor != null
              ? String(p.pricing.pricePerStudentPerTermMinor / 100)
              : ""
          );
          setMinFee(
            p.pricing?.minimumTermFeeMinor != null
              ? String(p.pricing.minimumTermFeeMinor / 100)
              : ""
          );
          setMinimumStudents(
            p.pricing?.minimumTermFeeMinor != null &&
              p.pricing?.pricePerStudentPerTermMinor != null &&
              p.pricing.pricePerStudentPerTermMinor > 0
              ? String(Math.ceil(p.pricing.minimumTermFeeMinor / p.pricing.pricePerStudentPerTermMinor))
              : ""
          );
          setAnnualDiscount(
            p.pricing?.annualDiscountPercent != null
              ? String(p.pricing.annualDiscountPercent)
              : ""
          );
        } else {
          toast.error(typeof json.error === "string" ? json.error : "Failed to load plan.");
        }
      })
      .catch(() => toast.error("Failed to load plan."))
      .finally(() => setLoading(false));
  }, [params.id]);

  function toggleFeature(key: string) {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleModule(module: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  function resetToDefaults() {
    if (!plan) return;
    setSelectedFeatures(new Set(getDefaultFeaturesForPlan(plan.code)));
  }

  async function onSave() {
    if (!plan || saving) return;
    setSaving(true);
    try {
      const pricePerStudentMinor = pricePerStudent
        ? Math.round(parseFloat(pricePerStudent) * 100)
        : null;
      const minimumStudentsCount = minimumStudents ? parseInt(minimumStudents, 10) : null;
      const minimumTermFeeMinor =
        pricePerStudentMinor != null && minimumStudentsCount != null && minimumStudentsCount > 0
          ? pricePerStudentMinor * minimumStudentsCount
          : minFee
            ? Math.round(parseFloat(minFee) * 100)
            : null;

      const res = await fetch(`/api/platform/subscription-plans/${plan._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active,
          publicVisible,
          features: Array.from(selectedFeatures),
          pricing: {
            ...plan.pricing,
            pricePerStudentPerTermMinor: pricePerStudentMinor,
            minimumTermFeeMinor,
            annualDiscountPercent: annualDiscount ? parseFloat(annualDiscount) : null,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPlan(json.data);
        setMinFee(
          json.data.pricing?.minimumTermFeeMinor != null
            ? String(json.data.pricing.minimumTermFeeMinor / 100)
            : ""
        );
        toast.success("Plan updated.");
      } else {
        toast.error(typeof json.error === "string" ? json.error : "Update failed.");
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

  if (!plan) {
    return (
      <div className="p-4 text-center text-white/50">
        Plan not found.{" "}
        <Link href="/platform/subscription-plans" className="text-cyan-300 underline">
          Back to plans
        </Link>
      </div>
    );
  }

  const featureGroups = groupFeaturesByModule();
  const featureDiff = plan
    ? getFeaturePlanDiff({ code: plan.code, features: Array.from(selectedFeatures) })
    : { defaults: [], configured: [], added: [], removed: [], matchesDefault: true };

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Back + header */}
      <div className={cn(glassPanelClass, "px-5 py-4")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
        <Link
          href="/platform/subscription-plans"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to plans
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Subscription Plan
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              {plan.name}
            </h1>
            <p className="mt-1 text-xs text-white/50">
              code: <span className="font-mono text-white/70">{plan.code}</span>
              {" · "}v{plan.version}
              {" · "}{plan.billingCadence} billing
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
                glassPrimaryButtonClass,
                saving && "cursor-not-allowed opacity-50"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT — pricing + toggles */}
        <div className="space-y-5">
          {/* Status toggles */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-3 text-xs font-semibold text-white/50">Status</p>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2 transition hover:bg-white/5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span className="text-sm text-white/80">Active</span>
              </div>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-400"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2 transition hover:bg-white/5">
              <div className="flex items-center gap-2">
                {publicVisible ? (
                  <Eye className="h-4 w-4 text-cyan-300" />
                ) : (
                  <EyeOff className="h-4 w-4 text-white/40" />
                )}
                <span className="text-sm text-white/80">Visible to public</span>
              </div>
              <input
                type="checkbox"
                checked={publicVisible}
                onChange={(e) => setPublicVisible(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-400"
              />
            </label>
          </div>

          {/* Pricing */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-3 text-xs font-semibold text-white/50">Pricing (GHS)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50">
                  Price per student per term
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-xs text-white/40">GHS</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerStudent}
                    onChange={(e) => setPricePerStudent(e.target.value)}
                    placeholder={plan.code === "pilot" ? "Custom" : "0.00"}
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50">
                  Minimum term fee
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-xs text-white/40">GHS</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minFee}
                    onChange={(e) => setMinFee(e.target.value)}
                    placeholder={plan.code === "pilot" ? "Custom" : "0"}
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50">
                  Minimum billable students
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minimumStudents}
                    onChange={(e) => {
                      setMinimumStudents(e.target.value);
                      const rate = pricePerStudent ? parseFloat(pricePerStudent) : 0;
                      const count = e.target.value ? parseInt(e.target.value, 10) : 0;
                      if (rate > 0 && count > 0) {
                        setMinFee(String(rate * count));
                      }
                    }}
                    placeholder="e.g. 100"
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                  <span className="text-xs text-white/40">students</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-white/30">
                  Below this count, the plan minimum is charged. Minimum term fee is calculated as
                  this count multiplied by the per-student term price.
                </p>
              </div>
              <div>
                <label className="block text-xs text-white/50">Annual discount (%)</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={annualDiscount}
                    onChange={(e) => setAnnualDiscount(e.target.value)}
                    placeholder="10"
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                  <span className="text-xs text-white/40">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Limits summary */}
          <div className={cn(glassPanelClass, "px-5 py-4")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <p className="mb-3 text-xs font-semibold text-white/50">Limits</p>
            <div className="space-y-1.5">
              {Object.entries(plan.limits ?? {}).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-white/40">{key}</span>
                  <span className={cn("text-white/70", val === null && "text-emerald-300/70")}>
                    {formatLimit(key, val)}
                  </span>
                </div>
              ))}
              {Object.keys(plan.limits ?? {}).length === 0 && (
                <p className="text-xs text-white/30">No limits configured.</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — feature selector */}
        <div className={cn(glassPanelClass, "lg:col-span-2 px-0 py-0")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Feature access</h2>
                <p className="text-xs text-white/45">
                  {selectedFeatures.size} of {Object.keys(FEATURE_KEYS).length} features enabled
                  {" · "}
                  {featureDiff.matchesDefault
                    ? "matches default set"
                    : `${featureDiff.added.length} added, ${featureDiff.removed.length} default removed`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetToDefaults}
                  className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-400/15"
                >
                  Reset defaults
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFeatures(new Set(Object.values(FEATURE_KEYS)))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:text-white"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFeatures(new Set())}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {FEATURE_MODULE_ORDER.map((module) => {
              const items = featureGroups[module] ?? [];
              if (items.length === 0) return null;
              const isExpanded = expandedModules.has(module);
              const enabledCount = items.filter((i) => selectedFeatures.has(i.key)).length;
              return (
                <div key={module}>
                  <button
                    type="button"
                    onClick={() => toggleModule(module)}
                    className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                        {module}
                      </span>
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px]",
                        enabledCount === items.length
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : enabledCount === 0
                            ? "border-white/10 bg-white/5 text-white/30"
                            : "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                      )}>
                        {enabledCount}/{items.length}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-white/30" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-white/30" />
                    )}
                  </button>

                  {isExpanded ? (
                    <div className="space-y-px pb-2">
                      {items.map((item) => {
                        const enabled = selectedFeatures.has(item.key);
                        return (
                          <label
                            key={item.key}
                            className="flex cursor-pointer items-start gap-3 px-5 py-2.5 transition hover:bg-white/5"
                          >
                            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                              {enabled ? (
                                <CheckSquare className="h-4 w-4 text-teal-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-white/20" />
                              )}
                            </div>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={enabled}
                              onChange={() => toggleFeature(item.key)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-xs font-medium",
                                enabled ? "text-white/80" : "text-white/35"
                              )}>
                                {item.label}
                              </p>
                              <p className="truncate text-[11px] text-white/30">{item.description}</p>
                            </div>
                            <code className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/25">
                              {item.key}
                            </code>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
