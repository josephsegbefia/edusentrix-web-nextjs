"use client";

import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { useSubjectResultPreview, useSubmitSubjectResults } from "@/hooks/teacher/useSubjectResults";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { SUBJECT_RESULT_STATUS_LABELS } from "@/constants/academics/assessment-engine";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { TeacherGradebookV2DTO } from "@/types/academics/assessment-engine";

type SubmitTabProps = {
  gradebook: TeacherGradebookV2DTO;
  classGroupId: string;
  subjectId: string;
  academicPeriodId?: string | null;
  canPublish: boolean;
  enabled?: boolean;
  onSubmitted?: () => void;
};

export function SubmitTab({
  gradebook,
  classGroupId,
  subjectId,
  academicPeriodId,
  canPublish,
  enabled = true,
  onSubmitted,
}: SubmitTabProps) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const submitResults = useSubmitSubjectResults();
  const { data: previewData } = useSubjectResultPreview(
    classGroupId,
    subjectId,
    academicPeriodId,
    enabled
  );

  const preview = previewData?.data;
  const readiness = preview?.readiness ?? gradebook.readiness;
  const lockedCount = preview?.summary.lockedStudents ?? 0;
  const blockedCount = preview?.summary.blockedStudents ?? 0;
  const alreadySubmitted =
    lockedCount > 0 ||
    gradebook.students.some(
      (student) =>
        student.subjectResultStatus === "submitted" ||
        student.subjectResultStatus === "approved" ||
        student.subjectResultStatus === "locked"
    );

  const canSubmitNow =
    canPublish &&
    readiness.canSubmit &&
    blockedCount === 0 &&
    lockedCount === 0 &&
    !alreadySubmitted &&
    !submitResults.isPending;

  async function handleSubmit() {
    const result = await confirm({
      title: "Submit subject results?",
      description:
        "This will lock calculated subject results for all students in this class and subject until an admin returns them.",
      confirmLabel: "Submit results",
      intent: "default",
    });
    if (result !== "confirm") return;

    try {
      const summary = await busy.promise(
        submitResults.mutateAsync({
          classGroupId,
          subjectId,
          academicPeriodId,
        }),
        {
          loading: "Submitting subject results…",
          success: (data) =>
            `Submitted ${data.submittedCount} subject result${data.submittedCount === 1 ? "" : "s"}.`,
          error: (error) =>
            error instanceof Error ? error.message : "Failed to submit subject results",
        }
      );
      if (summary.submittedCount > 0) {
        onSubmitted?.();
      }
    } catch {
      // Toast handled by busy.promise
    }
  }

  return (
    <div className="space-y-4">
      {confirmationDialog}

      <GlassPanel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Submission readiness</h3>
            <p className="mt-1 text-sm text-white/55">
              Submit only when mark entry and report contribution rules are complete.
            </p>
          </div>
          {alreadySubmitted ? (
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-100">
              {SUBJECT_RESULT_STATUS_LABELS.submitted}
            </Badge>
          ) : readiness.canSubmit ? (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-100">
              Ready to submit
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/30 text-amber-100">
              Not ready
            </Badge>
          )}
        </div>

        <ul className="mt-4 space-y-2">
          {readiness.checklist.map((item) => (
            <li
              key={item.key}
              className={cn(
                glassInsetClass,
                "flex items-center justify-between px-3 py-2 text-sm text-white/75"
              )}
            >
              <span>{item.label}</span>
              {item.complete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              )}
            </li>
          ))}
        </ul>

        {readiness.issues.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm text-amber-200">
            {readiness.issues.map((issue) => (
              <li key={issue.code}>{issue.message}</li>
            ))}
          </ul>
        ) : null}

        {blockedCount > 0 ? (
          <p className="mt-4 text-sm text-amber-200">
            {blockedCount} student(s) still have blocking calculation issues. Resolve them in Mark
            Entry or Report Contribution before submitting.
          </p>
        ) : null}

        {lockedCount > 0 ? (
          <p className="mt-4 text-sm text-cyan-100/90">
            {lockedCount} subject result(s) are already submitted or locked for this class.
          </p>
        ) : null}

        {!canPublish ? (
          <p className="mt-4 text-sm text-white/50">
            You do not have permission to submit subject results.
          </p>
        ) : null}

        <Button
          type="button"
          disabled={!canSubmitNow}
          className={cn("mt-5", glassPrimaryButtonClass)}
          onClick={() => void handleSubmit()}
        >
          {submitResults.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Submit subject results
        </Button>

        {alreadySubmitted ? (
          <p className="mt-2 text-xs text-white/45">
            Submitted results stay locked until a school admin returns them for correction.
          </p>
        ) : null}
      </GlassPanel>
    </div>
  );
}
