"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import {
  PLATFORM_PERMISSION_REGISTRY,
  type PlatformPermissionCategory,
  type PlatformPermissionKey,
} from "@/lib/platform/permissions/registry";
import {
  PLATFORM_ROLE_PRESETS,
  PLATFORM_STAFF_ROLE_PRESETS,
  type PlatformStaffRolePreset,
} from "@/lib/platform/permissions/presets";

type InviteWizardProps = {
  actorPermissions: PlatformPermissionKey[];
  isLegacyPlatformAdmin?: boolean;
};

const STEPS = ["Details", "Role", "Permissions", "Review"] as const;
const CRITICAL_CONFIRMATION = "I understand";

const RISK_CLASSES = {
  low: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  medium: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  high: "border-orange-400/20 bg-orange-500/10 text-orange-100",
  critical: "border-rose-400/20 bg-rose-500/10 text-rose-100",
};

const permissionDefinitions = Object.values(PLATFORM_PERMISSION_REGISTRY).filter(
  (permission) => permission.assignable
);

const categories = Array.from(
  new Set(permissionDefinitions.map((permission) => permission.category))
) as PlatformPermissionCategory[];

function roleLabel(role: PlatformStaffRolePreset) {
  return PLATFORM_ROLE_PRESETS[role].label;
}

function canAssign(
  permission: PlatformPermissionKey,
  actorPermissions: PlatformPermissionKey[],
  isLegacyPlatformAdmin?: boolean
) {
  return isLegacyPlatformAdmin || actorPermissions.includes(permission);
}

export function PlatformStaffInviteWizard({
  actorPermissions,
  isLegacyPlatformAdmin,
}: InviteWizardProps) {
  const router = useRouter();
  const canUseAllSchools =
    isLegacyPlatformAdmin || actorPermissions.includes("platform.staff.manageRoles");
  const [step, setStep] = React.useState(0);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [rolePreset, setRolePreset] =
    React.useState<PlatformStaffRolePreset>("implementation_specialist");
  const [permissions, setPermissions] = React.useState<PlatformPermissionKey[]>(() =>
    PLATFORM_ROLE_PRESETS.implementation_specialist.permissions.filter((permission) =>
      canAssign(permission, actorPermissions, isLegacyPlatformAdmin)
    )
  );
  const [accessMode, setAccessMode] = React.useState<"all_schools" | "delegated_only">(
    canUseAllSchools
      ? PLATFORM_ROLE_PRESETS.implementation_specialist.defaultAccessMode
      : "delegated_only"
  );
  const [criticalConfirmation, setCriticalConfirmation] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedDefinitions = React.useMemo(
    () => permissions.map((permission) => PLATFORM_PERMISSION_REGISTRY[permission]),
    [permissions]
  );

  const criticalCount = selectedDefinitions.filter(
    (permission) => permission.riskLevel === "critical"
  ).length;
  const highRiskCount = selectedDefinitions.filter(
    (permission) => permission.riskLevel === "high"
  ).length;

  function applyPreset(nextPreset: PlatformStaffRolePreset) {
    const preset = PLATFORM_ROLE_PRESETS[nextPreset];
    setRolePreset(nextPreset);
    setAccessMode(canUseAllSchools ? preset.defaultAccessMode : "delegated_only");
    setPermissions(
      preset.permissions.filter((permission) =>
        canAssign(permission, actorPermissions, isLegacyPlatformAdmin)
      )
    );
    setCriticalConfirmation("");
  }

  function togglePermission(permission: PlatformPermissionKey) {
    if (!canAssign(permission, actorPermissions, isLegacyPlatformAdmin)) return;
    setRolePreset("custom");
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  function canContinue() {
    if (step === 0) return fullName.trim().length >= 2 && email.includes("@");
    if (step === 1) return jobTitle.trim().length >= 2;
    if (step === 2) return permissions.length > 0;
    if (criticalCount > 0) return criticalConfirmation === CRITICAL_CONFIRMATION;
    return true;
  }

  async function submit() {
    if (!canContinue()) return;
    setSubmitting(true);
    setError(null);
    let shouldKeepBusy = false;

    try {
      const res = await fetch("/api/platform/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          jobTitle,
          rolePreset,
          permissions,
          accessMode,
          criticalConfirmation,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to invite platform staff");
      }
      shouldKeepBusy = true;
      router.push("/platform/staff");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite platform staff");
    } finally {
      if (!shouldKeepBusy) {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2 md:grid-cols-4">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              index === step
                ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
            )}
          >
            <span className="text-xs font-medium uppercase tracking-[0.14em]">
              Step {index + 1}
            </span>
            <span className="mt-1 block text-sm font-semibold">{label}</span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/75">Full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/40"
                placeholder="Ama Mensah"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/75">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/40"
                placeholder="ama@edusentrix.com"
                type="email"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/75">Phone</span>
              <GhanaPhoneInput
                unstyled
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/40"
                placeholder="+233 24 123 4567"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/75">Job title</span>
              <input
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/40"
                placeholder="Implementation Specialist"
              />
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PLATFORM_STAFF_ROLE_PRESETS.map((preset) => {
                const definition = PLATFORM_ROLE_PRESETS[preset];
                const active = rolePreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-colors",
                      active
                        ? "border-cyan-300/25 bg-cyan-400/10"
                        : "border-white/10 bg-black/20 hover:bg-white/8"
                    )}
                  >
                    <span className="text-sm font-semibold text-white">
                      {definition.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/45">
                      {definition.description}
                    </span>
                    <span className="mt-3 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55">
                      {definition.permissions.length} permissions
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(["delegated_only", "all_schools"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={mode === "all_schools" && !canUseAllSchools}
                  onClick={() => setAccessMode(mode)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    accessMode === mode
                      ? "border-violet-300/25 bg-violet-400/10 text-violet-100"
                      : "border-white/10 bg-black/20 text-white/65 hover:bg-white/8",
                    mode === "all_schools" &&
                      !canUseAllSchools &&
                      "cursor-not-allowed opacity-40 hover:bg-black/20"
                  )}
                >
                  <span className="font-semibold">
                    {mode === "delegated_only" ? "Delegated only" : "All schools"}
                  </span>
                  <span className="mt-1 block text-xs text-white/45">
                    {mode === "delegated_only"
                      ? "Use this for implementation, support, training, and scoped work."
                      : canUseAllSchools
                        ? "Use only for senior operations, finance, or owner-level roles."
                        : "Requires staff role management permission."}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/55">
                {permissions.length} selected
              </span>
              <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1.5 text-orange-100">
                {highRiskCount} high risk
              </span>
              <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-rose-100">
                {criticalCount} critical
              </span>
            </div>

            {categories.map((category) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-semibold text-white/80">{category}</h3>
                <div className="grid gap-2 lg:grid-cols-2">
                  {permissionDefinitions
                    .filter((permission) => permission.category === category)
                    .map((permission) => {
                      const checked = permissions.includes(permission.key);
                      const allowed = canAssign(
                        permission.key,
                        actorPermissions,
                        isLegacyPlatformAdmin
                      );
                      return (
                        <button
                          key={permission.key}
                          type="button"
                          disabled={!allowed}
                          onClick={() => togglePermission(permission.key)}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition-colors",
                            checked
                              ? "border-cyan-300/25 bg-cyan-400/10"
                              : "border-white/10 bg-black/20 hover:bg-white/8",
                            !allowed && "cursor-not-allowed opacity-40 hover:bg-black/20"
                          )}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span>
                              <span className="block text-sm font-medium text-white">
                                {permission.label}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-white/45">
                                {permission.description}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase",
                                RISK_CLASSES[permission.riskLevel]
                              )}
                            >
                              {permission.riskLevel}
                            </span>
                          </span>
                          {checked ? (
                            <span className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-100">
                              <Check className="h-3.5 w-3.5" />
                              Selected
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryItem label="Name" value={fullName || "Not set"} />
              <SummaryItem label="Email" value={email || "Not set"} />
              <SummaryItem label="Job title" value={jobTitle || "Not set"} />
              <SummaryItem label="Role preset" value={roleLabel(rolePreset)} />
              <SummaryItem
                label="Access mode"
                value={accessMode === "all_schools" ? "All schools" : "Delegated only"}
              />
              <SummaryItem label="Permissions" value={permissions.length.toLocaleString()} />
            </div>

            {criticalCount > 0 || highRiskCount > 0 ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Sensitive access selected</p>
                    <p className="mt-1 text-amber-50/70">
                      This invite includes {highRiskCount} high-risk and {criticalCount} critical permission
                      {highRiskCount + criticalCount === 1 ? "" : "s"}.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>This role does not include high-risk or critical permissions.</p>
                </div>
              </div>
            )}

            {criticalCount > 0 ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white/75">
                  Type "{CRITICAL_CONFIRMATION}" to confirm critical permissions
                </span>
                <input
                  value={criticalConfirmation}
                  onChange={(event) => setCriticalConfirmation(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-rose-300/40"
                  placeholder={CRITICAL_CONFIRMATION}
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || submitting}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}
            disabled={!canContinue()}
            className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          >
            Continue
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={submit}
            disabled={!canContinue() || submitting}
            className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          >
            <Send className="mr-2 h-4 w-4" />
            {submitting ? "Sending..." : "Send Invitation"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
