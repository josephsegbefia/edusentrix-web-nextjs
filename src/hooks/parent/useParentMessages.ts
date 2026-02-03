// src/hooks/parent/useParentMessages.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ThreadParticipant {
  userId: string;
  role: string;
  name?: string;
  photoUrl?: string | null;
}

export interface MessageThread {
  id: string;
  subject: string;
  studentId: string | null;
  studentName: string | null;
  participants: ThreadParticipant[];
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface ThreadMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  isOwn: boolean;
  body: string;
  attachments: Array<{ name: string; url: string; type: string }>;
  createdAt: string;
}

export interface ThreadDetail {
  thread: MessageThread;
  messages: ThreadMessage[];
}

export interface ParentMessagesDTO {
  threads: MessageThread[];
  totalUnread: number;
}

/**
 * Hook to fetch message threads
 */
export function useParentMessages() {
  return useQuery<ParentMessagesDTO>({
    queryKey: ["parent", "messages"],
    queryFn: async () => {
      const res = await fetch("/api/parent/messages", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch messages");
      return json.data as ParentMessagesDTO;
    },
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch a single thread with messages
 */
export function useParentThread(threadId: string | null) {
  return useQuery<ThreadDetail>({
    queryKey: ["parent", "messages", threadId],
    queryFn: async () => {
      if (!threadId) throw new Error("Thread ID required");
      const res = await fetch(`/api/parent/messages/${threadId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch thread");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch thread");
      return json.data as ThreadDetail;
    },
    enabled: !!threadId,
    staleTime: 10_000,
  });
}

/**
 * Hook to send a message in a thread
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, message }: { threadId: string; message: string }) => {
      const res = await fetch(`/api/parent/messages/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to send message");
      return json.data;
    },
    onSuccess: (_, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ["parent", "messages", threadId] });
      queryClient.invalidateQueries({ queryKey: ["parent", "messages"] });
    },
  });
}

/**
 * Hook to create a new conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipientId,
      recipientRole,
      studentId,
      subject,
      message,
    }: {
      recipientId: string;
      recipientRole: string;
      studentId?: string;
      subject?: string;
      message: string;
    }) => {
      const res = await fetch("/api/parent/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, recipientRole, studentId, subject, message }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to create conversation");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent", "messages"] });
    },
  });
}

/**
 * Hook to get unread message count
 */
export function useUnreadMessageCount() {
  return useQuery<number>({
    queryKey: ["parent", "messages", "unreadCount"],
    queryFn: async () => {
      const res = await fetch("/api/parent/messages", { cache: "no-store" });
      if (!res.ok) return 0;
      const json = await res.json();
      return json.data?.totalUnread || 0;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
