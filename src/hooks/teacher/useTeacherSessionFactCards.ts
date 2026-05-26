"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type FactCardDto = {
  id: string;
  fact: string;
  detail: string;
  tags: string[];
  status: "draft" | "published";
  publishedToLearn: boolean;
  publishedAt: string | null;
  createdAt: string | null;
};

type FactCardsResponse = {
  success: boolean;
  data: { cards: FactCardDto[] };
  error?: string;
};

export function useTeacherSessionFactCards(sessionId: string | null) {
  return useQuery<FactCardsResponse>({
    queryKey: ["teacher-session-fact-cards", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/fact-cards`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as FactCardsResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load fact cards");
      }
      return json;
    },
    enabled: Boolean(sessionId),
    staleTime: 15_000,
  });
}

export function useCreateSessionFactCard(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (card: { fact: string; detail: string; tags?: string[] }) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/fact-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save fact card");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-fact-cards", sessionId] });
    },
  });
}

export function useBulkCreateSessionFactCards(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cards: Array<{ fact: string; detail: string; tags?: string[] }>) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/fact-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save fact cards");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-fact-cards", sessionId] });
    },
  });
}

export function useDeleteSessionFactCard(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: string) => {
      const res = await fetch(
        `/api/teacher/lesson-sessions/${sessionId}/fact-cards?cardId=${encodeURIComponent(cardId)}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to delete fact card");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-fact-cards", sessionId] });
    },
  });
}
