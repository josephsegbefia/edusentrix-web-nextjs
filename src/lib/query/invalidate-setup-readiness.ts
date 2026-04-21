import type { QueryClient } from "@tanstack/react-query";

export const SETUP_READINESS_QUERY_KEY = ["admin", "setup-readiness"] as const;

/** Refetch school setup checklist after data that affects readiness changes. */
export function invalidateSetupReadiness(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [...SETUP_READINESS_QUERY_KEY] });
}
