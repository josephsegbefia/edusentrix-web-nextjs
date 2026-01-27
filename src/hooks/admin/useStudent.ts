// src/hooks/admin/useStudent.ts
import { useQuery } from "@tanstack/react-query";
import { StudentDetailDTO } from "@/types/admin/student";

export function useStudent(studentId: string | null | undefined) {
  return useQuery<{ success: boolean; data: StudentDetailDTO }>({
    enabled: !!studentId,
    queryKey: ["students", "detail", studentId],
    queryFn: async () => {
      if (!studentId) throw new Error("Missing studentId");
      const res = await fetch(`/api/admin/students/${studentId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch student");
      }
      const json = (await res.json()) as {
        success: boolean;
        data: StudentDetailDTO;
      };
      return json;
    },
    staleTime: 30_000,
  });
}

/**
 * Convenience helper: returns just the DTO + status flags.
 */
export function useStudentDetail(studentId: string | null | undefined) {
  const { data, isLoading, isError, error } = useStudent(studentId);
  return {
    student: data?.data ?? null,
    isLoading,
    isError,
    error,
  };
}
