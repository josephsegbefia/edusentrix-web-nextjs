"use client";

import Link from "next/link";
import { useState } from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import {
  useBackgroundTasks,
  useCancelBackgroundTask,
  useRetryBackgroundTask,
  type BackgroundTaskFilter,
  type SafeBackgroundTask,
} from "@/hooks/useBackgroundTasks";

const FILTERS: Array<{ id: BackgroundTaskFilter; label: string }> = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "all", label: "All" },
];

function statusLabel(job: SafeBackgroundTask) {
  if (job.cancelRequested) return "Cancellation requested";
  if (job.status === "dispatch_failed") return "Waiting to start";
  if (job.status === "queued") return "Queued";
  if (job.status === "running" || job.status === "waiting") return "Running";
  if (job.status === "succeeded") return "Completed";
  if (job.status === "failed") return "Failed";
  if (job.status === "cancelled") return "Cancelled";
  return job.status;
}

function TaskRow({ job }: { job: SafeBackgroundTask }) {
  const cancel = useCancelBackgroundTask();
  const retry = useRetryBackgroundTask();
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-white">{job.displayLabel}</p>
          <p className="text-xs text-white/60">{statusLabel(job)}</p>
          {job.progressMessage ? (
            <p className="text-xs text-white/50">{job.progressMessage}</p>
          ) : null}
          {job.status === "failed" && job.error ? (
            <p className="text-xs text-rose-200">{job.error.message}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {job.actionUrl ? (
            <Button asChild size="sm" className={glassSecondaryButtonClass}>
              <Link href={job.actionUrl}>Open</Link>
            </Button>
          ) : null}
          {job.cancellable ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(job.id)}
            >
              Cancel
            </Button>
          ) : null}
          {job.retryAllowed ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={retry.isPending}
              onClick={() => retry.mutate(job.id)}
            >
              Retry
            </Button>
          ) : null}
        </div>
      </div>
      {["queued", "dispatch_failed", "running", "waiting", "cancel_requested"].includes(
        job.status
      ) ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-teal-400/80"
            style={{ width: `${Math.max(4, job.progressPercent)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function BackgroundTaskCenter({
  backHref,
}: {
  backHref: string;
}) {
  const [filter, setFilter] = useState<BackgroundTaskFilter>("active");
  const { data, isLoading, error } = useBackgroundTasks(filter);

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        title="Work"
        subtitle="Background tasks EduSentrix is doing for you."
        backHref={backHref}
        icon={ListChecks}
      />
      <GlassPanel className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                filter === item.id
                  ? "border-teal-300/30 bg-teal-500/15 text-teal-100"
                  : "border-white/10 bg-white/5 text-white/70"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tasks…
          </div>
        ) : error ? (
          <p className="text-sm text-rose-200">Could not load tasks.</p>
        ) : !data?.jobs.length ? (
          <p className="text-sm text-white/55">No tasks in this view.</p>
        ) : (
          <div className="space-y-3">
            {data.jobs.map((job) => (
              <TaskRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </GlassPanel>
    </WorkspacePageShell>
  );
}
