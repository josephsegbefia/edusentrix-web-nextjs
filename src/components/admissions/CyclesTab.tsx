"use client";

import * as React from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Globe2,
  Pencil,
  Pause,
  PlayCircle,
  Plus,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import {
  type AdmissionCycleDTO,
  useCloseAdmissionCycle,
  useDeleteAdmissionCycle,
  usePauseAdmissionCycle,
  usePublishAdmissionCycle,
} from "@/hooks/admissions/useAdmissionCycles";
import { EditCycleModal } from "./EditCycleModal";

type CyclesTabProps = {
  cycles: AdmissionCycleDTO[];
  isLoading: boolean;
  isAdmin: boolean;
  onCreate: () => void;
  onOpenCycle: (cycle: AdmissionCycleDTO) => void;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-white/10 bg-white/5 text-white/70",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  paused: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  closed: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  archived: "border-white/10 bg-white/5 text-white/50",
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function publicCycleUrl(schoolId: string, slug: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/apply/${schoolId}/${slug}`;
}

/** Draft with no submissions — API will hard-delete. Otherwise the cycle is archived. */
function isEmptyDraft(cycle: AdmissionCycleDTO) {
  return (
    cycle.status === "draft" &&
    (cycle.analytics?.totalSubmissions ?? 0) === 0
  );
}

export function CyclesTab({
  cycles,
  isLoading,
  isAdmin,
  onCreate,
  onOpenCycle,
}: CyclesTabProps) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const publishCycle = usePublishAdmissionCycle();
  const pauseCycle = usePauseAdmissionCycle();
  const closeCycle = useCloseAdmissionCycle();
  const deleteCycle = useDeleteAdmissionCycle();

  const [copiedCycleId, setCopiedCycleId] = React.useState<string | null>(null);
  const [editingCycle, setEditingCycle] =
    React.useState<AdmissionCycleDTO | null>(null);

  const handleEdit = React.useCallback((cycle: AdmissionCycleDTO) => {
    setEditingCycle(cycle);
  }, []);

  const handleCopyLink = React.useCallback(
    async (cycle: AdmissionCycleDTO) => {
      const url = publicCycleUrl(cycle.schoolId, cycle.slug);
      try {
        await navigator.clipboard.writeText(url);
        setCopiedCycleId(cycle.id);
        window.setTimeout(() => setCopiedCycleId((prev) => (prev === cycle.id ? null : prev)), 2000);
      } catch {
        // Clipboard write may fail on insecure origins; ignore silently.
      }
    },
    []
  );

  const handlePublish = React.useCallback(
    async (cycle: AdmissionCycleDTO) => {
      try {
        await busy.promise(publishCycle.mutateAsync({ cycleId: cycle.id }), {
          loading: "Publishing cycle...",
          success: "Cycle published. Families can apply now.",
          error: (e: Error) => e.message,
        });
      } catch {
        /* handled by toast */
      }
    },
    [busy, publishCycle]
  );

  const handlePause = React.useCallback(
    async (cycle: AdmissionCycleDTO) => {
      const ok = await confirm({
        title: "Pause this cycle?",
        description:
          "New applications will be blocked, but existing applicants can still log in to see their status. You can resume any time.",
        confirmLabel: "Pause cycle",
      });
      if (ok !== "confirm") return;
      try {
        await busy.promise(pauseCycle.mutateAsync({ cycleId: cycle.id }), {
          loading: "Pausing cycle...",
          success: "Cycle paused.",
          error: (e: Error) => e.message,
        });
      } catch {
        /* handled */
      }
    },
    [busy, confirm, pauseCycle]
  );

  const handleClose = React.useCallback(
    async (cycle: AdmissionCycleDTO) => {
      const ok = await confirm({
        title: "Close this cycle?",
        description:
          "Closed cycles stop accepting applications and cannot be re-opened. You can still process pending decisions.",
        confirmLabel: "Close cycle",
        intent: "destructive",
      });
      if (ok !== "confirm") return;
      try {
        await busy.promise(closeCycle.mutateAsync({ cycleId: cycle.id }), {
          loading: "Closing cycle...",
          success: "Cycle closed.",
          error: (e: Error) => e.message,
        });
      } catch {
        /* handled */
      }
    },
    [busy, closeCycle, confirm]
  );

  const handleRemove = React.useCallback(
    async (cycle: AdmissionCycleDTO) => {
      const empty = isEmptyDraft(cycle);
      const ok = await confirm({
        title: empty ? "Delete this draft cycle?" : "Remove this cycle?",
        description: empty
          ? "This empty draft will be permanently deleted. Forms and invite links for this draft are removed."
          : "Empty drafts with no applications are deleted. Otherwise the cycle is archived: applications, decisions, and full history stay in your records, but the cycle is no longer active. Which applies depends on this cycle’s state on the server.",
        confirmLabel: empty ? "Delete" : "Remove",
        intent: "destructive",
      });
      if (ok !== "confirm") return;
      try {
        busy.show("Removing cycle…");
        const res = await deleteCycle.mutateAsync({ cycleId: cycle.id });
        const { action } = res;
        busy.hide();
        if (action === "deleted") {
          toast.success("Draft cycle permanently deleted.");
        } else {
          toast.success(
            "Cycle archived. Applications and history are preserved in your records."
          );
        }
      } catch (e) {
        busy.hide();
        toast.error(e instanceof Error ? e.message : "Failed to remove cycle");
      }
    },
    [busy, confirm, deleteCycle]
  );

  return (
    <>
      <section className="rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-6">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
              Admission cycles
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Cycles & application links
            </h3>
            <p className="mt-2 text-sm text-white/50">
              Each cycle has its own public link, form, and decision queue.
              Open one to share or to manage applications.
            </p>
          </div>
          {isAdmin ? (
            <Button onClick={onCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              New cycle
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-black/10 p-8 text-center text-sm text-white/55">
            Loading cycles...
          </div>
        ) : cycles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/10 p-10 text-center">
            <ClipboardList className="mx-auto h-9 w-9 text-white/35" />
            <p className="mt-4 text-base font-semibold text-white">
              No admission cycles yet
            </p>
            <p className="mt-2 max-w-md mx-auto text-sm text-white/55">
              {isAdmin
                ? "Open your first cycle to share the application link with prospective families. Leo will seed the standard form so you can launch in minutes."
                : "Once the school admin opens a cycle, you will see it here and can begin reviewing incoming applications."}
            </p>
            {isAdmin ? (
              <Button onClick={onCreate} className="mt-5 gap-2">
                <Plus className="h-4 w-4" />
                Open first cycle
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {cycles.map((cycle) => {
              const url = publicCycleUrl(cycle.schoolId, cycle.slug);
              const isLive = cycle.status === "published";
              const totalSubs = cycle.analytics?.totalSubmissions ?? 0;
              return (
                <article
                  key={cycle.id}
                  className="rounded-2xl border border-white/10 bg-black/10 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-white">
                          {cycle.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            STATUS_STYLES[cycle.status] ??
                              "border-white/10 bg-white/5 text-white/70"
                          )}
                        >
                          {cycle.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(cycle.acceptsApplicationsFrom)} →{" "}
                          {formatDate(cycle.acceptsApplicationsUntil)}
                        </span>
                        <span>
                          {cycle.intakeGradeIds.length} intake grade
                          {cycle.intakeGradeIds.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          {totalSubs} application{totalSubs === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isLive ? (
                    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                          Public application link
                        </p>
                        <p className="break-all text-sm text-emerald-50/90">
                          {url || "Available after publishing"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-emerald-400/30 bg-emerald-500/10 text-emerald-50 hover:bg-emerald-500/20"
                        onClick={() => handleCopyLink(cycle)}
                      >
                        {copiedCycleId === cycle.id ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy link
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={() => onOpenCycle(cycle)}
                    >
                      <Globe2 className="h-4 w-4" />
                      Open cycle
                    </Button>

                    {isAdmin && cycle.status === "draft" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/3 text-white hover:bg-white/8"
                        onClick={() => handlePublish(cycle)}
                        disabled={publishCycle.isPending}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Publish
                      </Button>
                    ) : null}

                    {isAdmin && cycle.status === "paused" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/3 text-white hover:bg-white/8"
                        onClick={() => handlePublish(cycle)}
                        disabled={publishCycle.isPending}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Resume
                      </Button>
                    ) : null}

                    {isAdmin && cycle.status === "published" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/3 text-white hover:bg-white/8"
                        onClick={() => handlePause(cycle)}
                        disabled={pauseCycle.isPending}
                      >
                        <Pause className="h-4 w-4" />
                        Pause
                      </Button>
                    ) : null}

                    {isAdmin &&
                    (cycle.status === "published" ||
                      cycle.status === "paused" ||
                      cycle.status === "draft") ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 border-rose-500/20 bg-rose-500/5 text-rose-100 hover:bg-rose-500/10"
                        onClick={() => handleClose(cycle)}
                        disabled={closeCycle.isPending}
                      >
                        <Square className="h-4 w-4" />
                        Close
                      </Button>
                    ) : null}

                    {cycle.status === "closed" ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-xs text-rose-100">
                        <XCircle className="h-3.5 w-3.5" />
                        Cycle is closed
                      </span>
                    ) : null}

                    {isAdmin && cycle.status !== "archived" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 border-white/10 bg-white/3 text-white hover:bg-white/8"
                          onClick={() => handleEdit(cycle)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 border-rose-500/20 bg-rose-500/5 text-rose-100 hover:bg-rose-500/10"
                          onClick={() => void handleRemove(cycle)}
                          disabled={deleteCycle.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isEmptyDraft(cycle) ? "Delete" : "Remove"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {confirmationDialog}
      <EditCycleModal
        open={editingCycle !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCycle(null);
        }}
        cycle={editingCycle}
        onUpdated={() => setEditingCycle(null)}
      />
    </>
  );
}
