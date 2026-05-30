"use client";

import * as React from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { ExamConflictDTO } from "@/types/academics/exam-scheduling-engine";
import { formatExamConflictType } from "@/components/admin/exams/exam-conflict-labels";
import { useOverrideExamConflict } from "@/hooks/admin/useExamConflicts";
import { useBusyToast } from "@/hooks/useBusyToast";

type ExamConflictOverrideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  conflict: ExamConflictDTO | null;
  requireReason: boolean;
  onCompleted: () => void;
};

export function ExamConflictOverrideModal({
  open,
  onOpenChange,
  sessionId,
  conflict,
  requireReason,
  onCompleted,
}: ExamConflictOverrideModalProps) {
  const busy = useBusyToast();
  const overrideConflict = useOverrideExamConflict(sessionId);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setReason("");
  }, [open, conflict?.key]);

  async function handleSubmit() {
    if (!conflict) return;
    if (requireReason && !reason.trim()) {
      busy.error("An override reason is required.");
      return;
    }

    await busy.promise(
      overrideConflict.mutateAsync({
        conflictKey: conflict.key,
        reason: reason.trim() ? reason.trim() : null,
      }),
      {
        loading: "Saving override…",
        success: "Conflict overridden",
        error: (error) =>
          error instanceof Error ? error.message : "Could not override conflict",
      }
    );

    onOpenChange(false);
    onCompleted();
  }

  if (!conflict) return null;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Override conflict"
      description="Record why this issue is accepted for publish readiness."
    >
      <div className="space-y-4">
        <div className={cn(glassInsetClass, "space-y-2 p-4")}>
          <p className="text-sm font-medium text-white">
            {formatExamConflictType(conflict.type)}
          </p>
          <p className="text-sm text-white/70">{conflict.message}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">
            Override reason{requireReason ? " (required)" : " (optional)"}
          </Label>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this conflict is acceptable for this exam session."
            className="min-h-[120px] border-white/10 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => onOpenChange(false)}
          disabled={overrideConflict.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={glassPrimaryButtonClass}
          onClick={() => void handleSubmit()}
          disabled={overrideConflict.isPending}
        >
          {overrideConflict.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Confirm override
            </>
          )}
        </Button>
      </div>
    </ResponsiveModal>
  );
}
