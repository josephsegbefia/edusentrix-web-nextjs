import { useQuery } from "@tanstack/react-query";

export type MessageThreadDetail = {
  id: string;
  subject?: string;
  student: { id: string; name: string } | null;
  participants: Array<{ id: string; name: string; role: string }>;
  lastMessageAt: string | null;
};

export type TeacherMessageThreadResponse = {
  success: boolean;
  data: {
    thread: MessageThreadDetail;
  };
};

export function useTeacherMessageThread(threadId?: string) {
  return useQuery<TeacherMessageThreadResponse>({
    queryKey: ["teacher-message-thread", threadId],
    queryFn: async () => {
      if (!threadId) throw new Error("Missing thread id");
      const res = await fetch(`/api/teacher/messages/threads/${threadId}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch thread");
      }
      return data;
    },
    enabled: Boolean(threadId),
    staleTime: 20_000,
  });
}
