"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LeoMessageDTO = {
  id: string;
  conversationId: string;
  author: "user" | "assistant" | "system" | "tool";
  contentText: string;
  citations: Array<{ type: string; label: string; ref: string }>;
  status: "complete" | "error" | "cancelled";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export function useLeoMessages(conversationId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["leo", "messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await fetch(`/api/leo/conversations/${conversationId}/messages`, {
        cache: "no-store",
      });
      const json = (await res.json()) as
        | { success: true; data: LeoMessageDTO[] }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(
          "error" in json && json.error ? json.error : "Failed to load Leo messages"
        );
      }
      return json.data;
    },
    enabled: enabled && !!conversationId,
    staleTime: 5_000,
    meta: { suppressGlobalBusy: true },
  });
}

export function useSendLeoMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      contentText: string;
      pageContextSnapshot?: Record<string, unknown> | null;
    }) => {
      const res = await fetch(`/api/leo/conversations/${input.conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentText: input.contentText,
          pageContextSnapshot: input.pageContextSnapshot ?? null,
        }),
      });
      const json = (await res.json()) as
        | { success: true; data: { messages: LeoMessageDTO[] } }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(
          "error" in json && json.error ? json.error : "Failed to send Leo message"
        );
      }
      return json.data.messages;
    },
    onSuccess: (_messages, variables) => {
      void qc.invalidateQueries({
        queryKey: ["leo", "messages", variables.conversationId],
      });
      void qc.invalidateQueries({ queryKey: ["leo", "conversations"] });
    },
    meta: { suppressGlobalBusy: true },
  });
}
