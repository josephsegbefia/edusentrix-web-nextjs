import { useQuery } from "@tanstack/react-query";
import type {
  AcademicProfileSubjectBreakdownDTO,
  StudentAcademicProfileDTO,
  StudentAcademicProfileBreakdownResponse,
  StudentAcademicProfileResponse,
} from "@/types/academics/student-academic-profile";

type UseParentAcademicProfileOptions = {
  wardId: string | null | undefined;
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
    throw new Error(json.error ?? "Failed to fetch ward academic profile");
  }

  return json;
}

export function useParentAcademicProfile({
  wardId,
  periodId,
  termId,
  enabled = true,
}: UseParentAcademicProfileOptions) {
  const resolvedPeriodId = resolvePeriodId(periodId, termId);

  return useQuery<StudentAcademicProfileResponse>({
    enabled: enabled && !!wardId,
    queryKey: ["parent", "ward", wardId, "academic-profile", resolvedPeriodId],
    queryFn: async () => {
      if (!wardId) {
        throw new Error("Missing wardId");
      }

      const params = new URLSearchParams();
      if (resolvedPeriodId) {
        params.set("periodId", resolvedPeriodId);
      }

      const res = await fetch(
        `/api/parent/wards/${wardId}/academic-profile${
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

export function useParentAcademicProfileData(
  wardId: string | null | undefined,
  periodId?: string | null,
  termId?: string | null
) {
  const query = useParentAcademicProfile({ wardId, periodId, termId });

  return {
    profile: query.data?.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export function useParentAcademicProfileBreakdown({
  wardId,
  subjectId,
  periodId,
  termId,
  enabled = true,
}: {
  wardId: string | null | undefined;
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
    enabled: enabled && !!wardId && !!subjectId && !!resolvedPeriodId,
    queryKey: [
      "parent",
      "ward",
      wardId,
      "academic-profile",
      "breakdown",
      resolvedPeriodId,
      subjectId,
    ],
    queryFn: async () => {
      if (!wardId || !subjectId || !resolvedPeriodId) {
        throw new Error("Missing wardId, subjectId, or periodId");
      }

      const params = new URLSearchParams({
        subjectId,
        periodId: resolvedPeriodId,
      });

      const res = await fetch(
        `/api/parent/wards/${wardId}/academic-profile/breakdown?${params.toString()}`,
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
