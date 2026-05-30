"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Rocket } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { formatPublishReadinessIssueType } from "@/components/admin/exams/exam-conflict-labels";
import {
  useExamPublishReadiness,
  usePublishExamTimetable,
} from "@/hooks/admin/useExamPublish";
import { ExamSchedulingLeoPanel } from "@/components/admin/exams/ExamSchedulingLeoPanel";
import { useBusyToast } from "@/hooks/useBusyToast";
import type { ExamSessionDTO } from "@/types/academics/exam-scheduling-engine";

type ExamPublishModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ExamSessionDTO;
  onPublished?: () => void;
};

export function ExamPublishModal({
  open,
  onOpenChange,
  session,
  onPublished,
}: ExamPublishModalProps) {
  const busy = useBusyToast();
  const [changeSummary, setChangeSummary] = React.useState("");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = React.useState(false);
  const [syncToCalendar, setSyncToCalendar] = React.useState(true);

  const { data, isLoading } = useExamPublishReadiness(
    session.id,
    open
  );
  const publishTimetable = usePublishExamTimetable(session.id);

  const readiness = data?.data;
  const isRepublish = Boolean(readiness?.currentVersionNumber);
  const hasWarnings = (readiness?.warnings.length ?? 0) > 0;
  const canSubmit =
    Boolean(readiness?.canPublish) &&
    changeSummary.trim().length > 0 &&
    (!hasWarnings || acknowledgeWarnings) &&
    !publishTimetable.isPending;

  React.useEffect(() => {
    if (!open) return;
    setChangeSummary("");
    setAcknowledgeWarnings(false);
    setSyncToCalendar(true);
  }, [open, session.id]);

  async function handlePublish() {
    if (!changeSummary.trim()) {
      busy.error("Add a change summary before publishing.");
      return;
    }
    if (hasWarnings && !acknowledgeWarnings) {
      busy.error("Confirm that you have reviewed the warnings.");
      return;
    }
    if (!readiness?.canPublish) {
      busy.error("Resolve blocking issues before publishing.");
      return;
    }

    await busy.promise(
      publishTimetable.mutateAsync({
        changeSummary: changeSummary.trim(),
        syncToCalendar,
      }),
      {
        loading: isRepublish ? "Republishing timetable…" : "Publishing timetable…",
        success: isRepublish ? "Exam timetable republished" : "Exam timetable published",
        error: (error) =>
          error instanceof Error ? error.message : "Could not publish exam timetable",
      }
    );

    onOpenChange(false);
    onPublished?.();
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isRepublish ? "Republish exam timetable" : "Publish exam timetable"}
      description="Review readiness, summarize what changed, and confirm before parents and teachers see the published timetable."
    >
      <div className="space-y-4">
        {(isLoading) && !readiness ? (
          <div className="flex items-center gap-2 py-8 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking publish readiness…
          </div>
        ) : readiness ? (
          <>
            <div className={cn(glassInsetClass, "grid gap-3 p-4 sm:grid-cols-2")}>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/45">Readiness score</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {readiness.summary.readinessScore}%
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/45">Exam papers</p>
                <p className="mt-1 text-sm text-white/80">
                  {readiness.summary.entryCount} total · {readiness.summary.scheduledEntryCount}{" "}
                  scheduled
                </p>
              </div>
              <div className="sm:col-span-2">
                <Badge
                  variant="outline"
                  className={
                    readiness.canPublish
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-100"
                  }
                >
                  {readiness.canPublish ? "Ready to publish" : "Blocked"}
                </Badge>
              </div>
            </div>

            {readiness.blockingIssues.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-rose-100">Blocking issues</Label>
                <div className="space-y-2">
                  {readiness.blockingIssues.slice(0, 6).map((issue) => (
                    <div
                      key={issue.key}
                      className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-rose-50">
                        {formatPublishReadinessIssueType(issue.type)}
                      </p>
                      <p className="mt-1 text-sm text-rose-100/90">{issue.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {readiness.warnings.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-amber-100">Warnings</Label>
                <div className="space-y-2">
                  {readiness.warnings.slice(0, 4).map((issue) => (
                    <div
                      key={issue.key}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2"
                    >
                      <p className="text-sm text-amber-50">{issue.message}</p>
                    </div>
                  ))}
                </div>
                <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acknowledgeWarnings}
                    onChange={(event) => setAcknowledgeWarnings(event.target.checked)}
                  />
                  <span>I have reviewed the warnings and still want to publish.</span>
                </label>
              </div>
            ) : null}

            {readiness.assessmentLinks.missing.length > 0 ? (
              <div className={cn(glassInsetClass, "p-3 text-sm text-amber-100")}>
                {readiness.summary.missingAssessmentLinkCount} report-contributing paper(s) still
                need assessment links.
              </div>
            ) : null}
          </>
        ) : null}

        <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
          <input
            type="checkbox"
            className="mt-1"
            checked={syncToCalendar}
            onChange={(event) => setSyncToCalendar(event.target.checked)}
          />
          <span>
            Add published exams to the school calendar for classes, teachers, and (when enabled)
            parents and students.
          </span>
        </label>

        {readiness?.canPublish ? (
          <ExamSchedulingLeoPanel sessionId={session.id} mode="parent-message" />
        ) : null}

        <div className="space-y-2">
          <Label className="text-white/70">Change summary (required)</Label>
          <Textarea
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
            placeholder={
              isRepublish
                ? "Describe what changed in this republish, e.g. moved Basic 6 Mathematics to Tuesday."
                : "Describe this publish, e.g. Initial end-of-term exam timetable."
            }
            className="min-h-[120px] border-white/10 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>

        {!readiness?.canPublish ? (
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              Publishing is blocked until all required issues are resolved. Use conflict review and
              assessment linking tools first.
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => onOpenChange(false)}
          disabled={publishTimetable.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={glassPrimaryButtonClass}
          disabled={!canSubmit}
          onClick={() => void handlePublish()}
        >
          {publishTimetable.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Publishing…
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              {isRepublish ? "Republish timetable" : "Publish timetable"}
            </>
          )}
        </Button>
      </div>
    </ResponsiveModal>
  );
}
