// src/components/admin/promotions/PreviewTab.tsx
// PROMO-FE-004: Run preview with filters, show totals
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePromotionPreview } from "@/hooks/admin/usePromotionPreview";
import { usePromotionPolicyActive } from "@/hooks/admin/usePromotionPolicies";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { usePromotionCycles } from "@/hooks/admin/usePromotionCycles";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Eye, Loader2, AlertCircle } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectTrigger,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

export function PreviewTab() {
  const busy = useBusyToast();
  const { data: policyData } = usePromotionPolicyActive();
  const { data: periodsData } = useAcademicPeriods();
  const { data: gradesData } = useGradeOptions();
  const preview = usePromotionPreview();
  const { data: cyclesData, refetch: refetchCycles } = usePromotionCycles();

  const periods = periodsData?.periods ?? [];
  const grades = gradesData ?? [];
  const activePolicies = policyData?.policies ?? [];
  const gradeNameById = new Map(grades.map((grade) => [grade._id, grade.name]));

  const [sourcePeriodId, setSourcePeriodId] = React.useState("");
  const [targetPeriodId, setTargetPeriodId] = React.useState("");
  const [policyId, setPolicyId] = React.useState("");
  const [gradeIds, setGradeIds] = React.useState<string[]>([]);
  const [lastResult, setLastResult] = React.useState<{
    cycleId: string;
    totals: Record<string, number>;
  } | null>(null);

  React.useEffect(() => {
    if (periods.length && !sourcePeriodId) {
      const current = periods.find((p) => p.isCurrent) ?? periods[0];
      if (current) setSourcePeriodId(String(current._id));
    }
  }, [periods, sourcePeriodId]);

  React.useEffect(() => {
    if (!policyId && activePolicies.length === 1) {
      setPolicyId(activePolicies[0]?.id ?? "");
    }
  }, [activePolicies, policyId]);

  const selectedPolicy = activePolicies.find((policy) => policy.id === policyId) ?? null;

  React.useEffect(() => {
    if (selectedPolicy?.appliesTo.gradeIds?.length) {
      setGradeIds(selectedPolicy.appliesTo.gradeIds);
    }
  }, [selectedPolicy?.id]);

  function scopeLabel(gradeIdsForPolicy?: string[]) {
    if (!gradeIdsForPolicy?.length) return "All grades";
    return gradeIdsForPolicy
      .map((id) => gradeNameById.get(id) ?? "Unknown grade")
      .join(", ");
  }

  const handleRun = async () => {
    if (!sourcePeriodId) return;
    try {
      const res = await busy.promise(
        preview.mutateAsync({
          sourceAcademicPeriodId: sourcePeriodId,
          targetAcademicPeriodId: targetPeriodId || undefined,
          policyId: policyId || undefined,
          scope: gradeIds.length > 0 ? { gradeIds } : undefined,
        }),
        {
          loading: "Running preview...",
          success: "Preview completed",
          error: (e: Error) => e.message,
        }
      );
      if (res?.data) {
        setLastResult({
          cycleId: res.data.cycleId,
          totals: res.data.totals,
        });
        refetchCycles();
      }
    } catch {
      // Error handled
    }
  };

  const noPolicy = activePolicies.length === 0;
  const needsPolicySelection = activePolicies.length > 1 && !policyId;

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Run preview</h2>
        <p className="mt-1 text-sm text-white/50">
          Evaluate students for promotion. No changes are made — this is read-only.
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <Eye className="h-4 w-4" />
          Configure & run
        </h3>
        <p className="mb-4 text-sm text-white/60">
          Evaluate students for promotion. This is read-only — no placement changes are made.
        </p>

        {noPolicy && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No active policy. Preview will use fallback (attendance % from Settings, pass threshold
            from Grading Scale) if configured.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/70">Source period</Label>
            <PremiumSelect value={sourcePeriodId} onValueChange={setSourcePeriodId}>
              <PremiumSelectTrigger className="h-9 w-full rounded-xl">
                <PremiumSelectValue placeholder="Select period" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {periods.map((p) => (
                  <PremiumSelectItem key={String(p._id)} value={String(p._id)}>
                    {p.yearLabel} • {p.term}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Target period (optional)</Label>
            <PremiumSelect
              value={targetPeriodId || "__none__"}
              onValueChange={(v) => setTargetPeriodId(v === "__none__" ? "" : v)}
            >
              <PremiumSelectTrigger className="h-9 w-full rounded-xl">
                <PremiumSelectValue placeholder="None" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="__none__">None</PremiumSelectItem>
                {periods.map((p) => (
                  <PremiumSelectItem key={String(p._id)} value={String(p._id)}>
                    {p.yearLabel} • {p.term}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-white/70">Policy to use</Label>
            <PremiumSelect
              value={policyId || "__fallback__"}
              onValueChange={(v) => setPolicyId(v === "__fallback__" ? "" : v)}
            >
              <PremiumSelectTrigger className="h-9 w-full rounded-xl">
                <PremiumSelectValue placeholder="Select policy" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {activePolicies.length === 0 ? (
                  <PremiumSelectItem value="__fallback__">Use fallback settings</PremiumSelectItem>
                ) : null}
                {activePolicies.map((policy) => (
                  <PremiumSelectItem key={policy.id} value={policy.id}>
                    {policy.name} • {scopeLabel(policy.appliesTo.gradeIds)}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            {activePolicies.length > 1 ? (
              <p className="text-xs text-white/40">
                Multiple active policies exist. Select the JHS, primary, preschool, or whole-school
                policy you want this preview cycle to use.
              </p>
            ) : null}
          </div>
        </div>

        {grades.length > 0 && (
          <div className="mt-4 space-y-2">
            <Label className="text-white/70">Scope: grades (optional; empty = all)</Label>
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
          onClick={handleRun}
          disabled={preview.isPending || !sourcePeriodId || needsPolicySelection}
          className="mt-4 gap-2"
        >
          {preview.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          Run Preview
        </Button>
      </div>

      {lastResult && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <h4 className="mb-4 font-semibold text-emerald-200">Preview results</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-white/50">Evaluated</p>
              <p className="text-xl font-semibold text-white">{lastResult.totals.studentsEvaluated}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Promote</p>
              <p className="text-xl font-semibold text-emerald-300">{lastResult.totals.promote}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Repeat</p>
              <p className="text-xl font-semibold text-amber-300">{lastResult.totals.repeat}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Graduate</p>
              <p className="text-xl font-semibold text-purple-300">{lastResult.totals.graduate}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Hold</p>
              <p className="text-xl font-semibold text-white/70">{lastResult.totals.hold}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/60">
            Cycle ID: <code className="rounded bg-white/10 px-1">{lastResult.cycleId}</code>
          </p>
        </div>
      )}
    </div>
  );
}
