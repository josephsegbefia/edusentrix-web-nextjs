// src/hooks/admin/useStudentFeesSummary.ts
import { useQuery } from "@tanstack/react-query";

export function useStudentFeesSummary(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-fees-summary", studentId],
    queryFn: async () => {
      if (!studentId) return null;

      const res = await fetch(
        `/api/admin/students/${studentId}/fees/summary`
      );
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!studentId,
  });
}

