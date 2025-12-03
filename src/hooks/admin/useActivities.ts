import { useQuery } from "@tanstack/react-query";
import { ActivityType } from "@/models/Activity";

type Activity = {
  _id: string;
  type: ActivityType;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  user: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  createdAt: string;
};

type UseActivitiesParams = {
  type?: ActivityType;
  entityType?: string;
  limit?: number;
};

export function useActivities(params: UseActivitiesParams = {}) {
  const { type, entityType, limit = 50 } = params;

  return useQuery<Activity[]>({
    queryKey: ["activities", type, entityType, limit],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (type) searchParams.set("type", type);
      if (entityType) searchParams.set("entityType", entityType);
      searchParams.set("limit", String(limit));

      const res = await fetch(`/api/admin/activities?${searchParams}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch activities");
      const json = await res.json();
      return json.data;
    },
    staleTime: 30_000,
  });
}
