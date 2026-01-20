// src/hooks/admin/useGrades.ts
import { useQuery } from "@tanstack/react-query";

export type GradeDTO = {
  id: string;
  name: string;
  code: string | null;
  stage: string;
  order: number;
  isActive: boolean;
};

export type GradesResponse = {
  success: boolean;
  data: GradeDTO[];
  error?: string;
};

/**
 * Hook to fetch all grades for the current school
 */
export function useGrades(isActive?: boolean) {
  return useQuery<GradesResponse>({
    queryKey: ["grades", isActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isActive !== undefined) params.set("isActive", String(isActive));

      const res = await fetch(`/api/admin/grades?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch grades");
      return res.json();
    },
    staleTime: 60_000, // Grades don't change often
  });
}
