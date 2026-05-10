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

export function useAdminSchemeImportCreate() {
  return useMutation({
    mutationFn: async (input: { fileUrl: string; fileName: string; fileKey?: string }) => {
      const res = await fetch("/api/admin/scheme-imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json().catch(() => null)) as CreateResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Import failed");
      return json.data.job;
    },
  });
}

export function useAdminSchemeImportJob(jobId: string | null) {
  return useQuery<SchemeImportJobRow>({
    queryKey: ["admin-scheme-import", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("Missing job id");
      const res = await fetch(`/api/admin/scheme-imports/${jobId}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as JobResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load import");
      return json.data.job;
    },
    enabled: Boolean(jobId),
  });
}

export function useAdminSchemeImportSaveRows(jobId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: SchemeImportParsedRowClient[]) => {
      if (!jobId) throw new Error("Missing job id");
      const res = await fetch(`/api/admin/scheme-imports/${jobId}/rows`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = (await res.json().catch(() => null)) as JobResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to save rows");
      return json.data.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scheme-import", jobId] });
    },
  });
}

export function useAdminSchemeImportConfirm(jobId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      schemeTitle: string;
      academicPeriodId: string;
      gradeId: string;
      classGroupId?: string | null;
      subjectId: string;
    }) => {
      if (!jobId) throw new Error("Missing job id");
      const res = await fetch(`/api/admin/scheme-imports/${jobId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json().catch(() => null)) as ConfirmResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Confirm failed");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scheme-import", jobId] });
      queryClient.invalidateQueries({ queryKey: ["admin-scheme-queue"] });
    },
  });
}

export function useAdminSchemeImportCancel(jobId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("Missing job id");
      const res = await fetch(`/api/admin/scheme-imports/${jobId}/cancel`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as JobResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Cancel failed");
      return json.data.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scheme-import", jobId] });
    },
  });
}
