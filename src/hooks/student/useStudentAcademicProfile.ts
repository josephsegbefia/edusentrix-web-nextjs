import { useQuery } from "@tanstack/react-query";
import type {
  AcademicProfileSubjectBreakdownDTO,
  StudentAcademicProfileDTO,
  StudentAcademicProfileBreakdownResponse,
  StudentAcademicProfileResponse,
} from "@/types/academics/student-academic-profile";

type UseStudentAcademicProfileOptions = {
  periodId?: string | null;
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
    throw new Error(json.error ?? "Failed to fetch your academic profile");
  }

  return json;
}

export function useStudentAcademicProfile({
  periodId,
  termId,
  enabled = true,
}: UseStudentAcademicProfileOptions = {}) {
  const resolvedPeriodId = resolvePeriodId(periodId, termId);

  return useQuery<StudentAcademicProfileResponse>({
    enabled,
    queryKey: ["student", "academic-profile", resolvedPeriodId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resolvedPeriodId) {
        params.set("periodId", resolvedPeriodId);
      }

      const res = await fetch(
        `/api/student/academic-profile${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" }
      );

      return parseProfileResponse(res);
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useStudentAcademicProfileData(
  periodId?: string | null,
  termId?: string | null
) {
  const query = useStudentAcademicProfile({ periodId, termId });

  return {
    profile: query.data?.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export function useStudentAcademicProfileBreakdown({
  subjectId,
  periodId,
  termId,
  enabled = true,
}: {
  subjectId: string | null | undefined;
  periodId?: string | null;
  termId?: string | null;
  enabled?: boolean;
}) {
  const resolvedPeriodId = resolvePeriodId(periodId, termId);

  return useQuery<{
    success: boolean;
    data: AcademicProfileSubjectBreakdownDTO;
  }>({
    enabled: enabled && !!subjectId && !!resolvedPeriodId,
    queryKey: [
      "student",
      "academic-profile",
      "breakdown",
      resolvedPeriodId,
      subjectId,
    ],
    queryFn: async () => {
      if (!subjectId || !resolvedPeriodId) {
        throw new Error("Missing subjectId or periodId");
      }

      const params = new URLSearchParams({
        subjectId,
        periodId: resolvedPeriodId,
      });

      const res = await fetch(
        `/api/student/academic-profile/breakdown?${params.toString()}`,
        { cache: "no-store" }
      );

      const json = (await res.json().catch(() => ({}))) as StudentAcademicProfileBreakdownResponse & {
        error?: string;
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch assessment breakdown");
      }

      return json;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export type { StudentAcademicProfileDTO };
