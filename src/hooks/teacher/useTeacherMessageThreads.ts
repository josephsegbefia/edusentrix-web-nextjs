import { useQuery } from "@tanstack/react-query";

export type MessageThreadSummary = {
  id: string;
  subject?: string;
  student: { id: string; name: string } | null;
  participants: Array<{ id: string; name: string; role: string }>;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unreadCount: number;
};

export type TeacherMessageThreadsResponse = {
  success: boolean;
  data: {
    threads: MessageThreadSummary[];
  };
};

export function useTeacherMessageThreads() {
  return useQuery<TeacherMessageThreadsResponse>({
    queryKey: ["teacher-message-threads"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/messages/threads", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch message threads");
      }
      return data;
    },
    staleTime: 20_000,
  });
}
