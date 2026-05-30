import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminReportCardRunDetailDTO } from "@/lib/academics/reporting/report-card-approval-service";
import type { ReportCardRunListItemDTO } from "@/types/academics/assessment-engine";

type ReportRunListResponse = {
  success: boolean;
  data: ReportCardRunListItemDTO[];
  error?: string;
};

type ReportRunDetailResponse = {
  success: boolean;
  data: AdminReportCardRunDetailDTO;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

function adminReportRunsQueryKey(status?: string | null) {
  return ["admin-report-runs", status ?? "all"] as const;
}

function adminReportRunQueryKey(runId?: string | null) {
  return ["admin-report-run", runId ?? "none"] as const;
}

export function useAdminReportRuns(status?: string | null, enabled = true) {
  return useQuery<ReportRunListResponse>({
    queryKey: adminReportRunsQueryKey(status),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== "all") {
        params.set("status", status);
      }

      const query = params.toString();
      const res = await fetch(
        `/api/admin/reports/report-runs${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const json = await parseJson<ReportRunListResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load report runs");
      }
      return json;
    },
    enabled,
    staleTime: 15_000,
  });
}

export function useAdminReportRun(runId?: string | null, enabled = true) {
  return useQuery<ReportRunDetailResponse>({
    queryKey: adminReportRunQueryKey(runId),
    queryFn: async () => {
      if (!runId) {
        throw new Error("Missing report run id");
      }

      const res = await fetch(`/api/admin/reports/report-runs/${encodeURIComponent(runId)}`, {
        cache: "no-store",
      });
      const json = await parseJson<ReportRunDetailResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load report run");
      }
      return json;
    },
    enabled: enabled && Boolean(runId),
    staleTime: 15_000,
  });
}

function invalidateAdminReportRunQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  runId: string
) {
  queryClient.invalidateQueries({ queryKey: ["admin-report-runs"] });
  queryClient.invalidateQueries({ queryKey: adminReportRunQueryKey(runId) });
}

export function useApproveAdminReportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { runId: string; note?: string }) => {
      const res = await fetch(
        `/api/admin/reports/report-runs/${encodeURIComponent(input.runId)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.note ? { note: input.note } : {}),
        }
      );
      const json = await parseJson<ReportRunDetailResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to approve report run");
      }
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(adminReportRunQueryKey(data._id), { success: true, data });
      invalidateAdminReportRunQueries(queryClient, data._id);
    },
  });
}

export function useReturnAdminReportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { runId: string; note: string }) => {
      const res = await fetch(
        `/api/admin/reports/report-runs/${encodeURIComponent(input.runId)}/return`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: input.note }),
        }
      );
      const json = await parseJson<ReportRunDetailResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to return report run");
      }
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(adminReportRunQueryKey(data._id), { success: true, data });
      invalidateAdminReportRunQueries(queryClient, data._id);
    },
  });
}

export function useReleaseAdminReportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      runId: string;
      note?: string;
      releaseVisibility?: { parent?: boolean; student?: boolean };
    }) => {
      const res = await fetch(
        `/api/admin/reports/report-runs/${encodeURIComponent(input.runId)}/release`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(input.note ? { note: input.note } : {}),
            ...(input.releaseVisibility ? { releaseVisibility: input.releaseVisibility } : {}),
          }),
        }
      );
      const json = await parseJson<ReportRunDetailResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to release report run");
      }
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(adminReportRunQueryKey(data._id), { success: true, data });
      invalidateAdminReportRunQueries(queryClient, data._id);
    },
  });
}
