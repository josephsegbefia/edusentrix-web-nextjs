"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBusyToast } from "@/hooks/useBusyToast";

export type SubjectOfferingDTO = {
  id: string;
  subjectId: string;
  subjectFamily: string;
  displayName: string;
  shortName: string;
  code: string;
  curriculumCode: string;
  stage: string;
  gradeBand: string;
  gradeIds: string[];
  gradeNames: string[];
  category: string;
  lessonNoteTemplateVariant: string | null;
  assignedClassGroupCount: number;
  assignedTeacherCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubjectOfferingsFilters = {
  search?: string;
  curriculumCode?: string;
  stage?: string;
  gradeBand?: string;
  category?: string;
  gradeId?: string;
  isActive?: boolean;
};

export function useSubjectOfferings(filters: SubjectOfferingsFilters = {}) {
  return useQuery<{ success: boolean; data: SubjectOfferingDTO[]; error?: string }>({
    queryKey: ["subject-offerings", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "" && value !== "all") {
          params.set(key, String(value));
        }
      }
      const res = await fetch(`/api/admin/subject-offerings?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to fetch subject offerings");
      return json;
    },
    staleTime: 30_000,
  });
}

export function useSetupSubjectOfferingsFromCurriculum() {
  const queryClient = useQueryClient();
  const busy = useBusyToast();

  return useMutation({
    mutationFn: async (payload: {
      curriculumCode: string;
      selectedOfferingCodes: string[];
      gradeIds: string[];
      autoAssignToMatchingClassGroups: boolean;
      schoolType?: string;
    }) => {
      const res = await fetch("/api/admin/subject-offerings/setup-from-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to set up subject offerings");
      return json as {
        success: boolean;
        data: {
          createdSubjects: number;
          createdOfferings: number;
          assignedClassGroups: number;
          skippedExisting: number;
          warnings: string[];
        };
      };
    },
    onMutate: () => busy.toast("Setting up subject offerings..."),
    onSuccess: ({ data }) => {
      busy.success(
        `Created ${data.createdOfferings} offering${data.createdOfferings === 1 ? "" : "s"}`
      );
      queryClient.invalidateQueries({ queryKey: ["subject-offerings"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (error: unknown) => {
      busy.error(error instanceof Error ? error.message : "Failed to set up subject offerings");
    },
  });
}

export function useCreateCustomSubjectOffering() {
  const queryClient = useQueryClient();
  const busy = useBusyToast();

  return useMutation({
    mutationFn: async (payload: {
      subjectFamily: string;
      displayName: string;
      shortName: string;
      code: string;
      curriculumCode: string;
      stage: string;
      gradeBand: string;
      gradeIds: string[];
      category: string;
      lessonNoteTemplateVariant?: string;
      reportCardGroup?: string | null;
      autoAssignToMatchingClassGroups?: boolean;
    }) => {
      const res = await fetch("/api/admin/subject-offerings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to create custom subject offering");
      return json as { success: boolean; data: { id: string } };
    },
    onMutate: () => busy.toast("Creating custom offering..."),
    onSuccess: () => {
      busy.success("Custom subject offering created");
      queryClient.invalidateQueries({ queryKey: ["subject-offerings"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (error: unknown) => {
      busy.error(error instanceof Error ? error.message : "Failed to create custom offering");
    },
  });
}

export function useAssignSubjectOfferingToClasses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      subjectOfferingId: string;
      classGroupIds: string[];
      allowIncompatible?: boolean;
    }) => {
      const res = await fetch(
        `/api/admin/subject-offerings/${payload.subjectOfferingId}/assign-class-groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classGroupIds: payload.classGroupIds,
            allowIncompatible: payload.allowIncompatible,
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to assign classes");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-offerings"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useDeactivateSubjectOffering() {
  const queryClient = useQueryClient();
  const busy = useBusyToast();
  return useMutation({
    mutationFn: async (subjectOfferingId: string) => {
      const res = await fetch(`/api/admin/subject-offerings/${subjectOfferingId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to deactivate offering");
      return json;
    },
    onMutate: () => busy.toast("Deactivating offering..."),
    onSuccess: () => {
      busy.success("Subject offering deactivated");
      queryClient.invalidateQueries({ queryKey: ["subject-offerings"] });
    },
    onError: (error: unknown) => {
      busy.error(error instanceof Error ? error.message : "Failed to deactivate offering");
    },
  });
}
