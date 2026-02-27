// src/hooks/admin/useStudentPromotionHistory.ts
// PROMO-FE-009: Student promotion history
import { useQuery } from "@tanstack/react-query";

export type StudentPromotionHistoryItem = {
  id: string;
  cycleId: string;
  cycleYearLabel: string;
  cycleStatus: string;
  finalOutcome: string;
  recommendedOutcome: string;
  source: string;
  reasonCodes: string[];
  reasonText: string | null;
  isApplied: boolean;
  appliedAt: string | null;
  createdAt: string;
};

export function useStudentPromotionHistory(studentId: string | null) {
  return useQuery<{
    success: boolean;
    data: StudentPromotionHistoryItem[];
  }>({
    queryKey: ["studentPromotionHistory", studentId],
    queryFn: async () => {
      if (!studentId) throw new Error("Missing student ID");
      const res = await fetch(
        `/api/admin/students/${studentId}/promotion-history`
      );
      if (!res.ok) throw new Error("Failed to fetch promotion history");
      return res.json();
    },
    enabled: !!studentId,
  });
}
