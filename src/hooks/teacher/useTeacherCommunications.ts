import { useQuery } from "@tanstack/react-query";

export type TeacherCommunicationStatus =
  | "draft"
  | "scheduled"
  | "queued"
  | "sending"
  | "sent"
  | "partially_sent"
  | "failed"
  | "cancelled"
  | "archived";

export type TeacherCommunicationSummary = {
  id: string;
  title: string;
  bodyText: string;
  status: TeacherCommunicationStatus;
  priority: "low" | "normal" | "high" | "urgent";
  channels: Array<"in_app" | "email">;
  audience: {
    type: string;
    classGroupIds?: string[];
    targetRoles?: string[];
  };
  scheduledFor: string | null;
  sentAt: string | null;
  stats: {
    audienceCount: number;
    deliveryCount: number;
    queuedCount: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    skippedCount: number;
  } | null;
  createdAt: string | null;
};

export type TeacherCommunicationsResponse = {
  success: boolean;
  data: {
    items: TeacherCommunicationSummary[];
    pagination: {
      total: number;
      limit: number;
      page: number;
      totalPages: number;
    };
  };
};

export type TeacherCommunicationsFilters = {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export function useTeacherCommunications(filters: TeacherCommunicationsFilters) {
  return useQuery<TeacherCommunicationsResponse>({
    queryKey: ["teacher-communications", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const res = await fetch(`/api/teacher/communications?${params.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch communications");
      }
      return data;
    },
    staleTime: 30_000,
  });
}
