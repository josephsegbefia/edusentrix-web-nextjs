// src/hooks/admin/useTeachers.ts
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type {
  TeacherListResponse,
  TeacherDetailResponse,
} from "@/types/admin/teacher";
import type {
  TeachersTabId,
  TeachersSortBy,
  TeachersSortOrder,
} from "@/constants/teachers";

export type TeachersFilters = {
  search?: string;
  subjectId?: string;
  classGroupId?: string; // (reserved for future “teaches class group” when TeacherAssignment lands)
};

export type UseTeachersArgs = {
  page?: number;
  limit?: number;
  tab?: TeachersTabId;
  sortBy?: TeachersSortBy;
  sortOrder?: TeachersSortOrder;
  filters?: TeachersFilters;
};

export function useTeachers({
  page = 1,
  limit = 25,
  tab = "all",
  sortBy = "name",
  sortOrder = "asc",
  filters = {},
}: UseTeachersArgs) {
  return useQuery<TeacherListResponse>({
    queryKey: ["teachers", { page, limit, tab, sortBy, sortOrder, filters }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("tab", tab);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (filters.search) params.set("search", filters.search);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.classGroupId)
        params.set("classGroupId", filters.classGroupId);

      const res = await fetch(`/api/admin/teachers?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useTeacher(teacherId: string) {
  return useQuery<TeacherDetailResponse>({
    queryKey: ["teachers", "detail", teacherId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teacher detail");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

export function useTeacherListData(args: UseTeachersArgs) {
  const { data, isLoading, isError, error } = useTeachers(args);

  return {
    teachers: data?.data ?? [],
    pagination: data?.pagination ?? {
      page: args.page ?? 1,
      limit: args.limit ?? 25,
      total: 0,
      totalPages: 0,
    },
    isLoading,
    isError,
    error,
  };
}
