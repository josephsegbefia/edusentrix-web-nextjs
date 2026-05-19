import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteSchemeRequest } from "@/lib/schemes/delete-scheme-client";
import type { AdminSchemeDetailPayload, AdminSchemeQueueRow } from "@/types/schemes";

type SchemeQueueFilters = {
  status: string;
  page?: number;
  limit?: number;
  periodId?: string;
  gradeId?: string;
  classGroupId?: string;
  subjectId?: string;
  teacherId?: string;
  curriculumId?: string;
  search?: string;
};

type SchemeQueueResponse = {
  success: boolean;
  data: AdminSchemeQueueRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

function buildQueueQuery(f: SchemeQueueFilters) {
  const params = new URLSearchParams();
  params.set("status", f.status);
  params.set("page", String(f.page ?? 1));
  params.set("limit", String(f.limit ?? 20));
  if (f.periodId) params.set("periodId", f.periodId);
  if (f.gradeId) params.set("gradeId", f.gradeId);
  if (f.classGroupId) params.set("classGroupId", f.classGroupId);
  if (f.subjectId) params.set("subjectId", f.subjectId);
  if (f.teacherId) params.set("teacherId", f.teacherId);
  if (f.curriculumId) params.set("curriculumId", f.curriculumId);
  if (f.search?.trim()) params.set("search", f.search.trim());
  return params.toString();
}

export function useAdminSchemeQueue(filters: SchemeQueueFilters) {
  const key = buildQueueQuery(filters);
  return useQuery({
    queryKey: ["admin-scheme-queue", key],
    queryFn: async () => {
      const res = await fetch(`/api/admin/schemes?${key}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as SchemeQueueResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to fetch schemes");
      return {
        rows: json.data,
        pagination: json.pagination,
      };
    },
    staleTime: 15_000,
  });
}

export function useAdminSchemeDetail(id: string | undefined) {
  return useQuery<AdminSchemeDetailPayload>({
    queryKey: ["admin-scheme-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch(`/api/admin/schemes/${id}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as {
        success: boolean;
        data?: AdminSchemeDetailPayload;
        error?: string;
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to load scheme");
      }
      return json.data;
    },
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useAdminSchemeReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      schemeId: string;
      decision: "approved" | "needs_revision" | "rejected";
      note?: string;
    }) => {
      const res = await fetch(`/api/admin/schemes/${payload.schemeId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: payload.decision, note: payload.note }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Review failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-scheme-queue"] });
      qc.invalidateQueries({ queryKey: ["admin-scheme-detail"] });
      qc.invalidateQueries({ queryKey: ["teacher-schemes"] });
      qc.invalidateQueries({ queryKey: ["teacher-scheme"] });
      qc.invalidateQueries({ queryKey: ["teacher-coverage-dashboard"] });
    },
  });
}

export function useAdminSchemeApproveMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { schemeId: string; note?: string }) => {
      const res = await fetch(`/api/admin/schemes/${payload.schemeId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: payload.note }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Approve failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-scheme-queue"] });
      qc.invalidateQueries({ queryKey: ["admin-scheme-detail"] });
      qc.invalidateQueries({ queryKey: ["teacher-schemes"] });
      qc.invalidateQueries({ queryKey: ["teacher-scheme"] });
      qc.invalidateQueries({ queryKey: ["teacher-coverage-dashboard"] });
    },
  });
}

export function useAdminSchemeActivateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (schemeId: string) => {
      const res = await fetch(`/api/admin/schemes/${schemeId}/activate`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        code?: string;
        message?: string;
        conflict?: { id: string; title: string };
      } | null;
      if (!res.ok || !json?.success) {
        const err = json as { code?: string; message?: string; conflict?: { id: string; title: string } };
        const e = new Error(err.message || "Activation failed") as Error & {
          code?: string;
          conflict?: { id: string; title: string };
        };
        e.code = err.code;
        e.conflict = err.conflict;
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-scheme-queue"] });
      qc.invalidateQueries({ queryKey: ["admin-scheme-detail"] });
      qc.invalidateQueries({ queryKey: ["teacher-schemes"] });
      qc.invalidateQueries({ queryKey: ["teacher-scheme"] });
      qc.invalidateQueries({ queryKey: ["teacher-coverage-dashboard"] });
    },
  });
}

export function useAdminSchemeArchiveMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { schemeId: string; note?: string }) => {
      const res = await fetch(`/api/admin/schemes/${payload.schemeId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: payload.note }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Archive failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-scheme-queue"] });
      qc.invalidateQueries({ queryKey: ["admin-scheme-detail"] });
      qc.invalidateQueries({ queryKey: ["teacher-schemes"] });
      qc.invalidateQueries({ queryKey: ["teacher-scheme"] });
      qc.invalidateQueries({ queryKey: ["teacher-coverage-dashboard"] });
    },
  });
}

export function useAdminSchemeDeleteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { schemeId: string; unlinkLessonNotes?: boolean }) => {
      await deleteSchemeRequest(
        "/api/admin/schemes",
        input.schemeId,
        input.unlinkLessonNotes,
      );
      return input.schemeId;
    },
    onSuccess: (deletedId) => {
      qc.invalidateQueries({ queryKey: ["admin-scheme-queue"] });
      qc.removeQueries({ queryKey: ["admin-scheme-detail", deletedId] });
      qc.invalidateQueries({ queryKey: ["teacher-schemes"] });
      qc.removeQueries({ queryKey: ["teacher-scheme", deletedId] });
      qc.removeQueries({ queryKey: ["teacher-scheme-items", deletedId] });
      qc.removeQueries({ queryKey: ["teacher-coverage-summary", deletedId] });
      qc.invalidateQueries({ queryKey: ["teacher-coverage-dashboard"] });
    },
  });
}
