"use client";

import { useMutation } from "@tanstack/react-query";
import type { LeoActionExecuteDTO, LeoActionKey, LeoActionPreviewDTO } from "@/lib/leo/types";

type PreviewInput = {
  actionKey: LeoActionKey;
  input?: Record<string, unknown>;
  conversationId?: string | null;
  messageId?: string | null;
  pageContextSnapshot?: Record<string, unknown> | null;
};

type ExecuteInput = {
  actionRunId: string;
  input?: Record<string, unknown>;
  pageContextSnapshot?: Record<string, unknown> | null;
};

export function usePreviewLeoAction() {
  return useMutation({
    mutationFn: async (input: PreviewInput) => {
      const res = await fetch("/api/leo/actions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionKey: input.actionKey,
          input: input.input ?? {},
          conversationId: input.conversationId ?? null,
          messageId: input.messageId ?? null,
          pageContextSnapshot: input.pageContextSnapshot ?? null,
        }),
      });
      const json = (await res.json()) as
        | { success: true; data: LeoActionPreviewDTO }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        throw new Error("error" in json && json.error ? json.error : "Failed to preview Leo action");
      }
      return json.data;
    },
    meta: { suppressGlobalBusy: true },
  });
}

export function useExecuteLeoAction() {
  return useMutation({
    mutationFn: async (input: ExecuteInput) => {
      const res = await fetch("/api/leo/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionRunId: input.actionRunId,
          confirmed: true,
          input: input.input ?? {},
          pageContextSnapshot: input.pageContextSnapshot ?? null,
        }),
      });
      const json = (await res.json()) as
        | { success: true; data: LeoActionExecuteDTO }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        throw new Error("error" in json && json.error ? json.error : "Failed to execute Leo action");
      }
      return json.data;
    },
    meta: { suppressGlobalBusy: true },
  });
}
