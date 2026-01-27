import { useQuery } from "@tanstack/react-query";

export type Activity = {
  _id: string;
  type: string;
  entityType?: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  performedBy: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  createdAt: string;
};

type FetchActivityParams = {
  type?: string;
  entityType?: string;
  limit?: number;
  page?: number;
};

export function useActivity(params: FetchActivityParams = {}) {
  const { type, entityType, limit = 50, page = 1 } = params;

  return useQuery<{
    data: Activity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["activity", type, entityType, page, limit],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (type) searchParams.set("action", type);
      if (entityType) searchParams.set("entityType", entityType);
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));

      const res = await fetch(`/api/admin/activity?${searchParams}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch activity");
      const json = await res.json();
      return json;
    },
    staleTime: 30_000,
  });
}
