import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssessmentPlanDTO } from "@/types/academics/assessment-engine";
import type { AssessmentPlanBodyInput } from "@/lib/academics/assessment-engine/assessment-plan-service";

export type AssessmentPlanListResponse = {
  success: boolean;
  data: AssessmentPlanDTO[];
};

export type AssessmentPlanResponse = {
  success: boolean;
  data: AssessmentPlanDTO;
  error?: string;
  errors?: string[];
  archivedConflicts?: string[];
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useAssessmentPlans(filters?: {
  status?: string;
  academicPeriodId?: string;
  gradeId?: string;
  gradingPolicyId?: string;
}) {
  return useQuery<AssessmentPlanListResponse>({
    queryKey: [
      "assessmentPlans",
      filters?.status ?? "all",
      filters?.academicPeriodId ?? "all",
      filters?.gradeId ?? "all",
      filters?.gradingPolicyId ?? "all",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "all") {
        params.set("status", filters.status);
      }
      if (filters?.academicPeriodId && filters.academicPeriodId !== "all") {
        params.set("academicPeriodId", filters.academicPeriodId);
      }
      if (filters?.gradeId && filters.gradeId !== "all") {
        params.set("gradeId", filters.gradeId);
      }
      if (filters?.gradingPolicyId && filters.gradingPolicyId !== "all") {
        params.set("gradingPolicyId", filters.gradingPolicyId);
      }
      const query = params.toString();
      const res = await fetch(
        `/api/admin/academics/assessment-plans${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const json = await parseJson<{
        success?: boolean;
        error?: string;
        data?: AssessmentPlanDTO[];
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch assessment plans");
      }
      return { success: true, data: json.data ?? [] };
    },
  });
}

export function useCreateAssessmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssessmentPlanBodyInput) => {
      const res = await fetch("/api/admin/academics/assessment-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<AssessmentPlanResponse & { errors?: string[] }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create assessment plan");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentPlans"] });
    },
  });
}

export function useUpdateAssessmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AssessmentPlanBodyInput;
    }) => {
      const res = await fetch(`/api/admin/academics/assessment-plans/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<AssessmentPlanResponse & { errors?: string[] }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update assessment plan");
      }
      return json.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assessmentPlans"] });
      queryClient.invalidateQueries({ queryKey: ["assessmentPlan", variables.id] });
    },
  });
}

export function useActivateAssessmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/admin/academics/assessment-plans/${encodeURIComponent(id)}/activate`,
        { method: "POST" }
      );
      const json = await parseJson<AssessmentPlanResponse & { errors?: string[] }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to activate assessment plan");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentPlans"] });
    },
  });
}

export function useArchiveAssessmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/academics/assessment-plans/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await parseJson<AssessmentPlanResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to archive assessment plan");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentPlans"] });
    },
  });
}
