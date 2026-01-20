// src/hooks/admin/useTeacherWorkload.ts
import { useQuery } from "@tanstack/react-query";

export type TeacherWorkloadData = {
  periodId: string | null;
  current: {
    classes: number;
    students: number;
    workloadHours: number;
    assignments: number;
  };
  capacity: {
    maxClasses: number | null;
    maxStudents: number | null;
    classUtilization: number | null;
    studentUtilization: number | null;
  };
  comparison: {
    schoolAvgClasses: number;
    isAboveAverage: boolean;
    differenceFromAverage: number;
  };
  warnings: {
    isOverCapacity: boolean;
    isAboveAverage: boolean;
  };
};

export type TeacherWorkloadResponse = {
  success: boolean;
  data: TeacherWorkloadData;
};

/**
 * useTeacherWorkload - Query hook for fetching teacher workload metrics
 */
export function useTeacherWorkload(teacherId: string, periodId?: string) {
  return useQuery<TeacherWorkloadResponse>({
    queryKey: ["teacher-workload", teacherId, periodId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) {
        params.set("periodId", periodId);
      }
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/workload?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to fetch workload" }));
        throw new Error(error.error || "Failed to fetch workload");
      }
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000, // 30 seconds
  });
}
