import { useQuery } from "@tanstack/react-query";

export type TeacherJournalEntry = {
  id: string;
  classGroupId: string;
  className: string;
  subjectId: string | null;
  subjectName: string | null;
  date: string | null;
  title: string | null;
  content: string;
  status: "draft" | "published";
  createdAt: string | null;
};

export type TeacherJournalEntriesResponse = {
  success: boolean;
  data: {
    entries: TeacherJournalEntry[];
  };
};

export type TeacherJournalEntryFilters = {
  classGroupId?: string;
  subjectId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  enabled?: boolean;
};

export function useTeacherJournalEntries(filters?: TeacherJournalEntryFilters) {
  return useQuery<TeacherJournalEntriesResponse>({
    queryKey: ["teacher-journal-entries", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters?.subjectId) params.set("subjectId", filters.subjectId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);
      if (filters?.limit) params.set("limit", String(filters.limit));
      const res = await fetch(`/api/teacher/journal?${params.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch journal entries");
      }
      return data;
    },
    enabled: filters?.enabled ?? true,
    staleTime: 30_000,
  });
}
