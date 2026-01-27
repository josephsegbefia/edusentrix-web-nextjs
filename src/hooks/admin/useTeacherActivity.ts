// src/hooks/admin/useTeacherActivity.ts
import { useQuery } from "@tanstack/react-query";
import type { TeacherActivityType } from "@/models/TeacherActivity";

export type TeacherActivityDTO = {
  id: string;
  type: TeacherActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, any> | null;
  createdBy: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherActivityResponse = {
  success: boolean;
  data: TeacherActivityDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ActivityFilters = {
  type?: TeacherActivityType;
  page?: number;
  limit?: number;
};

/**
 * useTeacherActivity - Query hook for fetching teacher activity log
 */
export function useTeacherActivity(
  teacherId: string,
  filters?: ActivityFilters
) {
  return useQuery<TeacherActivityResponse>({
    queryKey: [
      "teachers",
      "activity",
      teacherId,
      filters || {},
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set("type", filters.type);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));

      const res = await fetch(
        `/api/admin/teachers/${teacherId}/activity?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher activity");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}
