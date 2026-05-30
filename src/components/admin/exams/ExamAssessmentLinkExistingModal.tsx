"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useExamAssessmentLinkCandidates,
  useLinkExistingAssessmentItem,
} from "@/hooks/admin/useExamAssessmentLink";
import type { ExamSessionDTO, ExamTimetableEntryDTO } from "@/types/academics/exam-scheduling-engine";

type ExamAssessmentLinkExistingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ExamSessionDTO;
  entry: ExamTimetableEntryDTO;
  classGroupId: string;
  classGroupLabel: string;
  onLinked?: () => void;
};

export function ExamAssessmentLinkExistingModal({
  open,
  onOpenChange,
  session,
  entry,
  classGroupId,
  classGroupLabel,
  onLinked,
}: ExamAssessmentLinkExistingModalProps) {
  const busy = useBusyToast();
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);

  const { data, isLoading } = useExamAssessmentLinkCandidates(
    session.id,
    entry.id,
    classGroupId,
    open
  );
  const linkExisting = useLinkExistingAssessmentItem(session.id, entry.id);

  const candidates = data?.data ?? [];
  const eligibleCandidates = candidates.filter(
    (item) => item.isEligible && !item.isLinkedToEntry
  );

  React.useEffect(() => {
    if (!open) {
      setSelectedItemId(null);
    }
  }, [open]);

  async function handleLink() {
    if (!selectedItemId) {
      busy.error("Select an assessment item to link.");
      return;
    }

    await busy.promise(
      linkExisting.mutateAsync({
        assessmentItemId: selectedItemId,
        classGroupId,
      }),
      {
        loading: "Linking assessment item…",
        success: "Assessment item linked",
        error: (error) =>
          error instanceof Error ? error.message : "Could not link assessment item",
      }
    );

    onOpenChange(false);
    onLinked?.();
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Link existing assessment item"
      description={`Choose an assessment item for ${classGroupLabel}. It must match the exam subject, period, component, and max score.`}
    >
      <div className={cn(glassInsetClass, "space-y-3 p-4")}>
        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading assessment items…
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-6 text-sm text-white/60">
            No assessment items were found for this class, subject, and term.
          </p>
        ) : (
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {candidates.map((item) => {
              const selected = selectedItemId === item.id;
              const disabled = !item.isEligible || item.isLinkedToEntry;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedItemId(item.id)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                    selected
                      ? "border-cyan-500/40 bg-cyan-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-white/50">
                        {item.assessmentType} · Max {item.maxScore}
                        {item.componentKey ? ` · ${item.componentKey}` : ""}
                      </p>
                      {item.ineligibilityReason ? (
                        <p className="mt-1 text-xs text-amber-100/90">
                          {item.ineligibilityReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.isLinkedToEntry ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        >
                          Linked
                        </Badge>
                      ) : null}
                      {selected ? <Check className="h-4 w-4 text-cyan-200" /> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && candidates.length > 0 && eligibleCandidates.length === 0 ? (
          <p className="text-sm text-amber-100/90">
            No eligible items match this exam entry. Adjust component, max score, or create a
            linked item instead.
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => onOpenChange(false)}
          disabled={linkExisting.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={glassPrimaryButtonClass}
          disabled={!selectedItemId || linkExisting.isPending}
          onClick={() => void handleLink()}
        >
          {linkExisting.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Linking…
            </>
          ) : (
            "Link selected item"
          )}
        </Button>
      </div>
    </ResponsiveModal>
  );
}
