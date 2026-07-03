// src/hooks/admin/useStudents.ts
import {
  FeeStatus,
  StudentStatus,
  StudentListResponse,
  StudentListItem,
} from "@/types/admin/student";
import {
  type StudentsTabId,
  type StudentsSortBy,
  type StudentsSortOrder,
} from "@/constants/students";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

export type StudentsFilters = {
  search?: string;
  gradeId?: string;
  classGroupId?: string;
  feeStatus?: FeeStatus | "all";
  status?: StudentStatus | "all";
  performanceTier?: "all" | "top" | "at_risk";
  gender?: "male" | "female" | "all";
  enrollmentFrom?: string; // ISO date
  enrollmentTo?: string; // ISO date
};

export type UseStudentsArgs = {
  page?: number;
  limit?: number;
  tab?: StudentsTabId;
  sortBy?: StudentsSortBy;
  sortOrder?: StudentsSortOrder;
  filters?: StudentsFilters;
};

export function useStudents({
  page = 1,
  limit = 25,
  tab = "all",
  sortBy = "name",
  sortOrder = "asc",
  filters = {},
}: UseStudentsArgs) {
  return useQuery<StudentListResponse>({
    queryKey: ["students", { page, limit, tab, sortBy, sortOrder, filters }],
    queryFn: async () => {
      const params = new URLSearchParams();

      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("tab", tab);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (filters.search) params.set("search", filters.search);
      if (filters.gradeId) params.set("gradeId", filters.gradeId);
      if (filters.classGroupId)
        params.set("classGroupId", filters.classGroupId);

      if (filters.status && filters.status !== "all")
        params.set("status", filters.status);

      if (filters.gender && filters.gender !== "all")
        params.set("gender", filters.gender);

      if (filters.feeStatus && filters.feeStatus !== "all")
        params.set("feeStatus", filters.feeStatus);

      // performanceTier is still reserved for future backend logic.
      if (filters.performanceTier && filters.performanceTier !== "all")
        params.set("performanceTier", filters.performanceTier);

      if (filters.enrollmentFrom)
        params.set("enrollmentFrom", filters.enrollmentFrom);
      if (filters.enrollmentTo)
        params.set("enrollmentTo", filters.enrollmentTo);

      const res = await fetch(`/api/admin/students?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }

      const json = (await res.json()) as StudentListResponse;
      return json;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export type UseStudentsResult = ReturnType<typeof useStudents>;

/**
 * Convenience selector for just the list + pagination.
 * (Useful when a component only cares about the data and not filters.)
 */
export function useStudentListData(args: UseStudentsArgs) {
  const { data, isLoading, isError, error } = useStudents(args);
  return {
    students: (data?.data ?? []) as StudentListItem[],
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
