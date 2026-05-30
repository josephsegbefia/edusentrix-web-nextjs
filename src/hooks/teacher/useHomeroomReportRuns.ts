import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ReportCardRunDetailDTO,
  ReportCardRunListItemDTO,
} from "@/types/academics/assessment-engine";

type ReportRunListResponse = {
  success: boolean;
  data: ReportCardRunListItemDTO[];
  error?: string;
};

type ReportRunDetailResponse = {
  success: boolean;
  data: ReportCardRunDetailDTO;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

function reportRunsQueryKey(classGroupId?: string | null, academicPeriodId?: string | null) {
  return ["homeroom-report-runs", classGroupId ?? "none", academicPeriodId ?? "current"] as const;
}

function reportRunQueryKey(runId?: string | null) {
  return ["homeroom-report-run", runId ?? "none"] as const;
}

export function useHomeroomReportRuns(
  classGroupId?: string | null,
  academicPeriodId?: string | null,
  enabled = true
) {
  return useQuery<ReportRunListResponse>({
    queryKey: reportRunsQueryKey(classGroupId, academicPeriodId),
    queryFn: async () => {
      if (!classGroupId) {
        throw new Error("Missing class group");
      }

      const params = new URLSearchParams({ classGroupId });
      if (academicPeriodId) {
        params.set("academicPeriodId", academicPeriodId);
      }

      const res = await fetch(`/api/teacher/homeroom/report-runs?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await parseJson<ReportRunListResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load report runs");
      }
      return json;
    },
    enabled: enabled && Boolean(classGroupId),
    staleTime: 15_000,
  });
}

export function useHomeroomReportRun(runId?: string | null, enabled = true) {
  return useQuery<ReportRunDetailResponse>({
    queryKey: reportRunQueryKey(runId),
    queryFn: async () => {
      if (!runId) {
        throw new Error("Missing report run id");
      }

      const res = await fetch(`/api/teacher/homeroom/report-runs/${encodeURIComponent(runId)}`, {
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

export function useOpenHomeroomReportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { classGroupId: string; academicPeriodId?: string | null }) => {
      const res = await fetch("/api/teacher/homeroom/report-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classGroupId: input.classGroupId,
          ...(input.academicPeriodId ? { academicPeriodId: input.academicPeriodId } : {}),
        }),
      });
      const json = await parseJson<ReportRunDetailResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to open report run");
      }
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: reportRunsQueryKey(variables.classGroupId, variables.academicPeriodId),
      });
      queryClient.setQueryData(reportRunQueryKey(data._id), { success: true, data });
    },
  });
}

export function useCompileHomeroomReportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { runId: string; classGroupId: string }) => {
      const res = await fetch(
        `/api/teacher/homeroom/report-runs/${encodeURIComponent(input.runId)}/compile`,
        { method: "POST" }
      );
      const json = await parseJson<ReportRunDetailResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to compile report run");
      }
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(reportRunQueryKey(data._id), { success: true, data });
      queryClient.invalidateQueries({
        queryKey: reportRunsQueryKey(variables.classGroupId),
      });
    },
  });
}

export function useSubmitHomeroomReportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { runId: string; classGroupId: string }) => {
      const res = await fetch(
        `/api/teacher/homeroom/report-runs/${encodeURIComponent(input.runId)}/submit`,
        { method: "POST" }
      );
      const json = await parseJson<ReportRunDetailResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to submit report run");
      }
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(reportRunQueryKey(data._id), { success: true, data });
      queryClient.invalidateQueries({
        queryKey: reportRunsQueryKey(variables.classGroupId),
      });
    },
  });
}
