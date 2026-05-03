import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoverageSummaryRow,
  SchemeItemCoverageStatus,
  SchemeItemRow,
  SchemeRow,
} from "@/types/schemes";
import type { LeoSchemePlanMode, LeoSchemePlanResult } from "@/types/scheme-leo";

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
    mutationFn: async (payload: {
      title: string;
      description?: string;
      academicPeriodId?: string;
      gradeId?: string;
      classGroupId?: string;
      subjectId?: string;
    }) => {
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

export function useTeacherSchemeDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schemeId: string) => {
      const res = await fetch(`/api/teacher/schemes/${schemeId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to delete scheme");
      return schemeId;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schemes"] });
      queryClient.removeQueries({ queryKey: ["teacher-scheme", deletedId] });
      queryClient.removeQueries({ queryKey: ["teacher-scheme-items", deletedId] });
      queryClient.removeQueries({ queryKey: ["teacher-coverage-summary", deletedId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-coverage-dashboard"] });
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
    mutationFn: async (payload: {
      title: string;
      topic?: string;
      subtopic?: string;
      lessonOrder?: number | null;
      learningObjective?: string | null;
      learningObjectives?: string[];
      strand?: string | null;
      subStrand?: string | null;
      contentStandard?: string | null;
      indicator?: string | null;
      teachingResources?: string[];
      assessmentIdeas?: string[];
      plannedStartDate?: string | null;
      plannedEndDate?: string | null;
      notes?: string | null;
    }) => {
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

export type CurriculumRow = {
  id: string;
  title: string;
  code: string;
  schoolCurriculumCode: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  matchesSchoolCurriculum?: boolean;
};

export type TeacherCurriculaPayload = {
  curricula: CurriculumRow[];
  schoolCurriculumCode: string | null;
};

export function useTeacherCurricula(enabled: boolean) {
  return useQuery<TeacherCurriculaPayload>({
    queryKey: ["teacher-curricula"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/curricula", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load curricula");
      return {
        curricula: json.data.curricula as CurriculumRow[],
        schoolCurriculumCode: (json.data.schoolCurriculumCode ?? null) as string | null,
      };
    },
    enabled,
    staleTime: 120_000,
  });
}

export type CurriculumSubjectOption = {
  id: string;
  curriculumId: string;
  subjectId: string;
  subjectName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  order: number;
};

export function useTeacherCurriculumSubjects(curriculumId: string | null, enabled: boolean) {
  return useQuery<CurriculumSubjectOption[]>({
    queryKey: ["teacher-curriculum-subjects", curriculumId],
    queryFn: async () => {
      const params = new URLSearchParams({ curriculumId: curriculumId! });
      const res = await fetch(`/api/teacher/curriculum-subjects?${params}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load curriculum subjects");
      return json.data.curriculumSubjects as CurriculumSubjectOption[];
    },
    enabled: Boolean(curriculumId) && enabled,
    staleTime: 120_000,
  });
}

export function useTeacherSchemeCurriculumPatch(schemeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      curriculumId: string | null;
      curriculumSubjectId: string | null;
    }) => {
      const res = await fetch(`/api/teacher/schemes/${schemeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to update scheme");
      return json.data.scheme as SchemeRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-scheme", schemeId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-schemes"] });
    },
  });
}

export function useTeacherLeoSchemePlan(schemeId: string | null) {
  return useMutation({
    mutationFn: async (payload: { mode: LeoSchemePlanMode; nodeSearch?: string }) => {
      const res = await fetch(`/api/teacher/schemes/${schemeId}/leo-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Leo planner failed");
      return json.data.plan as LeoSchemePlanResult;
    },
  });
}

export function useTeacherSchemeItemsBatch(schemeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      items: Array<{
        weekNumber?: number | null;
        title: string;
        learningObjective?: string | null;
        notes?: string | null;
        curriculumNodeIds?: string[];
      }>
    ) => {
      const res = await fetch(`/api/teacher/schemes/${schemeId}/items/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to add items");
      return json.data.items as SchemeItemRow[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-scheme-items", schemeId] });
    },
  });
}
