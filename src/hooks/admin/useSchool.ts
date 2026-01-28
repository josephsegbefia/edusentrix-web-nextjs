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

/**
 * Hook to fetch current school information for any authenticated user
 * Returns additional state to handle auth loading vs school loading
 */
export function useSchool() {
  const { me, isAuthenticated, loading: authLoading } = useAuth();

  const queryEnabled = isAuthenticated && !!me?.schoolId;

  const query = useQuery<SchoolResponse>({
    queryKey: ["school", me?.schoolId],
    queryFn: async () => {
      const res = await fetch("/api/school", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        // Return the error response instead of throwing, so component can handle it
        return data;
      }
      return data;
    },
    enabled: queryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on 404 errors
  });

  // Compute a combined loading state:
  // - Show loading if auth is still loading (we don't know schoolId yet)
  // - Show loading if auth is done and school query is actively loading
  const isLoading = authLoading || query.isLoading;

  // Track if the user has no school (auth done, no schoolId)
  const hasNoSchool = !authLoading && isAuthenticated && !me?.schoolId;

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
