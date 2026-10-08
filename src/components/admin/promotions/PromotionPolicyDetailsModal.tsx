"use client";
import { CheckCircle2, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PromotionPolicyDTO } from "@/hooks/admin/usePromotionPolicies";

type PromotionPolicyDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: PromotionPolicyDTO | null;
  gradeNameById: Map<string, string>;
  onDelete?: (policy: PromotionPolicyDTO) => void;
  isDeleting?: boolean;
};

export function PromotionPolicyDetailsModal({
  open,
  onOpenChange,
  policy,
  gradeNameById,
  onDelete,
  isDeleting = false,
}: PromotionPolicyDetailsModalProps) {
  if (!policy) return null;

  const scopeNames =
    policy.appliesTo.gradeIds?.map((gradeId) => gradeNameById.get(gradeId) ?? "Unknown grade") ?? [];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={policy.name}
      description="Promotion policy details"
      className="sm:max-w-3xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald)"
          >
            {policy.isActive ? "Active" : "Draft"}
          </Badge>
          <Badge
            variant="outline"
            className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)"
          >
            v{policy.version}
          </Badge>
        </div>

        <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-40)">
            Scope
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {scopeNames.length > 0 ? (
              scopeNames.map((scopeName) => (
                <Badge
                  key={scopeName}
                  variant="outline"
                  className="border-cyan-400/30 bg-cyan-500/10 text-(--ws-cyan)"
                >
                  {scopeName}
                </Badge>
              ))
            ) : (
              <Badge
                variant="outline"
                className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)"
              >
                All grades
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
            <div className="flex items-center gap-2 text-(--ws-fg)">
              <SlidersHorizontal className="h-4 w-4 text-(--ws-cyan)" />
              <p className="font-medium">Criteria</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-(--ws-fg)/72">
              {policy.criteria.map((criterion) => (
                <li key={`${criterion.key}-${criterion.operator}-${criterion.value}`} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--ws-cyan)" />
                  <span>
                    {criterion.key.replace(/_/g, " ")} {criterion.operator} {criterion.value}
                    {criterion.required ? " required" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
            <div className="flex items-center gap-2 text-(--ws-fg)">
              <ShieldCheck className="h-4 w-4 text-(--ws-cyan)" />
              <p className="font-medium">Safeguards</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-(--ws-fg)/72">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--ws-cyan)" />
                <span>
                  Excused absences{" "}
                  {policy.attendanceComputation.treatExcusedAsPresent ? "count as present" : "do not count as present"}
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--ws-cyan)" />
                <span>
                  Finance hold {policy.financeHold.enabled ? "enabled" : "disabled"}
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--ws-cyan)" />
                <span>Tie breaker: {policy.tieBreaker.replace(/_/g, " ")}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end border-t border-(--ws-line) pt-4">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-rose-500/30 bg-rose-500/10 text-(--ws-rose) hover:bg-rose-500/15"
            onClick={() => onDelete?.(policy)}
            disabled={!onDelete || isDeleting}
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete policy"}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
