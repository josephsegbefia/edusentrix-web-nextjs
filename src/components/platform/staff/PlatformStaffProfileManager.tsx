"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, RotateCcw, Save, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { Textarea } from "@/components/ui/textarea";
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
import type { PlatformStaffSerializable } from "@/lib/platform/staff/serialize-platform-staff";

type PlatformStaffProfileManagerProps = {
  profile: PlatformStaffSerializable;
  actorPermissions: PlatformPermissionKey[];
  isLegacyPlatformAdmin?: boolean;
  canManageRoles: boolean;
  canSuspend: boolean;
};

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

function canAssign(
  permission: PlatformPermissionKey,
  actorPermissions: PlatformPermissionKey[],
  isLegacyPlatformAdmin?: boolean
) {
  return isLegacyPlatformAdmin || actorPermissions.includes(permission);
}

export function PlatformStaffProfileManager({
  profile,
  actorPermissions,
  isLegacyPlatformAdmin,
  canManageRoles,
  canSuspend,
}: PlatformStaffProfileManagerProps) {
  const router = useRouter();
  const canUseAllSchools =
    isLegacyPlatformAdmin || actorPermissions.includes("platform.staff.manageRoles");
  const [rolePreset, setRolePreset] =
    React.useState<PlatformStaffRolePreset>(profile.rolePreset);
  const [accessMode, setAccessMode] = React.useState(profile.accessMode);
  const [permissions, setPermissions] = React.useState<PlatformPermissionKey[]>(
    profile.permissions.filter(
      (permission): permission is PlatformPermissionKey =>
        permission in PLATFORM_PERMISSION_REGISTRY
    )
  );
  const [reason, setReason] = React.useState("");
  const [criticalConfirmation, setCriticalConfirmation] = React.useState("");
  const [statusReason, setStatusReason] = React.useState("");
  const [confirmAction, setConfirmAction] = React.useState<"suspend" | "reactivate" | null>(
    null
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const selectedDefinitions = React.useMemo(
    () => permissions.map((permission) => PLATFORM_PERMISSION_REGISTRY[permission]),
    [permissions]
  );
  const criticalPermissions = selectedDefinitions.filter(
    (permission) => permission.riskLevel === "critical"
  );
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
    if (!canManageRoles || !canAssign(permission, actorPermissions, isLegacyPlatformAdmin)) {
      return;
    }
    setRolePreset("custom");
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  async function savePermissions() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/platform/staff/${profile.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rolePreset,
          permissions,
          accessMode,
          reason,
          criticalConfirmation,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update staff permissions");
      }
      setReason("");
      setCriticalConfirmation("");
      setMessage("Permissions updated and audited.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff permissions");
    } finally {
      setSaving(false);
    }
  }

  async function submitStatusAction() {
    if (!confirmAction) return;
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/platform/staff/${profile.id}/${confirmAction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: statusReason }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Failed to ${confirmAction} staff profile`);
      }
      setStatusReason("");
      setConfirmAction(null);
      setMessage(
        confirmAction === "suspend"
          ? "Staff profile suspended and audited."
          : "Staff profile reactivated and audited."
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${confirmAction} staff profile`);
    }
  }

  const canSave =
    canManageRoles &&
    permissions.length > 0 &&
    reason.trim().length >= 8 &&
    (criticalPermissions.length === 0 || criticalConfirmation === CRITICAL_CONFIRMATION);

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <h2 className="text-lg font-semibold">Role and Access</h2>
          <p className="mt-1 text-sm text-white/50">
            Role presets set a starting permission bundle. Every change requires a reason.
          </p>

          <div className="mt-4 space-y-3">
            {PLATFORM_STAFF_ROLE_PRESETS.map((preset) => {
              const definition = PLATFORM_ROLE_PRESETS[preset];
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={!canManageRoles}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-colors",
                    rolePreset === preset
                      ? "border-cyan-300/25 bg-cyan-400/10"
                      : "border-white/10 bg-black/20 hover:bg-white/8",
                    !canManageRoles && "cursor-not-allowed opacity-60 hover:bg-black/20"
                  )}
                >
                  <span className="text-sm font-semibold text-white">{definition.label}</span>
                  <span className="mt-1 block text-xs text-white/45">
                    {definition.permissions.length} permissions
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3">
            {(["delegated_only", "all_schools"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={!canManageRoles || (mode === "all_schools" && !canUseAllSchools)}
                onClick={() => setAccessMode(mode)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  accessMode === mode
                    ? "border-violet-300/25 bg-violet-400/10 text-violet-100"
                    : "border-white/10 bg-black/20 text-white/65 hover:bg-white/8",
                  (!canManageRoles || (mode === "all_schools" && !canUseAllSchools)) &&
                    "cursor-not-allowed opacity-50 hover:bg-black/20"
                )}
              >
                <span className="font-semibold">
                  {mode === "delegated_only" ? "Delegated only" : "All schools"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Permissions</h2>
              <p className="mt-1 text-sm text-white/50">
                {permissions.length} selected, {highRiskCount} high risk,{" "}
                {criticalPermissions.length} critical.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/55">
              {canManageRoles ? "Editable" : "Read only"}
            </span>
          </div>

          <div className="mt-5 space-y-5">
            {categories.map((category) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-semibold text-white/80">{category}</h3>
                <div className="grid gap-2 xl:grid-cols-2">
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
                          disabled={!canManageRoles || !allowed}
                          onClick={() => togglePermission(permission.key)}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition-colors",
                            checked
                              ? "border-cyan-300/25 bg-cyan-400/10"
                              : "border-white/10 bg-black/20 hover:bg-white/8",
                            (!canManageRoles || !allowed) &&
                              "cursor-not-allowed opacity-50 hover:bg-black/20"
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

          {canManageRoles ? (
            <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              {criticalPermissions.length > 0 ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-50">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Critical permissions selected. Type "{CRITICAL_CONFIRMATION}" before saving.
                    </p>
                  </div>
                </div>
              ) : null}

              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for this role or permission change"
                className="min-h-24 border-white/10 bg-black/20 text-white placeholder:text-white/30"
              />
              {criticalPermissions.length > 0 ? (
                <input
                  value={criticalConfirmation}
                  onChange={(event) => setCriticalConfirmation(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-rose-300/40"
                  placeholder={CRITICAL_CONFIRMATION}
                />
              ) : null}
              <Button
                type="button"
                onClick={() => void savePermissions()}
                disabled={!canSave || saving}
                className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
        <h2 className="text-lg font-semibold">Lifecycle</h2>
        <p className="mt-1 text-sm text-white/50">
          Suspend access immediately when an operator should no longer enter the platform console.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {profile.status === "suspended" ? (
            <Button
              type="button"
              disabled={!canManageRoles}
              onClick={() => setConfirmAction("reactivate")}
              className="bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reactivate Staff
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canSuspend}
              onClick={() => setConfirmAction("suspend")}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              Suspend Staff
            </Button>
          )}
        </div>
      </section>

      <PromptDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={confirmAction === "suspend" ? "Suspend platform staff?" : "Reactivate staff?"}
        description={
          confirmAction === "suspend"
            ? "This blocks platform operations access for this staff profile."
            : "This restores platform operations access for this staff profile."
        }
        inputLabel="Audit reason"
        placeholder="Record a clear reason for the audit trail"
        value={statusReason}
        onValueChange={setStatusReason}
        confirmLabel={confirmAction === "suspend" ? "Suspend" : "Reactivate"}
        intent={confirmAction === "suspend" ? "destructive" : "default"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void submitStatusAction()}
      />
    </div>
  );
}
