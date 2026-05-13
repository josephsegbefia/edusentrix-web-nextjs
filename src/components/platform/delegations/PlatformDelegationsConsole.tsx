"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_PERMISSION_REGISTRY, type PlatformPermissionKey } from "@/lib/platform/permissions/registry";
import {
  PLATFORM_DELEGATION_SCOPE_DESCRIPTIONS,
  PLATFORM_DELEGATION_SCOPE_LABELS,
} from "@/lib/platform/delegations/scope-labels";
import type { PlatformDelegationSerializable } from "@/lib/platform/delegations/serialize-platform-delegation";
import {
  PLATFORM_DELEGATION_SCOPES,
  type PlatformDelegationScope,
} from "@/lib/platform/delegations/scopes";

type StaffOption = {
  id: string;
  fullName: string;
  email: string;
  permissions: PlatformPermissionKey[];
};

type SchoolOption = {
  id: string;
  name: string;
};

type PlatformDelegationsConsoleProps = {
  delegations: PlatformDelegationSerializable[];
  staffOptions: StaffOption[];
  schoolOptions: SchoolOption[];
};

const DEFAULT_SCOPE: PlatformDelegationScope = "school_implementation";

function dateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString();
}

export function PlatformDelegationsConsole({
  delegations,
  staffOptions,
  schoolOptions,
}: PlatformDelegationsConsoleProps) {
  const router = useRouter();
  const [staffProfileId, setStaffProfileId] = React.useState(staffOptions[0]?.id || "");
  const [schoolId, setSchoolId] = React.useState(schoolOptions[0]?.id || "");
  const [scope, setScope] = React.useState<PlatformDelegationScope>(DEFAULT_SCOPE);
  const [startsAt, setStartsAt] = React.useState<Date | null>(new Date());
  const [expiresAt, setExpiresAt] = React.useState<Date | null>(null);
  const [reason, setReason] = React.useState("");
  const [selectedPermissions, setSelectedPermissions] = React.useState<PlatformPermissionKey[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<PlatformDelegationSerializable | null>(null);
  const [revokeReason, setRevokeReason] = React.useState("");

  const selectedStaff = staffOptions.find((staff) => staff.id === staffProfileId);
  const assignablePermissions = selectedStaff?.permissions || [];

  React.useEffect(() => {
    setSelectedPermissions((current) =>
      current.filter((permission) => assignablePermissions.includes(permission))
    );
  }, [assignablePermissions]);

  function togglePermission(permission: PlatformPermissionKey) {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  async function createDelegation() {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/platform/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffProfileId,
          schoolId,
          scope,
          permissions: selectedPermissions,
          startsAt: dateInputValue(startsAt),
          expiresAt: dateInputValue(expiresAt),
          reason,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create delegation");
      }
      setMessage("Delegation created and audited.");
      setReason("");
      setSelectedPermissions([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create delegation");
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeDelegation() {
    if (!revokeTarget) return;
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/platform/delegations/${revokeTarget.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revokeReason }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to revoke delegation");
      }
      setMessage("Delegation revoked and audited.");
      setRevokeTarget(null);
      setRevokeReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke delegation");
    }
  }

  const canSubmit =
    staffProfileId &&
    schoolId &&
    scope &&
    startsAt &&
    reason.trim().length >= 8 &&
    selectedPermissions.length > 0;

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

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-100">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Create Delegation</h2>
            <p className="mt-1 text-sm text-white/50">
              Assign a staff member to a school, scope, and limited permission set.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/75">Staff member</label>
            <PremiumSelect value={staffProfileId} onValueChange={setStaffProfileId}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select staff" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {staffOptions.map((staff) => (
                  <PremiumSelectItem key={staff.id} value={staff.id} description={staff.email}>
                    {staff.fullName}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/75">School</label>
            <PremiumSelect value={schoolId} onValueChange={setSchoolId}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select school" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {schoolOptions.map((school) => (
                  <PremiumSelectItem key={school.id} value={school.id}>
                    {school.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/75">Scope</label>
            <PremiumSelect
              value={scope}
              onValueChange={(value) => setScope(value as PlatformDelegationScope)}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select scope" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {PLATFORM_DELEGATION_SCOPES.map((item) => (
                  <PremiumSelectItem
                    key={item}
                    value={item}
                    description={PLATFORM_DELEGATION_SCOPE_DESCRIPTIONS[item]}
                  >
                    {PLATFORM_DELEGATION_SCOPE_LABELS[item]}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CustomDatePicker
              label="Starts"
              value={startsAt}
              onChange={setStartsAt}
              placeholder="Start date"
            />
            <CustomDatePicker
              label="Expires"
              value={expiresAt}
              onChange={setExpiresAt}
              placeholder="No expiry"
              minDate={startsAt || undefined}
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <p className="text-sm font-medium text-white/75">Delegated permissions</p>
            <p className="mt-1 text-xs text-white/45">
              Only permissions already granted to the selected staff profile can be delegated.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {assignablePermissions.map((permission) => (
              <button
                key={permission}
                type="button"
                onClick={() => togglePermission(permission)}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  selectedPermissions.includes(permission)
                    ? "border-cyan-300/25 bg-cyan-400/10"
                    : "border-white/10 bg-black/20 hover:bg-white/8"
                }`}
              >
                <span className="text-sm font-medium text-white">
                  {PLATFORM_PERMISSION_REGISTRY[permission]?.label || permission}
                </span>
                <span className="mt-1 block text-xs text-white/45">{permission}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for this delegation"
            className="min-h-24 border-white/10 bg-black/20 text-white placeholder:text-white/30"
          />
          <Button
            type="button"
            onClick={() => void createDelegation()}
            disabled={!canSubmit || submitting}
            className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          >
            <Plus className="mr-2 h-4 w-4" />
            {submitting ? "Creating..." : "Create Delegation"}
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
        <h2 className="text-lg font-semibold">Delegations</h2>
        <p className="mt-1 text-sm text-white/50">
          Active and historical platform staff school assignments.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">Staff</th>
                <th className="pb-3 font-medium">School</th>
                <th className="pb-3 font-medium">Scope</th>
                <th className="pb-3 font-medium">Permissions</th>
                <th className="pb-3 font-medium">Window</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {delegations.map((delegation) => (
                <tr key={delegation.id} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-white">{delegation.staffName}</p>
                    <p className="text-xs text-white/45">{delegation.staffEmail}</p>
                  </td>
                  <td className="py-3 pr-4 text-white/70">{delegation.schoolName || "No school"}</td>
                  <td className="py-3 pr-4 text-white">
                    {PLATFORM_DELEGATION_SCOPE_LABELS[delegation.scope]}
                  </td>
                  <td className="py-3 pr-4 text-white/70">
                    {delegation.permissions.length.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-white/55">
                    {new Date(delegation.startsAt).toLocaleDateString()}
                    {delegation.expiresAt
                      ? ` - ${new Date(delegation.expiresAt).toLocaleDateString()}`
                      : " - no expiry"}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs capitalize text-white/65">
                      {delegation.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {delegation.status === "active" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRevokeTarget(delegation)}
                        className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        <RotateCcw className="mr-2 h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-white/35">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {delegations.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
              No platform delegations have been created yet.
            </div>
          ) : null}
        </div>
      </section>

      <PromptDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revoke delegation?"
        description="This immediately removes delegated access for the selected scope."
        inputLabel="Audit reason"
        placeholder="Reason for revoking this delegation"
        value={revokeReason}
        onValueChange={setRevokeReason}
        confirmLabel="Revoke"
        intent="destructive"
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void revokeDelegation()}
      />
    </div>
  );
}
