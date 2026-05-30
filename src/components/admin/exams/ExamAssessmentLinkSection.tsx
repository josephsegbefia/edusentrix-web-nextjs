"use client";

import * as React from "react";
import { Link2, Loader2, Plus, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import {
  useCreateLinkedAssessmentItems,
  useExamAssessmentLinkStatus,
  useUnlinkExamAssessmentItem,
} from "@/hooks/admin/useExamAssessmentLink";
import type {
  ExamAssessmentLinkStatusDTO,
  ExamSessionDTO,
  ExamTimetableEntryDTO,
} from "@/types/academics/exam-scheduling-engine";
import { ExamAssessmentLinkExistingModal } from "@/components/admin/exams/ExamAssessmentLinkExistingModal";

const STATUS_BADGE_STYLES = {
  linked: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  missing: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  not_required: "border-white/10 bg-white/5 text-white/55",
} as const;

const ROW_STATUS_LABELS = {
  linked: "Linked",
  missing: "Missing",
  not_required: "Not required",
} as const;

type ExamAssessmentLinkSectionProps = {
  session: ExamSessionDTO;
  entry: ExamTimetableEntryDTO;
  canMutate: boolean;
  classGroupLabels: Record<string, string>;
};

function resolveOverallBadge(status: ExamAssessmentLinkStatusDTO | undefined) {
  if (!status) return { label: "Loading…", tone: STATUS_BADGE_STYLES.not_required };
  if (!status.required) {
    return { label: "Not required", tone: STATUS_BADGE_STYLES.not_required };
  }
  if (status.isComplete) {
    return { label: "Linked", tone: STATUS_BADGE_STYLES.linked };
  }
  return { label: "Missing", tone: STATUS_BADGE_STYLES.missing };
}

export function ExamAssessmentLinkSection({
  session,
  entry,
  canMutate,
  classGroupLabels,
}: ExamAssessmentLinkSectionProps) {
  const busy = useBusyToast();
  const confirm = useConfirmationDialog();
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [linkClassGroupId, setLinkClassGroupId] = React.useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useExamAssessmentLinkStatus(
    session.id,
    entry.id,
    true
  );
  const createLinkedItems = useCreateLinkedAssessmentItems(session.id, entry.id);
  const unlinkItem = useUnlinkExamAssessmentItem(session.id, entry.id);

  const status = data?.data;
  const overall = resolveOverallBadge(status);
  const isSaving = createLinkedItems.isPending || unlinkItem.isPending;

  const missingClassGroupIds =
    status?.classGroups
      .filter((row) => row.status === "missing")
      .map((row) => row.classGroupId) ?? [];

  async function handleCreateLinkedItems() {
    await busy.promise(createLinkedItems.mutateAsync(undefined), {
      loading: "Creating linked assessment items…",
      success: "Linked assessment items created",
      error: (error) =>
        error instanceof Error ? error.message : "Could not create assessment items",
    });
  }

  function openLinkExisting(classGroupId: string) {
    setLinkClassGroupId(classGroupId);
    setLinkModalOpen(true);
  }

  async function handleUnlink(classGroupId: string) {
    const confirmed = await confirm({
      title: "Unlink assessment item?",
      description:
        "This removes the exam link from the assessment item. Existing marks are kept in the gradebook.",
      confirmLabel: "Unlink",
      destructive: true,
    });
    if (!confirmed) return;

    await busy.promise(unlinkItem.mutateAsync({ classGroupId }), {
      loading: "Unlinking assessment item…",
      success: "Assessment item unlinked",
      error: (error) =>
        error instanceof Error ? error.message : "Could not unlink assessment item",
    });
  }

  return (
    <>
      <div className={cn(glassInsetClass, "space-y-4 p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-white">Assessment link</h3>
              <Badge variant="outline" className={overall.tone}>
                {overall.label}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Report-contributing exam papers need a linked assessment item in the gradebook
              before marks can flow to report cards. One item is created per class group.
            </p>
          </div>
          {(isLoading || isFetching) && !status ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/45" />
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-white/45">Component</p>
            <p className="mt-1 text-sm text-white">
              {entry.assessmentComponentKey ?? status?.assessmentComponentKey ?? "exam"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-white/45">Max score</p>
            <p className="mt-1 text-sm text-white">
              {entry.maxScore ?? status?.maxScore ?? "Policy default"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-white/45">Report contribution</p>
          <p className="mt-1 text-sm text-white/80">
            {entry.contributesToReport
              ? "This paper contributes to the official report card. Linked assessment items must also contribute to the report."
              : "This paper does not contribute to the report card, so an assessment link is optional."}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading assessment link status…
          </div>
        ) : status ? (
          <div className="space-y-3">
            <Label>Class group links</Label>
            <div className="space-y-2">
              {status.classGroups.map((row) => (
                <div
                  key={row.classGroupId}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {row.classGroupName ??
                          classGroupLabels[row.classGroupId] ??
                          row.classGroupId}
                      </p>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_STYLES[row.status]}
                      >
                        {ROW_STATUS_LABELS[row.status]}
                      </Badge>
                    </div>
                    {row.linkedAssessmentItemId ? (
                      <p className="mt-1 text-xs text-white/50">
                        Item ID: {row.linkedAssessmentItemId}
                      </p>
                    ) : null}
                    {row.validationErrors[0] ? (
                      <p className="mt-1 text-xs text-amber-100/90">{row.validationErrors[0]}</p>
                    ) : null}
                  </div>

                  {canMutate && row.status === "linked" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={glassSecondaryButtonClass}
                      disabled={isSaving}
                      onClick={() => void handleUnlink(row.classGroupId)}
                    >
                      <Unlink className="mr-2 h-3.5 w-3.5" />
                      Unlink
                    </Button>
                  ) : null}

                  {canMutate && row.status === "missing" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={glassSecondaryButtonClass}
                      disabled={isSaving}
                      onClick={() => openLinkExisting(row.classGroupId)}
                    >
                      <Link2 className="mr-2 h-3.5 w-3.5" />
                      Link existing
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            {status.validationErrors.length > 0 ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {status.validationErrors[0]}
              </div>
            ) : null}
          </div>
        ) : null}

        {canMutate && entry.contributesToReport && missingClassGroupIds.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              disabled={isSaving}
              onClick={() => void handleCreateLinkedItems()}
            >
              {createLinkedItems.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create linked assessment items
                </>
              )}
            </Button>
            {missingClassGroupIds.length === 1 ? (
              <Button
                type="button"
                variant="outline"
                className={glassSecondaryButtonClass}
                disabled={isSaving}
                onClick={() => openLinkExisting(missingClassGroupIds[0]!)}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Link existing
              </Button>
            ) : null}
          </div>
        ) : null}

        {!canMutate ? (
          <p className="text-sm text-white/45">
            Assessment links cannot be changed while this session is published or locked.
          </p>
        ) : null}
      </div>

      {linkClassGroupId ? (
        <ExamAssessmentLinkExistingModal
          open={linkModalOpen}
          onOpenChange={(open) => {
            setLinkModalOpen(open);
            if (!open) setLinkClassGroupId(null);
          }}
          session={session}
          entry={entry}
          classGroupId={linkClassGroupId}
          classGroupLabel={
            classGroupLabels[linkClassGroupId] ?? linkClassGroupId
          }
          onLinked={() => void refetch()}
        />
      ) : null}
    </>
  );
}

export function getExamAssessmentLinkBadge(entry: ExamTimetableEntryDTO) {
  if (!entry.contributesToReport) {
    return { label: "Not required", tone: STATUS_BADGE_STYLES.not_required };
  }
  if (entry.assessmentItemId) {
    return { label: "Linked", tone: STATUS_BADGE_STYLES.linked };
  }
  return { label: "Missing", tone: STATUS_BADGE_STYLES.missing };
}
