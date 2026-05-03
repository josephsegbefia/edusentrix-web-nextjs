import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AdminCurriculumRow = {
  id: string;
  title: string;
  code: string;
  schoolCurriculumCode: string | null;
  description: string | null;
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { success: boolean; data: { curricula: AdminCurriculumRow[] }; error?: string };

export function useAdminCurricula() {
  return useQuery<AdminCurriculumRow[]>({
    queryKey: ["admin-curricula"],
    queryFn: async () => {
      const res = await fetch("/api/admin/curricula", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ListResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load curricula");
      return json.data.curricula;
    },
    staleTime: 30_000,
  });
}

export function useAdminCurriculumCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      code: string;
      description?: string;
      schoolCurriculumCode?: string | null;
    }) => {
      const res = await fetch("/api/admin/curricula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to create framework");
      return json.data.curriculum as AdminCurriculumRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-curricula"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-curricula"] });
    },
  });
}

export function useAdminCurriculumPatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      body: Partial<{
        title: string;
        code: string;
        description: string | null;
        schoolCurriculumCode: string | null;
        status: "draft" | "active" | "archived";
      }>;
    }) => {
      const res = await fetch(`/api/admin/curricula/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to update framework");
      return json.data.curriculum as AdminCurriculumRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-curricula"] });
      queryClient.invalidateQueries({ queryKey: ["admin-curriculum"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-curricula"] });
    },
  });
}
