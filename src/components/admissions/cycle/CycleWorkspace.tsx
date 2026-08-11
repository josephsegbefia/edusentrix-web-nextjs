"use client";

import * as React from "react";
import {
  BarChart3,
  ClipboardList,
  FormInput,
  History,
  Inbox,
  Loader2,
  Save,
  Share2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AdmissionCycleDTO } from "@/hooks/admissions/useAdmissionCycles";
import { ApplicationsInboxTab } from "./ApplicationsInboxTab";
import { FormBuilderTab } from "./FormBuilderTab";
import { DistributionTab } from "./DistributionTab";
import { CycleOverviewTab } from "./CycleOverviewTab";
import { AuditTab } from "./AuditTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { AdmissionsOnboardingTour } from "./AdmissionsOnboardingTour";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { glassPanelClass, glassInsetClass } from "@/lib/ui/glass-surfaces";

type WorkspaceTab =
  | "overview"
  | "applications"
  | "analytics"
  | "form"
  | "distribution"
  | "audit"
  | "fees";

const TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "applications", label: "Applications", icon: Inbox },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "form", label: "Form builder", icon: FormInput },
  { id: "distribution", label: "Distribution", icon: Share2 },
  { id: "fees", label: "Fee settings", icon: Wallet },
  { id: "audit", label: "Audit", icon: History },
];

type CycleWorkspaceProps = {
  cycle: AdmissionCycleDTO;
};

export function CycleWorkspace({ cycle }: CycleWorkspaceProps) {
  const [tab, setTab] = React.useState<WorkspaceTab>(() => {
    if (typeof window === "undefined") return "overview";
    const hash = window.location.hash.replace("#", "");
    if (
      hash === "applications" ||
      hash === "form" ||
      hash === "distribution" ||
      hash === "overview" ||
      hash === "audit" ||
      hash === "analytics" ||
      hash === "fees"
    ) {
      return hash as WorkspaceTab;
    }
    return "overview";
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (tab === "overview") {
      history.replaceState(null, "", window.location.pathname);
    } else {
      history.replaceState(null, "", `${window.location.pathname}#${tab}`);
    }
  }, [tab]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = id === tab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" ? <CycleOverviewTab cycle={cycle} /> : null}
      {tab === "applications" ? (
        <ApplicationsInboxTab cycleId={cycle.id} />
      ) : null}
      {tab === "analytics" ? <AnalyticsTab cycleId={cycle.id} /> : null}
      {tab === "form" ? <FormBuilderTab cycleId={cycle.id} /> : null}
      {tab === "distribution" ? <DistributionTab cycle={cycle} /> : null}
      {tab === "fees" ? <CycleFeeSettingsTab cycleId={cycle.id} cycle={cycle} /> : null}
      {tab === "audit" ? <AuditTab cycleId={cycle.id} /> : null}

      <AdmissionsOnboardingTour />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fee Settings Tab — §16.1
// ---------------------------------------------------------------------------

type FeeSettingsData = {
  feeSettings: {
    platformChargeBpsOverride?: number | null;
    payerModeOverride?: string | null;
    overrideNote?: string | null;
    updatedAt?: string | null;
  } | null;
  applicationFee: {
    enabled?: boolean;
    amountMinor?: number;
    currency?: string;
    mode?: string;
  } | null;
  effectiveCharge: {
    chargeMinor: number;
    payerMode: string;
    totalPayable: number;
    source: "cycle_override" | "global_policy" | "none";
  } | null;
};

type PayerModeOverride = "payer_pays" | "school_absorbs" | "waived";
const GLOBAL_PAYER_MODE_VALUE = "global_policy";

function formatMinor(minor: number, currency = "GHS"): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function CycleFeeSettingsTab({
  cycleId,
  cycle,
}: {
  cycleId: string;
  cycle: AdmissionCycleDTO;
}) {
  const [data, setData] = React.useState<FeeSettingsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [bpsOverride, setBpsOverride] = React.useState("");
  const [payerMode, setPayerMode] = React.useState<PayerModeOverride | typeof GLOBAL_PAYER_MODE_VALUE>(GLOBAL_PAYER_MODE_VALUE);
  const [overrideNote, setOverrideNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/admissions/cycles/${cycleId}/fee-settings`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        const fs = json.data.feeSettings;
        if (fs) {
          setBpsOverride(fs.platformChargeBpsOverride != null ? String(fs.platformChargeBpsOverride) : "");
          setPayerMode((fs.payerModeOverride as PayerModeOverride | null) || GLOBAL_PAYER_MODE_VALUE);
          setOverrideNote(fs.overrideNote ?? "");
        } else {
          setBpsOverride("");
          setPayerMode(GLOBAL_PAYER_MODE_VALUE);
          setOverrideNote("");
        }
      } else {
        toast.error("Could not load fee settings.");
      }
    } catch {
      toast.error("Network error loading fee settings.");
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  React.useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        overrideNote: overrideNote.trim() || null,
      };
      if (bpsOverride.trim()) {
        const parsed = parseInt(bpsOverride, 10);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000) {
          toast.error("BPS must be between 0 and 10,000.");
          return;
        }
        body.platformChargeBpsOverride = parsed;
      } else {
        body.platformChargeBpsOverride = null;
      }
      body.payerModeOverride = payerMode === GLOBAL_PAYER_MODE_VALUE ? null : payerMode;

      const res = await fetch(`/api/admin/admissions/cycles/${cycleId}/fee-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Fee settings saved.");
        await load();
      } else {
        toast.error(typeof json.error === "string" ? json.error : "Failed to save fee settings.");
      }
    } catch {
      toast.error("Network error saving fee settings.");
    } finally {
      setSaving(false);
    }
  }

  const appFee = data?.applicationFee;
  const effectiveCharge = data?.effectiveCharge;
  const hasFee = appFee?.enabled && (appFee?.amountMinor ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Context panel */}
      <div className={cn(glassPanelClass, "px-5 py-4")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
        <p className="mb-1 text-sm font-semibold text-white/80">Application fee charge settings</p>
        <p className="mb-4 text-xs text-white/45">
          Configure how EduSentrix charges applicants or the school for payment processing on this admission cycle. These override the global charge policy for this cycle only.
        </p>

        {!hasFee && (
          <div className={cn(glassInsetClass, "px-4 py-3 text-sm text-white/50")}>
            This cycle does not have an application fee configured. Fee settings will apply when an application fee is enabled in cycle settings.
          </div>
        )}

        {hasFee && (
          <div className={cn(glassInsetClass, "mb-4 px-4 py-3")}>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-white/55">Application fee:</span>
              <span className="font-semibold text-white">
                {formatMinor(appFee!.amountMinor!, appFee!.currency || "GHS")}
              </span>
              {effectiveCharge && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-white/55">
                    Charge: {formatMinor(effectiveCharge.chargeMinor)} ({effectiveCharge.payerMode.replace("_", " ")})
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/55">
                    Total payable: {formatMinor(effectiveCharge.totalPayable)}
                  </span>
                  <span className={cn(
                    "rounded-md px-2 py-0.5 text-xs",
                    effectiveCharge.source === "cycle_override"
                      ? "border border-violet-400/25 bg-violet-500/10 text-violet-300"
                      : effectiveCharge.source === "global_policy"
                      ? "border border-teal-400/25 bg-teal-500/10 text-teal-300"
                      : "border border-white/10 bg-white/5 text-white/40"
                  )}>
                    {effectiveCharge.source === "cycle_override"
                      ? "Cycle override"
                      : effectiveCharge.source === "global_policy"
                      ? "Global policy"
                      : "No charge"}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-white/45">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading fee settings…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* BPS Override */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-white/55">
                  Platform charge override (basis points)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  placeholder="e.g. 150 = 1.5%"
                  value={bpsOverride}
                  onChange={(e) => setBpsOverride(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
                />
                <p className="text-xs text-white/35">
                  Leave empty to use the global charge policy. 100 bps = 1%. Max 10,000 bps (100%).
                </p>
              </div>

              {/* Payer mode override */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-white/55">
                  Payer mode override
                </label>
                <PremiumSelect
                  value={payerMode}
                  onValueChange={(v) => setPayerMode(v as typeof payerMode)}
                >
                  <PremiumSelectTrigger className="w-full">
                    <PremiumSelectValue placeholder="Use global policy" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value={GLOBAL_PAYER_MODE_VALUE}>Use global policy</PremiumSelectItem>
                    <PremiumSelectItem value="payer_pays">Applicant pays fee</PremiumSelectItem>
                    <PremiumSelectItem value="school_absorbs">School absorbs fee</PremiumSelectItem>
                    <PremiumSelectItem value="waived">Waived (no platform charge)</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
                <p className="text-xs text-white/35">
                  Controls whether the service fee is passed to the applicant or absorbed by the school.
                </p>
              </div>
            </div>

            {/* Override note */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/55">
                Internal note (optional)
              </label>
              <textarea
                rows={2}
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="e.g. School requested fee waiver for this intake cycle"
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/15 px-4 py-2 text-sm font-semibold text-teal-300 transition hover:bg-teal-500/25 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save fee settings
              </button>
            </div>

            {data?.feeSettings?.updatedAt && (
              <p className="text-xs text-white/30">
                Last updated: {new Date(data.feeSettings.updatedAt).toLocaleString("en-GH")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
