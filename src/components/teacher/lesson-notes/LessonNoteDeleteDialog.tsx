"use client";

import * as React from "react";
import { AlertTriangle, FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAdminLessonNoteDelete, useAdminLessonNoteDeleteImpact } from "@/hooks/admin/useAdminLessonNoteDelete";
import { useLessonNoteDeleteImpact } from "@/hooks/teacher/useLessonNoteDeleteImpact";
import { useTeacherLessonNoteDelete } from "@/hooks/teacher/useTeacherLessonNoteDelete";
import { useBusyToast } from "@/hooks/useBusyToast";
import { STATUS_LABELS, type LessonNoteStatus } from "@/types/lesson-notes";
import { cn } from "@/lib/utils";

export type LessonNoteDeleteTarget = {
  id: string;
  topic: string;
  className?: string | null;
  subjectName?: string | null;
  teacherName?: string | null;
  weekLabel?: string | null;
  status?: LessonNoteStatus;
};

type Props = {
  target: LessonNoteDeleteTarget | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  /** School admins remove any note (including approved) from /admin/lesson-notes */
  mode?: "teacher" | "admin";
};

function statusPillClass(status: LessonNoteStatus): string {
  switch (status) {
    case "approved":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
    case "submitted":
      return "border-blue-400/30 bg-blue-500/15 text-blue-200";
    case "rejected":
      return "border-rose-400/30 bg-rose-500/15 text-rose-200";
    default:
      return "border-amber-400/30 bg-amber-500/15 text-amber-200";
  }
}

export function LessonNoteDeleteDialog({
  target,
  onOpenChange,
  onDeleted,
  mode = "teacher",
}: Props) {
  const busyToast = useBusyToast();
  const teacherDelete = useTeacherLessonNoteDelete();
  const adminDelete = useAdminLessonNoteDelete();
  const deleteMutation = mode === "admin" ? adminDelete : teacherDelete;
  const [acknowledged, setAcknowledged] = React.useState(false);

  const open = Boolean(target);
  const teacherImpact = useLessonNoteDeleteImpact(
    mode === "teacher" ? (target?.id ?? null) : null,
    open && mode === "teacher",
  );
  const adminImpact = useAdminLessonNoteDeleteImpact(
    mode === "admin" ? (target?.id ?? null) : null,
    open && mode === "admin",
  );
  const impactQuery = mode === "admin" ? adminImpact : teacherImpact;
  const { data, isLoading, isError, error, refetch } = impactQuery;

  const impact = data?.data;

  React.useEffect(() => {
    if (open) {
      setAcknowledged(false);
    }
  }, [open, target?.id]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!target || !impact?.canDelete || !acknowledged) return;

    try {
      await busyToast.promise(deleteMutation.mutateAsync(target.id), {
        loading: "Deleting lesson note…",
        success: "Lesson note deleted",
        error: (e: Error) => e.message || "Failed to delete lesson note",
      });
      onOpenChange(false);
      onDeleted?.();
    } catch {
      // toast handled
    }
  };

  const displayTopic = impact?.topic ?? target?.topic ?? "Lesson note";
  const displayStatus = impact?.status ?? target?.status;
  const contextLine = [
    target?.teacherName,
    impact?.className ?? target?.className,
    impact?.subjectName ?? target?.subjectName,
    target?.weekLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      title={mode === "admin" ? "Remove lesson note (admin)" : "Delete lesson note?"}
      description={
        mode === "admin"
          ? "School admin removal — including approved notes teachers cannot delete."
          : "Review what will be removed before you continue."
      }
      className="sm:max-w-lg"
      zIndexClass="z-[120]"
      contentZIndexClass="z-[121]"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-rose-500/25 bg-linear-to-br from-rose-950/40 via-slate-950/80 to-black p-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15">
              <FileText className="h-5 w-5 text-rose-200" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-white">{displayTopic}</p>
              {contextLine ? (
                <p className="text-xs text-white/55">{contextLine}</p>
              ) : null}
              {displayStatus ? (
                <span
                  className={cn(
                    "inline-flex rounded-lg border px-2 py-0.5 text-xs font-medium",
                    statusPillClass(displayStatus),
                  )}
                >
                  {STATUS_LABELS[displayStatus]}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking linked lessons and review data…
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100">
            {error instanceof Error ? error.message : "Could not load delete details."}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refetch()}
              className="mt-2 h-8 text-rose-100 hover:bg-rose-500/10"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {impact && !isLoading ? (
          <>
            {impact.blockReason ? (
              <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{impact.blockReason}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-white/80">This will permanently remove:</p>
                <ul className="space-y-2 text-sm text-white/60">
                  {impact.warnings.map((warning) => (
                    <li key={warning} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300/80" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {impact.canDelete ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                  className="mt-0.5 border-white/30 data-[state=checked]:border-rose-500 data-[state=checked]:bg-rose-600"
                />
                <span className="text-sm leading-relaxed text-white/70">
                  {mode === "admin"
                    ? "I confirm this school admin removal. Linked weekly plans, class sessions, and review history will be permanently deleted."
                    : "I understand this lesson note and any linked weekly plans or class sessions will be deleted and cannot be recovered."}
                </span>
              </label>
            ) : null}
          </>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={deleteMutation.isPending}
            onClick={handleClose}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          {impact?.canDelete ? (
            <Button
              type="button"
              disabled={!acknowledged || deleteMutation.isPending || isLoading}
              onClick={() => void handleDelete()}
              className="gap-2 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          ) : null}
        </div>
      </div>
    </ResponsiveModal>
  );
}
