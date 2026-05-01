import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoverageSummaryRow,
  SchemeItemCoverageStatus,
  SchemeItemRow,
  SchemeRow,
} from "@/types/schemes";

type SchemesResponse = { success: boolean; data: { schemes: SchemeRow[] }; error?: string };
type SchemeItemsResponse = { success: boolean; data: { items: SchemeItemRow[] }; error?: string };
type SchemeDetailResponse = { success: boolean; data: { scheme: SchemeRow }; error?: string };
type CoverageSingleResponse = {
  success: boolean;
  data: { scheme: SchemeRow; summary: CoverageSummaryRow };
  error?: string;
};
type CoverageListResponse = {
  success: boolean;
  data: { schemes: Array<{ scheme: SchemeRow; summary: CoverageSummaryRow }> };
  error?: string;
};

export function useTeacherSchemes(status?: string) {
  return useQuery<SchemeRow[]>({
    queryKey: ["teacher-schemes", status || "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/teacher/schemes?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as SchemesResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to fetch schemes");
      return json.data.schemes;
    },
    staleTime: 60_000,
  });
}

export function useTeacherSchemeDetail(schemeId: string | null) {
  return useQuery<SchemeRow>({
    queryKey: ["teacher-scheme", schemeId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/schemes/${schemeId}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as SchemeDetailResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to fetch scheme");
      return json.data.scheme;
    },
    enabled: Boolean(schemeId),
    staleTime: 30_000,
  });
}

export function useTeacherSchemeItems(schemeId: string | null) {
  return useQuery<SchemeItemRow[]>({
    queryKey: ["teacher-scheme-items", schemeId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/schemes/${schemeId}/items`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as SchemeItemsResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to fetch items");
      return json.data.items;
    },
    enabled: Boolean(schemeId),
    staleTime: 30_000,
  });
}

export function useTeacherSchemeCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string }) => {
      const res = await fetch("/api/teacher/schemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to create scheme");
      return json.data.scheme as SchemeRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schemes"] });
    },
  });
}

export function useTeacherSchemeSubmit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schemeId: string) => {
      const res = await fetch(`/api/teacher/schemes/${schemeId}/submit`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to submit scheme");
      return json;
    },
    onSuccess: (_data, schemeId) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schemes"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-scheme", schemeId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-coverage-summary", schemeId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-coverage-dashboard"] });
    },
  });
}

export function useTeacherCoverageSummary(schemeId: string | null) {
  return useQuery<{ scheme: SchemeRow; summary: CoverageSummaryRow }>({
    queryKey: ["teacher-coverage-summary", schemeId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (schemeId) params.set("schemeId", schemeId);
      const res = await fetch(`/api/teacher/coverage/summary?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as CoverageSingleResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to fetch coverage");
      return { scheme: json.data.scheme, summary: json.data.summary };
    },
    enabled: Boolean(schemeId),
    staleTime: 30_000,
  });
}

export function useTeacherCoverageDashboard() {
  return useQuery<Array<{ scheme: SchemeRow; summary: CoverageSummaryRow }>>({
    queryKey: ["teacher-coverage-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/coverage/summary", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as CoverageListResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to fetch coverage");
      return json.data.schemes;
    },
    staleTime: 60_000,
  });
}

export function useTeacherSchemeItemCoverageUpdate(schemeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      itemId: string;
      status: SchemeItemCoverageStatus;
      coverageNote?: string | null;
    }) => {
      const res = await fetch(`/api/teacher/scheme-items/${args.itemId}/coverage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: args.status,
          ...(args.coverageNote !== undefined ? { coverageNote: args.coverageNote } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to update coverage");
      return json.data.item as SchemeItemRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-scheme-items", schemeId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-coverage-summary", schemeId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-coverage-dashboard"] });
    },
  });
}

export function useTeacherSchemeItemCreate(schemeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string }) => {
      const res = await fetch(`/api/teacher/schemes/${schemeId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to create scheme item");
      return json.data.item as SchemeItemRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-scheme-items", schemeId] });
    },
  });
}
