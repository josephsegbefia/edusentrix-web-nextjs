import { useQuery } from "@tanstack/react-query";

export type TeacherNoticeSummary = {
  id: string;
  title: string;
  message: string;
  status: "draft" | "published" | "scheduled" | "archived";
  audience: "class" | "subject" | "school" | "custom";
  counts: {
    classGroups: number;
    subjects: number;
    students: number;
  };
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string | null;
};

export type TeacherNoticesResponse = {
  success: boolean;
  data: {
    notices: TeacherNoticeSummary[];
  };
};

export type TeacherNoticesFilters = {
  status?: string;
  audience?: string;
  search?: string;
};

export function useTeacherNotices(filters: TeacherNoticesFilters) {
  return useQuery<TeacherNoticesResponse>({
    queryKey: ["teacher-notices", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.audience) params.set("audience", filters.audience);
      if (filters.search) params.set("search", filters.search);
      const res = await fetch(`/api/teacher/notices?${params.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch notices");
      }
      return data;
    },
    staleTime: 30_000,
  });
}
