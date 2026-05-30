import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AcademicGradingPolicyDTO } from "@/types/academics/assessment-engine";
import type { GradingPolicyBodyInput } from "@/lib/academics/assessment-engine/grading-policy-service";

export type GradingPolicyListResponse = {
  success: boolean;
  data: AcademicGradingPolicyDTO[];
};

export type GradingPolicyResponse = {
  success: boolean;
  data: AcademicGradingPolicyDTO;
  error?: string;
  errors?: string[];
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useGradingPolicies(filters?: {
  status?: string;
  curriculumCode?: string;
}) {
  return useQuery<GradingPolicyListResponse>({
    queryKey: ["gradingPolicies", filters?.status ?? "all", filters?.curriculumCode ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "all") {
        params.set("status", filters.status);
      }
      if (filters?.curriculumCode && filters.curriculumCode !== "all") {
        params.set("curriculumCode", filters.curriculumCode);
      }
      const query = params.toString();
      const res = await fetch(
        `/api/admin/academics/grading-policies${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const json = await parseJson<{ success?: boolean; error?: string; data?: AcademicGradingPolicyDTO[] }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch grading policies");
      }
      return { success: true, data: json.data ?? [] };
    },
  });
}

export function useGradingPolicy(id?: string | null) {
  return useQuery<GradingPolicyResponse>({
    queryKey: ["gradingPolicy", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/academics/grading-policies/${encodeURIComponent(id!)}`, {
        cache: "no-store",
      });
      const json = await parseJson<GradingPolicyResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch grading policy");
      }
      return json;
    },
  });
}

export function useCreateGradingPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GradingPolicyBodyInput) => {
      const res = await fetch("/api/admin/academics/grading-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<GradingPolicyResponse & { errors?: string[] }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create grading policy");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gradingPolicies"] });
    },
  });
}

export function useUpdateGradingPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: GradingPolicyBodyInput;
    }) => {
      const res = await fetch(`/api/admin/academics/grading-policies/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<GradingPolicyResponse & { errors?: string[] }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update grading policy");
      }
      return json.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["gradingPolicies"] });
      queryClient.invalidateQueries({ queryKey: ["gradingPolicy", variables.id] });
    },
  });
}

export function useActivateGradingPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/admin/academics/grading-policies/${encodeURIComponent(id)}/activate`,
        { method: "POST" }
      );
      const json = await parseJson<GradingPolicyResponse & { errors?: string[] }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to activate grading policy");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gradingPolicies"] });
      queryClient.invalidateQueries({ queryKey: ["gradingPolicy"] });
    },
  });
}

export function useArchiveGradingPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/academics/grading-policies/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await parseJson<GradingPolicyResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to archive grading policy");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gradingPolicies"] });
    },
  });
}
