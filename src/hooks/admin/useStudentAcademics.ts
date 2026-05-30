// src/hooks/admin/useStudentAcademics.ts
import { useQuery } from "@tanstack/react-query";
import type { StudentAcademicsDTO } from "@/types/admin/student-academics";

type UseStudentAcademicsOptions = {
  studentId: string | null | undefined;
  termId?: string | null;
  enabled?: boolean;
};

export function useStudentAcademics({
  studentId,
  termId,
  enabled = true,
}: UseStudentAcademicsOptions) {
  return useQuery<{ success: boolean; data: StudentAcademicsDTO }>({
    enabled: enabled && !!studentId,
    queryKey: ["students", "academics", studentId, termId ?? null],
    queryFn: async () => {
      if (!studentId) throw new Error("Missing studentId");

      const params = new URLSearchParams();
      if (termId) params.set("termId", termId);

      const res = await fetch(
        `/api/admin/students/${studentId}/academics${
          params.toString() ? `?${params.toString()}` : ""
        }`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch student academics");
      }

      return (await res.json()) as {
        success: boolean;
        data: StudentAcademicsDTO;
      };
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

/**
 * Convenience helper: returns just the DTO + status flags.
 */
export function useStudentAcademicsData(
  studentId: string | null | undefined,
  termId?: string | null,
  options?: { enabled?: boolean }
) {
  const { data, isLoading, isError, error } = useStudentAcademics({
    studentId,
    termId,
    enabled: options?.enabled,
  });

  return {
    academics: data?.data ?? null,
    isLoading,
    isError,
    error,
  };
}
