"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LeoConversationDTO = {
  id: string;
  title: string;
  sourceApp: string;
  sourceRoute: string | null;
  sourceTab: string | null;
  pinned: boolean;
  archivedAt: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

type ConversationListResponse =
  | { success: true; data: LeoConversationDTO[] }
  | { success: false; error?: string };

export function useLeoConversations(enabled = true) {
  return useQuery({
    queryKey: ["leo", "conversations"],
    queryFn: async () => {
      const res = await fetch("/api/leo/conversations", { cache: "no-store" });
      const json = (await res.json()) as ConversationListResponse;
      if (!res.ok || !json.success) {
        throw new Error(
          "error" in json && json.error ? json.error : "Failed to load Leo conversations"
        );
      }
      return json.data;
    },
    enabled,
    staleTime: 15_000,
    meta: { suppressGlobalBusy: true },
  });
}

export function useCreateLeoConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: {
      title?: string;
      sourceRoute?: string | null;
      sourceTab?: string | null;
    }) => {
      const res = await fetch("/api/leo/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input || {}),
      });
      const json = (await res.json()) as
        | { success: true; data: LeoConversationDTO }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(
          "error" in json && json.error ? json.error : "Failed to create Leo conversation"
        );
      }
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leo", "conversations"] });
    },
    meta: { suppressGlobalBusy: true },
  });
}

export function useUpdateLeoConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      title?: string;
      pinned?: boolean;
      archived?: boolean;
    }) => {
      const { conversationId, ...body } = input;
      const res = await fetch(`/api/leo/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as
        | { success: true; data: LeoConversationDTO }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(
          "error" in json && json.error ? json.error : "Failed to update Leo conversation"
        );
      }
      return json.data;
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["leo", "conversations"] });
      void qc.invalidateQueries({
        queryKey: ["leo", "messages", variables.conversationId],
      });
    },
    meta: { suppressGlobalBusy: true },
  });
}

export function useDeleteLeoConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await fetch(`/api/leo/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as
        | { success: true; data: { id: string; deleted: true } }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(
          "error" in json && json.error ? json.error : "Failed to delete Leo conversation"
        );
      }
      return json.data;
    },
    onSuccess: (_data, conversationId) => {
      void qc.invalidateQueries({ queryKey: ["leo", "conversations"] });
      void qc.removeQueries({ queryKey: ["leo", "messages", conversationId] });
    },
    meta: { suppressGlobalBusy: true },
  });
}
