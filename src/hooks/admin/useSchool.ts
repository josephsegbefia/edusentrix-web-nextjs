// src/hooks/admin/useSchool.ts
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";

export type SchoolInfo = {
  id: string;
  name: string;
  logo: string | null;
  type: "Basic" | "SHS";
  status: "pending" | "active" | "deactivated";
};

export type SchoolResponse = {
  success: boolean;
  data?: SchoolInfo;
  error?: string;
};

type SchoolQueryError = Error & { status?: number };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSchoolQueryError(
  message: string,
  status?: number
): SchoolQueryError {
  const err = new Error(message) as SchoolQueryError;
  if (typeof status === "number") {
    err.status = status;
  }
  return err;
}

/**
 * Hook to fetch current school information for any authenticated user
 * Returns additional state to handle auth loading vs school loading
 */
export function useSchool() {
  const { me, loading: authLoading } = useAuth();

  const queryEnabled = !authLoading && !!me?.schoolId;

  const query = useQuery<SchoolResponse, SchoolQueryError>({
    queryKey: ["school", me?.schoolId, me?._id],
    queryFn: async () => {
      const fetchSchool = () =>
        fetch("/api/school", {
          cache: "no-store",
        });

      let res = await fetchSchool();
      if (res.status === 401) {
        await wait(200);
        res = await fetchSchool();
      }

      const payload = (await res.json()) as SchoolResponse;
      if (!res.ok || !payload.success || !payload.data) {
        throw createSchoolQueryError(
          payload?.error || "Failed to load school",
          res.status
        );
      }

      return payload;
    },
    enabled: queryEnabled,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      const status = error?.status;
      if (status === 401) return failureCount < 2;
      if (typeof status === "number" && status >= 500) return failureCount < 2;
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(200 * 2 ** attemptIndex, 1000),
  });

  // Compute a combined loading state:
  // - Show loading if auth is still loading (we don't know schoolId yet)
  // - Show loading if auth is done and school query is actively loading
  const isLoading = authLoading || query.isLoading;

  // Track if the user has no school (auth done, no schoolId)
  const hasNoSchool = !authLoading && !!me && !me.schoolId;

  return {
    ...query,
    isLoading,
    // True if the user is authenticated but has no associated school
    hasNoSchool,
    // Also expose the raw query loading state if needed
    isQueryLoading: query.isLoading,
    // Expose whether auth is still resolving
    isAuthLoading: authLoading,
  };
}
