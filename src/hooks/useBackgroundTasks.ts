"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type SafeBackgroundTask = {
  id: string;
  kind: string;
  displayLabel: string;
  status: string;
  progressPercent: number;
  progressStage: string | null;
  progressMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  failedAt: string | null;
  cancellable: boolean;
  cancelRequested: boolean;
  retryAllowed: boolean;
  actionUrl: string | null;
  error: { code: string; message: string } | null;
};

export type BackgroundTaskFilter = "active" | "completed" | "failed" | "all";

type ListResponse = {
  success: boolean;
  data?: {
    jobs: SafeBackgroundTask[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  };
  error?: string;
};

function listUrl(filter: BackgroundTaskFilter, offset: number) {
  const params = new URLSearchParams();
  params.set("limit", "20");
  params.set("offset", String(offset));
  if (filter !== "all") params.set("filter", filter);
  return `/api/background-jobs?${params.toString()}`;
}

export function useDocumentVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

export function useBackgroundTasks(filter: BackgroundTaskFilter, offset = 0) {
  const visible = useDocumentVisible();
  return useQuery({
    queryKey: ["background-tasks", filter, offset],
    queryFn: async (): Promise<ListResponse["data"]> => {
      const res = await fetch(listUrl(filter, offset));
      const json = (await res.json()) as ListResponse;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Failed to load tasks");
      }
      return json.data;
    },
    refetchInterval: (query) => {
      if (!visible) return false;
      const jobs = query.state.data?.jobs ?? [];
      const hasActive = jobs.some((job) =>
        ["queued", "dispatch_failed", "running", "waiting", "cancel_requested"].includes(
          job.status
        )
      );
      if (filter === "active" && hasActive) return 4000;
      if (hasActive) return 4000;
      return 15_000;
    },
  });
}

export function useBackgroundTaskCount(enabled = true) {
  const visible = useDocumentVisible();
  return useQuery({
    queryKey: ["background-tasks", "active-count"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/background-jobs?filter=active&limit=1");
      const json = (await res.json()) as ListResponse;
      if (!res.ok || !json.success || !json.data) return 0;
      return json.data.pagination.total;
    },
    refetchInterval: visible ? 15_000 : false,
  });
}

export function useCancelBackgroundTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/background-jobs/${jobId}/cancel`, { method: "POST" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || "Cancel failed");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["background-tasks"] });
    },
  });
}

export function useRetryBackgroundTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/background-jobs/${jobId}/retry`, { method: "POST" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || "Retry failed");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["background-tasks"] });
    },
  });
}
