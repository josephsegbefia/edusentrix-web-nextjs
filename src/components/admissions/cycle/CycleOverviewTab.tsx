"use client";

import * as React from "react";
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import { format } from "date-fns/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  useCloseAdmissionCycle,
  usePauseAdmissionCycle,
  usePublishAdmissionCycle,
  type AdmissionCycleDTO,
} from "@/hooks/admissions/useAdmissionCycles";
import { LeoAdmissionsGuide } from "@/components/admissions/leo/LeoAdmissionsGuide";

type Action = "publish" | "pause" | "close";

const STATUS_DOT: Record<AdmissionCycleDTO["status"], string> = {
  draft: "bg-white/30",
  published: "bg-emerald-400",
  paused: "bg-amber-400",
  closed: "bg-rose-400",
  archived: "bg-white/15",
};

function fmt(value?: string | null) {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
}

export function CycleOverviewTab({ cycle }: { cycle: AdmissionCycleDTO }) {
  const publish = usePublishAdmissionCycle();
  const pause = usePauseAdmissionCycle();
  const close = useCloseAdmissionCycle();
  const [confirm, setConfirm] = React.useState<Action | null>(null);

  const isPublishing = publish.isPending;
  const isPausing = pause.isPending;
  const isClosing = close.isPending;
  const transitioning = isPublishing || isPausing || isClosing;

  function runAction(action: Action) {
    const mutation =
      action === "publish" ? publish : action === "pause" ? pause : close;
    mutation.mutate(
      { cycleId: cycle.id },
      {
        onSuccess: () => {
          toast.success(
            action === "publish"
              ? "Cycle published"
              : action === "pause"
                ? "Cycle paused"
                : "Cycle closed"
          );
          setConfirm(null);
        },
        onError: (err) => toast.error(err.message || "Action failed"),
      }
    );
  }

  const submissions = cycle.analytics?.totalSubmissions ?? 0;
  const byStatus = cycle.analytics?.byStatus ?? {};

  return (
    <div className="space-y-5">
      <LeoAdmissionsGuide surface="overview" cycle={cycle} />

      <section className="grid gap-3 lg:grid-cols-4">
        <StatCard
          label="Status"
          value={
            <span className="flex items-center gap-2 text-base">
              <span
                className={`h-2 w-2 rounded-full ${STATUS_DOT[cycle.status]}`}
              />
              <span className="capitalize">{cycle.status}</span>
            </span>
          }
        />
        <StatCard label="Submissions" value={String(submissions)} />
        <StatCard
          label="Application window"
          value={
            <span className="text-sm">
              {fmt(cycle.acceptsApplicationsFrom)} →{" "}
              {fmt(cycle.acceptsApplicationsUntil)}
            </span>
          }
        />
        <StatCard
          label="Decisions due"
          value={
            <span className="text-sm">{fmt(cycle.decisionDueBy)}</span>
          }
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Cycle controls
            </h3>
            <p className="text-xs text-white/55">
              Publishing makes the application link reachable. Pausing hides it
              from the public without losing data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cycle.status !== "published" && cycle.status !== "closed" ? (
              <Button
                size="sm"
                onClick={() => setConfirm("publish")}
                disabled={transitioning}
              >
                {isPublishing ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-2 h-3.5 w-3.5" />
                )}
                Publish
              </Button>
            ) : null}
            {cycle.status === "published" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirm("pause")}
                disabled={transitioning}
              >
                {isPausing ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="mr-2 h-3.5 w-3.5" />
                )}
                Pause
              </Button>
            ) : null}
            {cycle.status !== "closed" && cycle.status !== "archived" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirm("close")}
                disabled={transitioning}
                className="text-rose-300 hover:text-rose-200"
              >
                {isClosing ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-3.5 w-3.5" />
                )}
                Close
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h3 className="text-sm font-semibold text-white">Pipeline snapshot</h3>
        <p className="text-xs text-white/55">
          Live counts by status across all submitted applications.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { id: "submitted", label: "New" },
            { id: "under_review", label: "Reviewing" },
            { id: "interview_scheduled", label: "Interview" },
            { id: "waitlisted", label: "Waitlisted" },
            { id: "accepted", label: "Accepted" },
            { id: "rejected", label: "Not offered" },
            { id: "withdrawn", label: "Withdrawn" },
          ].map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <span className="text-xs text-white/70">{item.label}</span>
              <span className="text-base font-semibold text-white">
                {byStatus[item.id] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h3 className="text-sm font-semibold text-white">Cycle settings</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Row label="Slug">
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-white/85">
              {cycle.slug}
            </code>
          </Row>
          <Row label="Waitlist">
            {cycle.waitlistEnabled ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Enabled
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-white/10 bg-white/5 text-white/55"
              >
                <CircleDashed className="mr-1 h-3 w-3" />
                Disabled
              </Badge>
            )}
          </Row>
          <Row label="Application fee">
            {cycle.applicationFee?.enabled ? (
              <span className="text-sm text-white/85">
                {cycle.applicationFee.currency}{" "}
                {(cycle.applicationFee.amountMinor / 100).toFixed(2)}
              </span>
            ) : (
              <span className="text-sm text-white/55">No fee</span>
            )}
          </Row>
          <Row label="Intake grades">
            <span className="text-sm text-white/85">
              {cycle.intakeGradeIds.length || "All active grades"}
            </span>
          </Row>
        </div>
      </section>

      <ConfirmationDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm === "publish"
            ? "Publish this cycle?"
            : confirm === "pause"
              ? "Pause this cycle?"
              : "Close this cycle?"
        }
        description={
          confirm === "publish"
            ? "The application link will be live and applicants can submit immediately."
            : confirm === "pause"
              ? "The public link will be hidden but data is preserved. You can resume any time."
              : "Closing stops new applications. You can still review and act on existing ones, but reopening requires creating a new cycle."
        }
        confirmLabel={
          confirm === "publish"
            ? "Publish"
            : confirm === "pause"
              ? "Pause"
              : "Close cycle"
        }
        intent={confirm === "close" ? "destructive" : "default"}
        onConfirm={() => confirm && runAction(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <div className="mt-2 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
      <span className="text-xs text-white/55">{label}</span>
      <div>{children}</div>
    </div>
  );
}
