// src/hooks/admin/useTeacherPerformance.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type PerformanceRecordDTO = {
  id: string | null;
  academicPeriod: {
    id: string;
    yearLabel: string;
    term: string;
    startDate: string;
    endDate: string;
  } | null;
  averageStudentGrade: number | null;
  studentPassRate: number | null;
  classAttendanceRate: number | null;
  teacherAttendanceRate: number | null;
  evaluations: EvaluationDTO[];
  pdCompleted: PDRecordDTO[];
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EvaluationDTO = {
  date: string;
  evaluatorId: string;
  overallRating: number;
  strengths: string[];
  areasForImprovement: string[];
  goals: string[];
  comments: string | null;
};

export type PDRecordDTO = {
  name: string;
  date: string;
  hours: number;
  certificateUrl: string | null;
};

export type PerformanceRecordsResponse = {
  success: boolean;
  data: PerformanceRecordDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PerformanceRecordResponse = {
  success: boolean;
  data: PerformanceRecordDTO;
};

export type CreateEvaluationInput = {
  academicPeriodId: string;
  overallRating: number;
  strengths?: string[];
  areasForImprovement?: string[];
  goals?: string[];
  comments?: string;
};

export type CreateEvaluationResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    evaluation: EvaluationDTO;
  };
};

export type EvaluationHistoryDTO = {
  date: string;
  evaluator: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  overallRating: number;
  strengths: string[];
  areasForImprovement: string[];
  goals: string[];
  comments: string | null;
  academicPeriod: {
    id: string;
    yearLabel: string;
    term: string;
    startDate: string;
    endDate: string;
  } | null;
  performanceId: string;
};

export type EvaluationsResponse = {
  success: boolean;
  data: EvaluationHistoryDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/**
 * useTeacherPerformance - Query hook for fetching all performance records
 */
export function useTeacherPerformance(teacherId: string, page?: number, limit?: number) {
  return useQuery<PerformanceRecordsResponse>({
    queryKey: ["teachers", "performance", teacherId, page || 1, limit || 50],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));

      const res = await fetch(
        `/api/admin/teachers/${teacherId}/performance?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher performance");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

/**
 * useTeacherPerformanceByPeriod - Query hook for fetching performance for a specific period
 */
export function useTeacherPerformanceByPeriod(
  teacherId: string,
  periodId: string
) {
  return useQuery<PerformanceRecordResponse>({
    queryKey: ["teachers", "performance", teacherId, "period", periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/performance/${periodId}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher performance for period");
      return res.json();
    },
    enabled: !!teacherId && !!periodId,
    staleTime: 30_000,
  });
}

/**
 * useCreateEvaluation - Mutation hook for recording an evaluation
 */
export function useCreateEvaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      payload,
    }: {
      teacherId: string;
      payload: CreateEvaluationInput;
    }): Promise<CreateEvaluationResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/performance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to create evaluation" }));
        throw new Error(error.error || "Failed to create evaluation");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "performance", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "evaluations", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
    },
  });
}

/**
 * useTeacherEvaluations - Query hook for fetching evaluation history
 */
export function useTeacherEvaluations(teacherId: string, page?: number, limit?: number) {
  return useQuery<EvaluationsResponse>({
    queryKey: ["teachers", "evaluations", teacherId, page || 1, limit || 50],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));

      const res = await fetch(
        `/api/admin/teachers/${teacherId}/evaluations?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher evaluations");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}
