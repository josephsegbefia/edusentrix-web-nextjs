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
  useCreatePromotionPolicy,
  useActivatePromotionPolicy,
} from "@/hooks/admin/usePromotionPolicies";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useBusyToast } from "@/hooks/useBusyToast";
import { BookOpen, CheckCircle, Loader2, Plus } from "lucide-react";

export function PolicyTab() {
  const busy = useBusyToast();
  const { data, isLoading } = usePromotionPolicyActive();
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
      {activePolicy && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <CheckCircle className="h-4 w-4" />
            Active Policy
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-white">{activePolicy.name}</span>
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/20 text-emerald-200">
              v{activePolicy.version}
            </Badge>
            <span className="text-sm text-white/50">
              {activePolicy.criteria.length} criteria • {activePolicy.logic.replace("_", " ")}
            </span>
          </div>
        </div>
      )}

      {!activePolicy && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200">
            No active policy. Create a policy below and activate it to run previews. Fallback uses
            Settings attendance % and grading scale pass threshold.
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
            <Label className="text-white/70">Apply to grades (optional; empty = all)</Label>
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
