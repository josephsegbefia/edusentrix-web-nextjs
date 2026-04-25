// src/components/admin/promotions/PolicyTab.tsx
// PROMO-FE-003: Policy create and activate flows
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  usePromotionPolicyActive,
  usePromotionPolicies,
  useCreatePromotionPolicy,
  useActivatePromotionPolicy,
} from "@/hooks/admin/usePromotionPolicies";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useBusyToast } from "@/hooks/useBusyToast";
import { BookOpen, CheckCircle, Loader2, Plus } from "lucide-react";
import { LeoIcon } from "@/components/icons/LeoIcon";

export function PolicyTab() {
  const busy = useBusyToast();
  const { data, isLoading } = usePromotionPolicyActive();
  const { data: policiesData } = usePromotionPolicies();
  const createPolicy = useCreatePromotionPolicy();
  const activatePolicy = useActivatePromotionPolicy();
  const { data: gradesData } = useGradeOptions();
  const grades = gradesData ?? [];

  const [name, setName] = React.useState("Default End-of-Year Policy");
  const [attendanceMin, setAttendanceMin] = React.useState(75);
  const [averageMin, setAverageMin] = React.useState(50);
  const [treatExcused, setTreatExcused] = React.useState(true);
  const [financeEnabled, setFinanceEnabled] = React.useState(false);
  const [gradeIds, setGradeIds] = React.useState<string[]>([]);

  const activePolicy = data?.data ?? null;
  const activePolicies = data?.policies ?? [];
  const policies = policiesData?.data ?? [];
  const gradeNameById = new Map(grades.map((grade) => [grade._id, grade.name]));

  function scopeLabel(gradeIds?: string[]) {
    if (!gradeIds?.length) return "All grades";
    return gradeIds.map((id) => gradeNameById.get(id) ?? "Unknown grade").join(", ");
  }

  const handleCreate = async () => {
    try {
      await busy.promise(
        createPolicy.mutateAsync({
          name: name.trim() || "Default Policy",
          appliesTo: { gradeIds: gradeIds.length > 0 ? gradeIds : undefined },
          criteria: [
            { key: "attendance_percent", operator: ">=", value: attendanceMin, required: true },
            { key: "overall_average", operator: ">=", value: averageMin, required: true },
            ...(financeEnabled
              ? [{ key: "fee_outstanding_minor" as const, operator: "<=" as const, value: 0, required: false }]
              : []),
          ],
          logic: "all_required_pass",
          thresholds: { promote: 100 },
          tieBreaker: "overall_average",
          attendanceComputation: { treatExcusedAsPresent: treatExcused },
          financeHold: { enabled: financeEnabled, maxOutstandingMinor: 0 },
          manualOverrideRules: { requireReason: true, requireApprover: false },
        }),
        {
          loading: "Creating policy...",
          success: "Policy created successfully",
          error: (e: Error) => e.message,
        }
      );
    } catch {
      // Error handled by busy
    }
  };

  const handleActivate = async (policyId: string) => {
    try {
      await busy.promise(activatePolicy.mutateAsync(policyId), {
        loading: "Activating policy...",
        success: "Policy activated",
        error: (e: Error) => e.message,
      });
    } catch {
      // Error handled
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Promotion policy</h2>
        <p className="mt-1 text-sm text-white/50">
          Define the rules used to evaluate students for promotion.
        </p>
      </div>
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
            <LeoIcon className="h-4 w-4 text-cyan-100" />
          </div>
          <div>
            <p className="font-medium text-white">Leo configuration guide</p>
            <p className="mt-1 text-sm text-white/60">
              For the first live run, keep the policy simple: attendance, average score, and a
              clear fee hold. You can use grade scoping to pilot one section before applying it
              school-wide.
            </p>
          </div>
        </div>
      </div>
      {activePolicies.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <CheckCircle className="h-4 w-4" />
            Active Scoped Policies
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {activePolicies.map((policy) => (
              <div key={policy.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{policy.name}</span>
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/20 text-emerald-200">
                    v{policy.version}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-white/55">
                  Applies to: {scopeLabel(policy.appliesTo.gradeIds)}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {policy.criteria.length} criteria • {policy.logic.replace("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!activePolicy && activePolicies.length === 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200">
            No active policy. Create scoped policies below and activate them. If you activate an
            all-grades policy, it replaces every active scoped policy.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <BookOpen className="h-4 w-4" />
          Create new policy
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/70">Policy name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Default End-of-Year Policy"
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Minimum attendance (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={attendanceMin}
              onChange={(e) => setAttendanceMin(Number(e.target.value))}
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Minimum overall average (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={averageMin}
              onChange={(e) => setAverageMin(Number(e.target.value))}
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              checked={treatExcused}
              onCheckedChange={setTreatExcused}
            />
            <Label className="text-white/70">
              Treat excused absences as present for attendance
            </Label>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={financeEnabled} onCheckedChange={setFinanceEnabled} />
            <Label className="text-white/70">
              Require no fee outstanding (blocks promotion if fees owed)
            </Label>
          </div>
        </div>
        {grades.length > 0 && (
          <div className="mt-4 space-y-2">
            <Label className="text-white/70">Apply to grades</Label>
            <p className="text-xs text-white/40">
              Select the grades this policy controls. Leave empty only for a true whole-school default.
            </p>
            <div className="flex flex-wrap gap-2">
              {grades.map((g) => {
                const id = (g as { id?: string; _id?: string }).id ?? (g as { _id: string })._id;
                const checked = gradeIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setGradeIds((prev) => [...prev, id]);
                        else setGradeIds((prev) => prev.filter((x) => x !== id));
                      }}
                      className="rounded"
                    />
                    {(g as { name: string }).name}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <Button
          onClick={handleCreate}
          disabled={createPolicy.isPending}
          className="mt-4 gap-2"
        >
          {createPolicy.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Policy
        </Button>
      </div>

      {policies.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-4 text-base font-semibold text-white">All promotion policies</h3>
          <div className="space-y-3">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{policy.name}</p>
                    <Badge
                      variant="outline"
                      className={
                        policy.isActive
                          ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                          : "border-white/10 bg-white/5 text-white/55"
                      }
                    >
                      {policy.isActive ? "Active" : "Draft"} • v{policy.version}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-white/50">
                    Applies to: {scopeLabel(policy.appliesTo.gradeIds)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleActivate(policy.id)}
                  disabled={policy.isActive || activatePolicy.isPending}
                  className="border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20"
                >
                  {policy.isActive ? "Active" : "Activate for scope"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {createPolicy.data?.data &&
        !createPolicy.data.data.isActive &&
        activePolicy?.id !== createPolicy.data.data.id && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
          <p className="mb-2 text-sm text-indigo-200">
            Policy &quot;{createPolicy.data.data.name}&quot; created. Activate it to use for previews.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActivate(createPolicy.data!.data.id)}
            disabled={activatePolicy.isPending}
            className="border-indigo-500/40 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30"
          >
            {activatePolicy.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}{" "}
            Activate
          </Button>
        </div>
      )}
    </div>
  );
}
