// src/hooks/parent/useParentActivity.ts
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";

export type ActivityType = "grade" | "fee" | "attendance" | "announcement" | "message" | "event";

export interface ParentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  ward: {
    id: string;
    studentId: string;
    name: string;
  } | null;
  createdAt: string;
  timeAgo: string;
  metadata: {
    // For 'grade' type
    gradeId?: string;
    subject?: string;
    score?: number;
    maxScore?: number;
    // For 'fee' type
    amount?: number;
    paymentId?: string;
    // For 'attendance' type
    date?: string;
    status?: "present" | "absent" | "late" | "excused";
    // For 'announcement' type
    priority?: "normal" | "important" | "urgent";
    // For 'event' type
    eventDate?: string;
    location?: string;
  };
  actionUrl?: string;
}

export interface ParentActivityResponse {
  activities: ParentActivity[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface UseParentActivityOptions {
  limit?: number;
  wardId?: string;
  type?: ActivityType;
  periodId?: string;
}

/**
 * Hook to fetch parent activity feed with pagination
 */
export function useParentActivity(options: UseParentActivityOptions = {}) {
  const { limit = 10, wardId, type, periodId } = options;

  return useQuery<ParentActivityResponse>({
    queryKey: ["parent", "activity", { limit, wardId, type, periodId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (wardId) params.set("wardId", wardId);
      if (type) params.set("type", type);
      if (periodId) params.set("periodId", periodId);

      const res = await fetch(`/api/parent/activity?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch activity");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch activity");
      return json.data as ParentActivityResponse;
    },
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch infinite scrollable activity feed
 */
export function useParentActivityInfinite(options: UseParentActivityOptions = {}) {
  const { limit = 10, wardId, type, periodId } = options;

  return useInfiniteQuery<ParentActivityResponse>({
    queryKey: ["parent", "activity", "infinite", { limit, wardId, type, periodId }],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(pageParam));
      if (wardId) params.set("wardId", wardId);
      if (type) params.set("type", type);
      if (periodId) params.set("periodId", periodId);

      const res = await fetch(`/api/parent/activity?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch activity");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch activity");
      return json.data as ParentActivityResponse;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination.hasMore) return undefined;
      return lastPage.pagination.offset + lastPage.pagination.limit;
    },
    initialPageParam: 0,
    staleTime: 30_000,
  });
}
