import { useQuery } from "@tanstack/react-query";

export type TeacherUnreadMessagesResponse = {
  success: boolean;
  data: {
    unread: number;
  };
};

export function useTeacherUnreadMessages() {
  return useQuery<TeacherUnreadMessagesResponse>({
    queryKey: ["teacher-unread-messages"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/messages/unread", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch unread count");
      }
      return data;
    },
    staleTime: 10_000,
  });
}
