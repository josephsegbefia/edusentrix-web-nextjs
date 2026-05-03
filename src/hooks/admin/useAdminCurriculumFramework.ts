import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminCurriculumRow } from "@/hooks/admin/useAdminCurricula";

export type AdminCurriculumSubjectRow = {
  id: string;
  curriculumId: string;
  subjectId: string;
  subjectName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  order: number;
};

export type AdminCurriculumNodeRow = {
  id: string;
  curriculumId: string;
  curriculumSubjectId: string;
  parentNodeId: string | null;
  kind: "strand" | "sub_strand" | "topic" | "sub_topic" | "objective";
  title: string;
  code: string | null;
  order: number;
};

const qk = {
  curriculum: (id: string) => ["admin-curriculum", id] as const,
  subjects: (curriculumId: string) => ["admin-curriculum-subjects", curriculumId] as const,
  nodes: (curriculumId: string, curriculumSubjectId: string) =>
    ["admin-curriculum-nodes", curriculumId, curriculumSubjectId] as const,
};

export function useAdminCurriculumDetail(id: string | undefined) {
  return useQuery<AdminCurriculumRow>({
    queryKey: qk.curriculum(id || ""),
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch(`/api/admin/curricula/${id}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; data?: { curriculum: AdminCurriculumRow }; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to load framework");
      }
      return json.data.curriculum;
    },
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useAdminCurriculumSubjects(curriculumId: string | undefined) {
  return useQuery<AdminCurriculumSubjectRow[]>({
    queryKey: qk.subjects(curriculumId || ""),
    queryFn: async () => {
      if (!curriculumId) throw new Error("Missing curriculumId");
      const res = await fetch(
        `/api/admin/curricula/${curriculumId}/curriculum-subjects`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; data?: { curriculumSubjects: AdminCurriculumSubjectRow[] }; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to load subjects");
      }
      return json.data.curriculumSubjects;
    },
    enabled: Boolean(curriculumId),
    staleTime: 15_000,
  });
}

export function useAdminCurriculumNodes(
  curriculumId: string | undefined,
  curriculumSubjectId: string | undefined
) {
  return useQuery<AdminCurriculumNodeRow[]>({
    queryKey: qk.nodes(curriculumId || "", curriculumSubjectId || ""),
    queryFn: async () => {
      if (!curriculumId || !curriculumSubjectId) throw new Error("Missing ids");
      const res = await fetch(`/api/admin/curriculum-subjects/${curriculumSubjectId}/nodes`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; data?: { nodes: AdminCurriculumNodeRow[] }; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to load nodes");
      }
      return json.data.nodes;
    },
    enabled: Boolean(curriculumId && curriculumSubjectId),
    staleTime: 10_000,
  });
}

export function useAdminCurriculumSubjectCreate(curriculumId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { subjectId: string; gradeId?: string | null; order?: number }) => {
      const res = await fetch(`/api/admin/curricula/${curriculumId}/curriculum-subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to add subject");
      return json.data.curriculumSubject as AdminCurriculumSubjectRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.subjects(curriculumId) });
      qc.invalidateQueries({ queryKey: ["teacher-curriculum-subjects"] });
    },
  });
}

export function useAdminCurriculumSubjectDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; curriculumId: string }) => {
      const res = await fetch(`/api/admin/curriculum-subjects/${args.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to remove subject");
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: qk.subjects(args.curriculumId) });
      qc.invalidateQueries({ queryKey: ["teacher-curriculum-subjects"] });
    },
  });
}

export function useAdminCurriculumNodeCreate(curriculumId: string, curriculumSubjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      parentNodeId?: string | null;
      kind: AdminCurriculumNodeRow["kind"];
      title: string;
      code?: string | null;
      order?: number;
    }) => {
      const res = await fetch(`/api/admin/curriculum-subjects/${curriculumSubjectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to add node");
      return json.data.node as AdminCurriculumNodeRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.nodes(curriculumId, curriculumSubjectId) });
    },
  });
}

export function useAdminCurriculumNodeDelete(curriculumId: string, curriculumSubjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nodeId: string) => {
      const res = await fetch(`/api/admin/curriculum-nodes/${nodeId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to delete node");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.nodes(curriculumId, curriculumSubjectId) });
    },
  });
}

