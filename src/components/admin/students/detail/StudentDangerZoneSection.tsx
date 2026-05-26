"use client";

import * as React from "react";
import { AlertTriangle, LogOut, Power, PowerOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useUpdateStudentStatus,
  type StudentLifecycleStatus,
} from "@/hooks/admin/useStudentStatus";
import type { ConfirmationDialogIntent } from "@/components/ui/confirmation-dialog";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useBusyToast } from "@/hooks/useBusyToast";

type StudentDangerZoneSectionProps = {
  studentId: string;
  studentName: string;
  status: StudentLifecycleStatus;
};

const STATUS_LABEL: Record<StudentLifecycleStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  withdrawn: "Withdrawn",
  graduated: "Alumni (graduated)",
};

function statusPillClass(status: StudentLifecycleStatus): string {
  switch (status) {
    case "active":
      return "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
    case "inactive":
      return "border-slate-400/40 bg-slate-500/15 text-slate-200";
    case "withdrawn":
      return "border-red-400/40 bg-red-500/15 text-red-200";
    case "graduated":
      return "border-violet-400/40 bg-violet-500/15 text-violet-200";
  }
}

export function StudentDangerZoneSection({
  studentId,
  studentName,
  status,
}: StudentDangerZoneSectionProps) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const updateStatus = useUpdateStudentStatus(studentId);
  const isPending = updateStatus.isPending;

  async function changeStatus(
    next: StudentLifecycleStatus,
    options: {
      title: string;
      description: string;
      confirmLabel: string;
      intent?: ConfirmationDialogIntent;
      successMessage: string;
    },
  ) {
    const decision = await confirm({
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel,
      cancelLabel: "Cancel",
      intent: options.intent ?? "warning",
    });
    if (decision !== "confirm") return;

    try {
      await busy.promise(updateStatus.mutateAsync(next), {
        loading: "Updating student status…",
        success: options.successMessage,
        error: (e: Error) => e.message || "Could not update student status",
      });
    } catch {
      // handled by busy toast
    }
  }

  const canMarkInactive = status === "active";
  const canMarkWithdrawn = status === "active" || status === "inactive";
  const canReactivate = status === "inactive" || status === "withdrawn" || status === "graduated";

  return (
    <>
      <section
        className="relative overflow-hidden rounded-2xl border border-rose-500/25 bg-linear-to-br from-rose-950/30 via-slate-950/80 to-black p-6 shadow-2xl shadow-black/40 backdrop-blur-xl"
        aria-labelledby="student-danger-zone-heading"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-rose-400/30 to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-rose-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15">
              <ShieldAlert className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h2
                id="student-danger-zone-heading"
                className="text-lg font-semibold text-white"
              >
                Danger zone
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
                Change enrollment status only. Records are kept for fees, academics, and
                guardians — nothing is permanently deleted here.
              </p>
              <p className="mt-3 text-xs text-white/45">
                Current status:{" "}
                <span
                  className={cn(
                    "inline-flex rounded-lg border px-2 py-0.5 font-semibold",
                    statusPillClass(status),
                  )}
                >
                  {STATUS_LABEL[status]}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {canMarkInactive ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                void changeStatus("inactive", {
                  title: "Mark student inactive?",
                  description: `${studentName} will be hidden from active class lists and day-to-day pickers. Fee and academic history stay on file.`,
                  confirmLabel: "Mark inactive",
                  intent: "warning",
                  successMessage: "Student marked inactive",
                })
              }
              className="h-auto min-h-11 justify-start gap-2 rounded-xl border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-amber-100 hover:bg-amber-500/15"
            >
              <PowerOff className="h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-semibold">Mark inactive</span>
                <span className="block text-xs font-normal text-amber-100/70">
                  Pause participation; keep all records
                </span>
              </span>
            </Button>
          ) : null}

          {canMarkWithdrawn ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                void changeStatus("withdrawn", {
                  title: "Mark student as withdrawn?",
                  description: `${studentName} has left the school. History, invoices, and reports remain linked to this profile.`,
                  confirmLabel: "Mark withdrawn",
                  intent: "warning",
                  successMessage: "Student marked withdrawn",
                })
              }
              className="h-auto min-h-11 justify-start gap-2 rounded-xl border-rose-500/30 bg-rose-500/10 px-4 py-3 text-left text-rose-100 hover:bg-rose-500/15"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-semibold">Mark withdrawn</span>
                <span className="block text-xs font-normal text-rose-100/70">
                  Left school; records retained
                </span>
              </span>
            </Button>
          ) : null}

          {canReactivate ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                void changeStatus("active", {
                  title:
                    status === "graduated"
                      ? "Re-enroll alumni as active?"
                      : "Reactivate student?",
                  description:
                    status === "graduated"
                      ? `${studentName} is marked as alumni. Only reactivate if they are enrolling again as a current student.`
                      : `${studentName} will return to active student lists and pickers.`,
                  confirmLabel:
                    status === "graduated" ? "Re-enroll as active" : "Reactivate",
                  intent: status === "graduated" ? "warning" : "warning",
                  successMessage:
                    status === "graduated"
                      ? "Student re-enrolled as active"
                      : "Student reactivated",
                })
              }
              className="h-auto min-h-11 justify-start gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-emerald-100 hover:bg-emerald-500/15"
            >
              <Power className="h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-semibold">
                  {status === "graduated" ? "Re-enroll as active" : "Reactivate"}
                </span>
                <span className="block text-xs font-normal text-emerald-100/70">
                  Return to current student lists
                </span>
              </span>
            </Button>
          ) : null}
        </div>

        <div className="relative z-10 mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 text-xs text-white/50">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
          <p>
            Permanent deletion is not available. Use inactive or withdrawn, and contact
            support if a record was created by mistake.
          </p>
        </div>
      </section>
      {confirmationDialog}
    </>
  );
}
