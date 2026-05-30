import { useQuery } from "@tanstack/react-query";
import type {
  AcademicProfileSubjectBreakdownDTO,
  StudentAcademicProfileDTO,
  StudentAcademicProfileBreakdownResponse,
  StudentAcademicProfileResponse,
} from "@/types/academics/student-academic-profile";

type UseStudentAcademicProfileOptions = {
  studentId: string | null | undefined;
  /** Academic period id (alias: pass as termId via options for URL compatibility). */
  periodId?: string | null;
  /** @deprecated Use periodId — kept for compatibility with existing ?termId flows. */
  termId?: string | null;
  enabled?: boolean;
};

function resolvePeriodId(periodId?: string | null, termId?: string | null) {
  return periodId ?? termId ?? null;
}

async function parseProfileResponse(res: Response) {
  const json = (await res.json().catch(() => ({}))) as StudentAcademicProfileResponse & {
    error?: string;
  };

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Failed to fetch student academic profile");
  }

  return json;
}

export function useStudentAcademicProfile({
  studentId,
  periodId,
  termId,
  enabled = true,
}: UseStudentAcademicProfileOptions) {
  const resolvedPeriodId = resolvePeriodId(periodId, termId);

  return useQuery<StudentAcademicProfileResponse>({
    enabled: enabled && !!studentId,
    queryKey: ["students", "academic-profile", studentId, resolvedPeriodId],
    queryFn: async () => {
      if (!studentId) {
        throw new Error("Missing studentId");
      }

      const params = new URLSearchParams();
      if (resolvedPeriodId) {
        params.set("periodId", resolvedPeriodId);
      }

      const res = await fetch(
        `/api/admin/students/${studentId}/academic-profile${
          params.toString() ? `?${params.toString()}` : ""
        }`,
        { cache: "no-store" }
      );

      return parseProfileResponse(res);
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

/**
 * Convenience helper: returns profile DTO + status flags.
 */
export function useStudentAcademicProfileData(
  studentId: string | null | undefined,
  periodId?: string | null,
  termId?: string | null
) {
  const query = useStudentAcademicProfile({ studentId, periodId, termId });

  return {
    profile: query.data?.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

type UseStudentAcademicProfileBreakdownOptions = {
  studentId: string | null | undefined;
  subjectId: string | null | undefined;
  periodId?: string | null;
  termId?: string | null;
  enabled?: boolean;
};

async function parseBreakdownResponse(res: Response) {
  const json = (await res.json().catch(() => ({}))) as StudentAcademicProfileBreakdownResponse & {
    error?: string;
  };

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Failed to fetch assessment breakdown");
  }

  return json;
}

/** Subject-level breakdown for the assessment evidence modal (Slice 8 API). */
export function useStudentAcademicProfileBreakdown({
  studentId,
  subjectId,
  periodId,
  termId,
  enabled = true,
}: UseStudentAcademicProfileBreakdownOptions) {
  const resolvedPeriodId = resolvePeriodId(periodId, termId);

  return useQuery<{
    success: boolean;
    data: AcademicProfileSubjectBreakdownDTO;
  }>({
    enabled: enabled && !!studentId && !!subjectId && !!resolvedPeriodId,
    queryKey: [
      "students",
      "academic-profile",
      "breakdown",
      studentId,
      resolvedPeriodId,
      subjectId,
    ],
    queryFn: async () => {
      if (!studentId || !subjectId || !resolvedPeriodId) {
        throw new Error("Missing studentId, subjectId, or periodId");
      }

      const params = new URLSearchParams({
        subjectId,
        periodId: resolvedPeriodId,
      });

      const res = await fetch(
        `/api/admin/students/${studentId}/academic-profile/breakdown?${params.toString()}`,
        { cache: "no-store" }
      );

      return parseBreakdownResponse(res);
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export type { StudentAcademicProfileDTO };
