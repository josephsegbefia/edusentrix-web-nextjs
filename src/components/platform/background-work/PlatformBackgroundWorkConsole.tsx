"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import type { SafeBackgroundTask } from "@/hooks/useBackgroundTasks";

type Health = {
  queuedJobs: number;
  dispatchFailedJobs: number;
  runningJobs: number;
  failedJobs: number;
  stale: { runningWithOldHeartbeat: number; dispatchFailed: number; exhaustedRecovery: number };
  orphanDomainJobs: number;
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!res.ok || !body.success || !body.data) throw new Error(body.error || "Request failed");
  return body.data;
}

const OPERATOR_KINDS = [
  "",
  "EMAIL_DISPATCH",
  "LIBRARY_IMPORT",
  "SCHEME_IMPORT",
  "BULK_IMPORT",
  "AI_LESSON_GENERATION",
  "AI_LESSON_ILLUSTRATION",
  "EXPLORE_GENERATION",
  "SCHOOL_PROVISIONING",
  "COMMUNICATION_OUTBOX",
];

export function PlatformBackgroundWorkConsole() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("dispatch_failed");
  const [kind, setKind] = useState("");
  const health = useQuery({
    queryKey: ["platform-background-health"],
    queryFn: () =>
      fetch("/api/platform/background-work/health").then((res) => jsonOrThrow<Health>(res)),
    refetchInterval: 15_000,
  });
  const jobs = useQuery({
    queryKey: ["platform-background-jobs", status, kind],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "20" });
      if (status === "stale") params.set("stale", "1");
      else if (status) params.set("status", status);
      if (kind) params.set("kind", kind);
      return fetch(`/api/platform/background-work/jobs?${params}`).then((res) =>
        jsonOrThrow<{ jobs: SafeBackgroundTask[] }>(res)
      );
    },
    refetchInterval: 10_000,
  });

  const redispatch = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/platform/background-work/jobs/${id}/redispatch`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-background-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["platform-background-health"] });
    },
  });
  const retry = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/platform/background-work/jobs/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-background-jobs"] });
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/platform/background-work/jobs/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-background-jobs"] });
    },
  });

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        title="Background work"
        subtitle="Queue health, stale jobs, and safe recovery."
        icon={Activity}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Queued", health.data?.queuedJobs ?? 0],
          ["Dispatch failed", health.data?.dispatchFailedJobs ?? 0],
          ["Running", health.data?.runningJobs ?? 0],
          ["Failed", health.data?.failedJobs ?? 0],
          ["Stale running", health.data?.stale.runningWithOldHeartbeat ?? 0],
          ["Orphans", health.data?.orphanDomainJobs ?? 0],
        ].map(([label, value]) => (
          <GlassPanel key={String(label)} className="p-4">
            <p className="text-xs text-white/55">{label}</p>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </GlassPanel>
        ))}
      </div>
      <GlassPanel className="mt-4 space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
          >
            {OPERATOR_KINDS.map((value) => (
              <option key={value || "all"} value={value}>
                {value || "All kinds"}
              </option>
            ))}
          </select>
          {["queued", "dispatch_failed", "running", "waiting", "failed", "stale"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-full border px-3 py-1 text-xs ${
                status === value
                  ? "border-teal-300/30 bg-teal-500/15 text-teal-100"
                  : "border-white/10 bg-white/5 text-white/70"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        {!jobs.data?.jobs.length ? (
          <p className="text-sm text-white/55">No jobs in this filter.</p>
        ) : (
          <div className="space-y-3">
            {jobs.data.jobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{job.displayLabel}</p>
                    <p className="text-xs text-white/55">{job.status}</p>
                    {job.error ? <p className="text-xs text-rose-200">{job.error.message}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    {job.status === "dispatch_failed" ? (
                      <Button size="sm" variant="ghost" onClick={() => redispatch.mutate(job.id)}>
                        Redispatch
                      </Button>
                    ) : null}
                    {job.retryAllowed ? (
                      <Button size="sm" variant="ghost" onClick={() => retry.mutate(job.id)}>
                        Retry
                      </Button>
                    ) : null}
                    {job.cancellable ? (
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(job.id)}>
                        Cancel
                      </Button>
                    ) : null}
                    {job.actionUrl ? (
                      <Button asChild size="sm" variant="ghost">
                        <a href={job.actionUrl}>Open</a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </WorkspacePageShell>
  );
}
