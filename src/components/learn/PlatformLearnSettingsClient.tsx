"use client";

import * as React from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import type { SerializedLearnPlatformSettings } from "@/lib/learn/platform-settings";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type PlatformLearnSettingsClientProps = {
  initialSettings: SerializedLearnPlatformSettings;
  canManagePricing: boolean;
};

type ApiResponse =
  | { success: true; data: SerializedLearnPlatformSettings }
  | { success: false; error: string };

function toCedis(minor: number) {
  return (Math.max(0, minor) / 100).toFixed(2);
}

function toMinor(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function PlatformLearnSettingsClient({
  initialSettings,
  canManagePricing,
}: PlatformLearnSettingsClientProps) {
  const [settings, setSettings] = React.useState(initialSettings);
  const [price, setPrice] = React.useState(
    toCedis(initialSettings.pricePerStudentPerTermMinor)
  );
  const [allowPlatformGifts, setAllowPlatformGifts] = React.useState(
    initialSettings.allowPlatformGifts
  );
  const [starterPlanBlocked, setStarterPlanBlocked] = React.useState(
    initialSettings.starterPlanBlocked
  );
  const [disabled, setDisabled] = React.useState(initialSettings.disabled);
  const [saving, setSaving] = React.useState(false);

  async function onSave() {
    const priceMinor = toMinor(price);
    if (priceMinor === null) {
      toast.error("Enter a valid Learn price.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/platform/learn/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricePerStudentPerTermMinor: priceMinor,
          allowPlatformGifts,
          starterPlanBlocked,
          disabled,
        }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Failed to save Learn settings." : payload.error
        );
      }
      setSettings(payload.data);
      setPrice(toCedis(payload.data.pricePerStudentPerTermMinor));
      setAllowPlatformGifts(payload.data.allowPlatformGifts);
      setStarterPlanBlocked(payload.data.starterPlanBlocked);
      setDisabled(payload.data.disabled);
      toast.success("Learn settings saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save Learn settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Learn Settings"
          subtitle="Configure parent pricing, platform gifts, and global eligibility controls for EduSentrix Learn."
          backHref="/platform/learn"
          backLabel="Learn overview"
          icon={ShieldCheck}
          actions={
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={!canManagePricing || saving}
              className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save settings
            </Button>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassPanel className="space-y-5 p-6" glow="both">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Pricing and access
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Learn parent payments stay separate from school fee invoices and
                balances.
              </p>
            </div>

            <div className={cn(glassInsetClass, "space-y-2 p-4")}>
              <label
                htmlFor="learn-price"
                className="text-sm font-medium text-white"
              >
                Price per student per term
              </label>
              <div className="flex max-w-sm items-center overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <span className="border-r border-white/10 px-3 text-sm font-semibold text-white/55">
                  GHS
                </span>
                <Input
                  id="learn-price"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  inputMode="decimal"
                  disabled={!canManagePricing || saving}
                  className="border-0 bg-transparent text-white shadow-none focus-visible:ring-0"
                />
              </div>
              <p className="text-xs text-white/45">
                Current stored amount: GHS{" "}
                {toCedis(settings.pricePerStudentPerTermMinor)}
              </p>
            </div>

            <SettingSwitch
              label="Allow platform gifts"
              description="Platform operators with gift permission can grant Learn access to eligible students."
              checked={allowPlatformGifts}
              disabled={!canManagePricing || saving}
              onCheckedChange={setAllowPlatformGifts}
            />
            <SettingSwitch
              label="Block Starter plans"
              description="Starter schools are excluded from Learn eligibility unless platform policy changes."
              checked={starterPlanBlocked}
              disabled={!canManagePricing || saving}
              onCheckedChange={setStarterPlanBlocked}
            />
            <SettingSwitch
              label="Disable EduSentrix Learn globally"
              description="Stops new eligibility and access activation while preserving existing records."
              checked={disabled}
              disabled={!canManagePricing || saving}
              onCheckedChange={setDisabled}
              warning
            />
          </GlassPanel>

          <div className="space-y-5">
            <GlassPanel className="p-6" glow="cyan">
              <h2 className="text-lg font-semibold text-white">
                Eligibility rules
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-white/60">
                <li>School subscription must be active, trial, pilot, or grace.</li>
                <li>School must include Learn or lesson features.</li>
                <li>Starter plans are blocked when the rule is enabled.</li>
                <li>Suspended, cancelled, expired, or inactive schools are blocked.</li>
              </ul>
            </GlassPanel>

            <GlassPanel className="p-6" glow="teal">
              <h2 className="text-lg font-semibold text-white">Audit</h2>
              <p className="mt-3 text-sm leading-6 text-white/55">
                Every settings update is written to the platform audit log as
                `platform.learn.settings_updated`.
              </p>
              {!canManagePricing ? (
                <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                  Your account can view these settings, but cannot update Learn
                  pricing or global controls.
                </p>
              ) : null}
            </GlassPanel>
          </div>
        </div>
      </WorkspacePageShell>
    </div>
  );
}

function SettingSwitch({
  label,
  description,
  checked,
  disabled,
  warning = false,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  warning?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className={cn(glassInsetClass, "flex items-start justify-between gap-4 p-4")}>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-1 text-sm leading-5 text-white/50">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className={cn(warning && checked && "data-[state=checked]:bg-rose-500")}
      />
    </div>
  );
}
