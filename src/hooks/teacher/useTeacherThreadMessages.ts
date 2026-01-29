import { useQuery } from "@tanstack/react-query";

export type MessageItem = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string | null;
  isMine: boolean;
};

export type TeacherThreadMessagesResponse = {
  success: boolean;
  data: {
    messages: MessageItem[];
  };
};

export function useTeacherThreadMessages(threadId?: string) {
  return useQuery<TeacherThreadMessagesResponse>({
    queryKey: ["teacher-thread-messages", threadId],
    queryFn: async () => {
      if (!threadId) throw new Error("Missing thread id");
      const res = await fetch(`/api/teacher/messages/threads/${threadId}/messages`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch messages");
      }
      return data;
    },
    enabled: Boolean(threadId),
    staleTime: 5_000,
  });
}
