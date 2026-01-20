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
 */
export function useSchool() {
  const { me, isAuthenticated } = useAuth();

  return useQuery<SchoolResponse>({
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
    enabled: isAuthenticated && !!me?.schoolId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on 404 errors
  });
}
