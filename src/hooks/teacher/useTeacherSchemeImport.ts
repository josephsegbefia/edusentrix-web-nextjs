import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SchemeImportJobRow, SchemeImportParsedRowClient } from "@/types/scheme-import";
import type { SchemeRow } from "@/types/schemes";

type CreateResponse = { success: boolean; data: { job: SchemeImportJobRow }; error?: string };
type JobResponse = { success: boolean; data: { job: SchemeImportJobRow }; error?: string };
type ConfirmResponse = {
  success: boolean;
  data: { job: SchemeImportJobRow; scheme: SchemeRow | null };
  error?: string;
};

export function useTeacherSchemeImportCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { fileUrl: string; fileName: string; fileKey?: string }) => {
      const res = await fetch("/api/teacher/scheme-imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as CreateResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Import failed");
      return json.data.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schemes"] });
    },
  });
}

export function useTeacherSchemeImportJob(jobId: string | null) {
  return useQuery<SchemeImportJobRow>({
    queryKey: ["teacher-scheme-import", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/scheme-imports/${jobId}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as JobResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load import job");
      return json.data.job;
    },
    enabled: Boolean(jobId),
    staleTime: 15_000,
  });
}

export function useTeacherSchemeImportSaveRows(jobId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: SchemeImportParsedRowClient[]) => {
      const res = await fetch(`/api/teacher/scheme-imports/${jobId}/rows`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = (await res.json().catch(() => null)) as JobResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to save rows");
      return json.data.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-scheme-import", jobId] });
    },
  });
}

export function useTeacherSchemeImportConfirm(jobId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      schemeTitle: string;
      academicPeriodId: string;
      gradeId?: string | null;
      classGroupId?: string | null;
      subjectId?: string | null;
    }) => {
      const res = await fetch(`/api/teacher/scheme-imports/${jobId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as ConfirmResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not create scheme");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schemes"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-scheme-import", jobId] });
    },
  });
}

export function useTeacherSchemeImportCancel(jobId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teacher/scheme-imports/${jobId}/cancel`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as JobResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Cancel failed");
      return json.data.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-scheme-import", jobId] });
    },
  });
}
