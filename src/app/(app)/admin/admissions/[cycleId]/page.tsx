"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useAdmissionCycle,
  useDeleteAdmissionCycle,
  type AdmissionCycleDTO,
} from "@/hooks/admissions/useAdmissionCycles";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { EditCycleModal } from "@/components/admissions/EditCycleModal";
import { CycleWorkspace } from "@/components/admissions/cycle/CycleWorkspace";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-white/10 bg-white/5 text-white/70",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  paused: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  closed: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  archived: "border-white/10 bg-white/5 text-white/50",
};

type Params = Promise<{ cycleId: string }>;

function isEmptyDraft(cycle: AdmissionCycleDTO) {
  return (
    cycle.status === "draft" &&
    (cycle.analytics?.totalSubmissions ?? 0) === 0
  );
}

export default function AdminAdmissionCyclePage({
  params,
}: {
  params: Params;
}) {
  const { cycleId } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const admissionsListHref = pathname.startsWith("/teacher")
    ? "/teacher/admissions"
    : "/admin/admissions";
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data, isLoading, error } = useAdmissionCycle(cycleId);
  const cycle = data?.data;
  const deleteCycle = useDeleteAdmissionCycle();
  const [editOpen, setEditOpen] = React.useState(false);

  const handleRemove = React.useCallback(async () => {
    if (!cycle) return;
    if (cycle.status === "archived") return;
    const empty = isEmptyDraft(cycle);
    const ok = await confirm({
      title: empty ? "Delete this cycle?" : "Remove this cycle?",
      description: empty
        ? "This draft has no applications yet. It will be permanently removed."
        : "This cycle will be archived. Applications and history are kept, but the cycle is marked archived.",
      confirmLabel: empty ? "Delete" : "Archive",
      intent: "destructive",
    });
    if (ok !== "confirm") return;
    try {
      const result = await busy.promise(
        deleteCycle.mutateAsync({ cycleId: cycle.id }),
        {
          loading: "Removing cycle…",
          success: empty ? "Cycle deleted." : "Cycle archived.",
          error: (e: Error) => e.message,
        }
      );
      if (result.action === "deleted") {
        router.push(admissionsListHref);
      }
    } catch {
      /* toast */
    }
  }, [admissionsListHref, busy, confirm, cycle, deleteCycle, router]);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link
          href={pathname.startsWith("/teacher") ? "/teacher/admissions" : "/admin/admissions"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/55 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to admissions
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-8 text-sm text-white/55">
          Loading cycle…
        </div>
      ) : error || !cycle ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
          {error instanceof Error ? error.message : "Cycle not found"}
        </div>
      ) : (
        <>
          <section className="rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold text-white">
                    {cycle.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className={
                      STATUS_STYLES[cycle.status] ??
                      "border-white/10 bg-white/5 text-white/70"
                    }
                  >
                    {cycle.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-white/55">
                  Cycle slug{" "}
                  <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] text-white/85">
                    {cycle.slug}
                  </code>
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {cycle.status === "published" ? (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/apply/${cycle.schoolId}/${cycle.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open public form
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : null}
                {cycle.status !== "archived" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/10 bg-white/3 text-white hover:bg-white/8"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-rose-500/25 bg-rose-500/5 text-rose-100 hover:bg-rose-500/10"
                      onClick={() => void handleRemove()}
                      disabled={deleteCycle.isPending}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      {isEmptyDraft(cycle) ? "Delete" : "Remove"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <EditCycleModal
            open={editOpen}
            onOpenChange={setEditOpen}
            cycle={cycle}
            onUpdated={() => setEditOpen(false)}
          />

          <CycleWorkspace cycle={cycle} />
        </>
      )}
      {confirmationDialog}
    </div>
  );
}
