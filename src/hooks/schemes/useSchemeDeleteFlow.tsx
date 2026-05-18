"use client";

import * as React from "react";
import { SchemeDeleteLinkedNotesDialog } from "@/components/schemes/SchemeDeleteLinkedNotesDialog";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useBusyToast } from "@/hooks/useBusyToast";
import { deleteSchemeRequest } from "@/lib/schemes/delete-scheme-client";
import { isSchemeLinkedLessonNotesError } from "@/lib/schemes/scheme-delete-errors";

export type SchemeDeleteTarget = {
  id: string;
  title: string;
};

type LinkedNotesPrompt = SchemeDeleteTarget & {
  linkedLessonNoteCount: number;
};

export function useSchemeDeleteFlow(options: {
  apiBasePath: "/api/admin/schemes" | "/api/teacher/schemes";
  onDeleted?: (schemeId: string) => void;
}) {
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [linkedPrompt, setLinkedPrompt] = React.useState<LinkedNotesPrompt | null>(null);
  const [unlinkBusy, setUnlinkBusy] = React.useState(false);

  const runDelete = React.useCallback(
    async (target: SchemeDeleteTarget, unlinkLessonNotes: boolean) => {
      await deleteSchemeRequest(options.apiBasePath, target.id, unlinkLessonNotes);
      options.onDeleted?.(target.id);
    },
    [options],
  );

  const requestDelete = React.useCallback(
    async (target: SchemeDeleteTarget) => {
      const result = await confirm({
        title: "Delete scheme",
        description: `Permanently delete “${target.title}”? All weekly rows and review history for this Scheme of Learning will be removed. This cannot be undone.`,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        intent: "destructive",
      });
      if (result !== "confirm") return;

      busyToast.show("Deleting scheme…");
      try {
        await runDelete(target, false);
        busyToast.hide();
        busyToast.success("Scheme deleted");
      } catch (err) {
        busyToast.hide();
        if (isSchemeLinkedLessonNotesError(err)) {
          setLinkedPrompt({
            ...target,
            linkedLessonNoteCount: err.linkedLessonNoteCount ?? 1,
          });
          return;
        }
        busyToast.error(err instanceof Error ? err.message : "Could not delete scheme");
      }
    },
    [busyToast, confirm, runDelete],
  );

  const confirmUnlinkAndDelete = React.useCallback(async () => {
    if (!linkedPrompt) return;
    setUnlinkBusy(true);
    try {
      await busyToast.promise(runDelete(linkedPrompt, true), {
        loading: "Unlinking lesson notes…",
        success: "Scheme deleted",
        error: (error) =>
          error instanceof Error ? error.message : "Could not delete scheme",
      });
      setLinkedPrompt(null);
    } catch {
      // toast handled by busyToast.promise
    } finally {
      setUnlinkBusy(false);
    }
  }, [busyToast, linkedPrompt, runDelete]);

  const linkedNotesDialog = linkedPrompt ? (
    <SchemeDeleteLinkedNotesDialog
      open={Boolean(linkedPrompt)}
      onOpenChange={(open) => {
        if (!open && !unlinkBusy) setLinkedPrompt(null);
      }}
      schemeTitle={linkedPrompt.title}
      linkedLessonNoteCount={linkedPrompt.linkedLessonNoteCount}
      busy={unlinkBusy}
      onCancel={() => setLinkedPrompt(null)}
      onUnlinkAndDelete={() => void confirmUnlinkAndDelete()}
    />
  ) : null;

  return {
    requestDelete,
    confirmationDialog,
    linkedNotesDialog,
  };
}
