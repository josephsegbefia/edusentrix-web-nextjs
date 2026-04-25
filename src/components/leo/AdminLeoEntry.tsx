"use client";

import * as React from "react";
import { Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { LeoActionCard } from "@/components/leo/LeoActionCard";
import { LeoConfirmDrawer } from "@/components/leo/LeoConfirmDrawer";
import { isLeoCopilotClientRuntimeEnabled } from "@/lib/leo/runtime";
import { useLeoBootstrap } from "@/hooks/leo/useLeoBootstrap";
import { useExecuteLeoAction, usePreviewLeoAction } from "@/hooks/leo/useLeoActions";
import {
  useCreateLeoConversation,
  useDeleteLeoConversation,
  useLeoConversations,
} from "@/hooks/leo/useLeoConversations";
import { useLeoMessages, useSendLeoMessage } from "@/hooks/leo/useLeoMessages";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { cn } from "@/lib/utils";
import type { LeoActionKey, LeoActionPreviewDTO } from "@/lib/leo/types";

function getRouteContext(route: string | null) {
  if (!route) {
    return {
      label: "General admin context",
      prompts: ["What can you help me with?", "What setup items are still blocking us?"],
    };
  }
  if (route.includes("/admin/classes/")) {
    return {
      label: "Class context",
      prompts: [
        "What is the timetable status for this class?",
        "Which subjects are missing teachers?",
        "Are there subject-teacher link issues?",
      ],
    };
  }
  if (route.includes("/admin/teachers/")) {
    return {
      label: "Teacher context",
      prompts: [
        "Summarize this teacher's week.",
        "Are there assignment conflicts for this teacher?",
        "How busy is this teacher?",
      ],
    };
  }
  if (route.includes("/admin/students/")) {
    return {
      label: "Student context",
      prompts: [
        "Summarize this student's risk profile.",
        "What subjects need support?",
        "How are attendance and fees affecting this student?",
      ],
    };
  }
  if (
    route.includes("/admin/finance") ||
    route.includes("/admin/fees") ||
    route.includes("/admin/overdue-report")
  ) {
    return {
      label: "Finance context",
      prompts: [
        "Summarize overdue fees.",
        "Who are the highest-risk defaulters?",
        "Break down outstanding fees by age.",
      ],
    };
  }
  if (route.includes("/admin/reports")) {
    return {
      label: "Reports context",
      prompts: [
        "Give me an executive report brief.",
        "What are the key report flags?",
        "Summarize school performance for the current period.",
      ],
    };
  }
  if (route.includes("/admin/settings")) {
    return {
      label: "Settings context",
      prompts: [
        "What happens if I change working days?",
        "What is the impact of changing the late cutoff?",
        "How does Leo access affect users?",
      ],
    };
  }
  return {
    label: "Admin context",
    prompts: [
      "What can you help me with?",
      "What setup items are still blocking us?",
      "Give me an executive report brief.",
    ],
  };
}

function getClientPageContextSnapshot() {
  if (typeof window === "undefined") {
    return { route: null, tab: null, mode: "explain" };
  }
  const url = new URL(window.location.href);
  return {
    route: url.pathname,
    tab: url.searchParams.get("tab"),
    mode: "explain",
  };
}

/**
 * Phase 1 shell: floating entry point when Leo is enabled for this user.
 * The assistant response is still a scaffold until Phase 2 tools/orchestration are wired.
 */
export function AdminLeoEntry() {
  const publicOn = isLeoCopilotClientRuntimeEnabled();
  const { data, isLoading, isError } = useLeoBootstrap();
  const [open, setOpen] = React.useState(false);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionPreview, setActionPreview] = React.useState<LeoActionPreviewDTO | null>(null);
  const [currentRoute, setCurrentRoute] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  const canUseLeo = Boolean(
    publicOn &&
      !isLoading &&
      !isError &&
      data &&
      !data.featureDisabled &&
      data.data?.access?.effectiveEnabled
  );
  const conversationsQuery = useLeoConversations(canUseLeo && open);
  const createConversation = useCreateLeoConversation();
  const deleteConversation = useDeleteLeoConversation();
  const messagesQuery = useLeoMessages(activeConversationId, canUseLeo && open);
  const sendMessage = useSendLeoMessage();
  const previewAction = usePreviewLeoAction();
  const executeAction = useExecuteLeoAction();
  const { confirm, confirmationDialog } = useConfirmationDialog();

  React.useEffect(() => {
    if (!open) return;
    setCurrentRoute(getClientPageContextSnapshot().route);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (activeConversationId) return;
    const first = conversationsQuery.data?.[0];
    if (first) setActiveConversationId(first.id);
  }, [activeConversationId, conversationsQuery.data, open]);

  React.useEffect(() => {
    if (!open || !activeConversationId || !conversationsQuery.data) return;
    const stillExists = conversationsQuery.data.some(
      (conversation) => conversation.id === activeConversationId
    );
    if (!stillExists) {
      setActiveConversationId(conversationsQuery.data[0]?.id ?? null);
    }
  }, [activeConversationId, conversationsQuery.data, open]);

  React.useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messagesQuery.data?.length, open, sendMessage.isPending]);

  if (!publicOn) {
    return null;
  }
  if (isLoading) {
    return null;
  }
  if (isError || !data || data.featureDisabled) {
    return null;
  }
  if (!data.data?.access?.effectiveEnabled) {
    return null;
  }

  async function ensureConversation() {
    const activeStillExists =
      activeConversationId &&
      (!conversationsQuery.data ||
        conversationsQuery.data.some((conversation) => conversation.id === activeConversationId));
    if (activeStillExists) return activeConversationId;
    const created = await createConversation.mutateAsync({
      sourceRoute: typeof window !== "undefined" ? window.location.pathname : null,
    });
    setActiveConversationId(created.id);
    return created.id;
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sendMessage.isPending || createConversation.isPending) return;
    setDraft("");
    setSendError(null);
    const pageContextSnapshot = getClientPageContextSnapshot();

    try {
      const conversationId = await ensureConversation();
      await sendMessage.mutateAsync({
        conversationId,
        contentText: text,
        pageContextSnapshot,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send Leo message";
      if (message.toLowerCase().includes("conversation not found")) {
        try {
          const created = await createConversation.mutateAsync({
            sourceRoute: typeof window !== "undefined" ? window.location.pathname : null,
          });
          setActiveConversationId(created.id);
          await sendMessage.mutateAsync({
            conversationId: created.id,
            contentText: text,
            pageContextSnapshot,
          });
          return;
        } catch (retryError) {
          setDraft(text);
          setSendError(
            retryError instanceof Error ? retryError.message : "Failed to send Leo message"
          );
          return;
        }
      }
      setDraft(text);
      setSendError(message);
    }
  }

  async function handleNewChat() {
    const created = await createConversation.mutateAsync({
      sourceRoute: typeof window !== "undefined" ? window.location.pathname : null,
    });
    setActiveConversationId(created.id);
    setDraft("");
    setSendError(null);
    setActionError(null);
    setActionPreview(null);
  }

  async function handleDelete() {
    if (!activeConversationId) return;
    const decision = await confirm({
      title: "Delete Leo chat?",
      description: "This removes the saved messages.",
      confirmLabel: "Delete chat",
      cancelLabel: "Keep chat",
      intent: "destructive",
      zIndexClass: "z-[110]",
    });
    if (decision !== "confirm") return;
    await deleteConversation.mutateAsync(activeConversationId);
    setActiveConversationId(null);
    setSendError(null);
    setActionError(null);
    setActionPreview(null);
  }

  async function handlePreviewAction(actionKey: LeoActionKey) {
    setActionError(null);
    const pageContextSnapshot = getClientPageContextSnapshot();
    const draftText = draft.trim();
    const input = (() => {
      if (actionKey === "draft_school_notice") {
        return {
          topic: draftText || "School update",
          details: draftText || undefined,
          audience: "school community",
        };
      }
      if (actionKey === "draft_parent_message") {
        return {
          topic: draftText || "Student update",
          details: draftText || undefined,
          studentName: "your child",
        };
      }
      if (actionKey === "preview_teacher_assignment_change") {
        return {
          reason: draftText || "Preview assignment impact",
        };
      }
      if (actionKey === "preview_homeroom_change") {
        return {
          reason: draftText || "Preview homeroom impact",
        };
      }
      if (actionKey === "preview_timetable_publish") {
        return {
          reason: draftText || "Preview timetable publish readiness",
        };
      }
      return {
        issue: draftText || routeContext.label,
      };
    })();

    try {
      const conversationId = activeConversationId || (await ensureConversation());
      const preview = await previewAction.mutateAsync({
        actionKey,
        input,
        conversationId,
        pageContextSnapshot,
      });
      setActionPreview(preview);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to preview Leo action");
    }
  }

  async function handleExecuteAction() {
    if (!actionPreview) return;
    setActionError(null);
    try {
      const result = await executeAction.mutateAsync({
        actionRunId: actionPreview.actionRunId,
        pageContextSnapshot: getClientPageContextSnapshot(),
      });
      setActionPreview(null);
      const href = result.output.href;
      if (typeof href === "string" && href) {
        window.location.href = href;
      } else if (typeof result.output.draftText === "string") {
        setDraft(result.output.draftText);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to execute Leo action");
    }
  }

  const activeConversation = conversationsQuery.data?.find(
    (conversation) => conversation.id === activeConversationId
  );
  const messages = messagesQuery.data || [];
  const routeContext = getRouteContext(currentRoute);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-100 flex max-w-[calc(100vw-2rem)] flex-col items-end sm:bottom-6 sm:right-6">
      {open ? (
        <div
          className="pointer-events-auto mb-3 flex h-[min(720px,calc(100dvh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 text-white shadow-2xl shadow-black/50 backdrop-blur-xl"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <LeoIcon className="h-4 w-4 text-amber-300" />
                <p className="font-semibold">Leo Copilot</p>
              </div>
              <p className="truncate text-xs text-white/45">
                {activeConversation?.title || "Persistent chat shell"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNewChat}
                disabled={createConversation.isPending}
                className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50"
                aria-label="New Leo chat"
              >
                {createConversation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!activeConversationId || deleteConversation.isPending}
                className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-35"
                aria-label="Delete Leo chat"
              >
                {deleteConversation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Close Leo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="shrink-0 border-b border-white/10 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/10 px-2.5 py-1 text-[11px] font-medium text-amber-100">
                <LeoIcon className="h-3.5 w-3.5 text-amber-200" />
                <span className="truncate">{routeContext.label}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/45">
                Explain mode - Investigate not enabled
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {routeContext.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setDraft(prompt);
                    setSendError(null);
                  }}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] text-white/65 transition-colors hover:border-amber-300/25 hover:bg-amber-300/10 hover:text-amber-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => void handlePreviewAction("navigate_to_fix_surface")}
                disabled={previewAction.isPending || executeAction.isPending}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] text-white/55 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Preview navigation action
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewAction("draft_school_notice")}
                disabled={previewAction.isPending || executeAction.isPending}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] text-white/55 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Draft school notice
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewAction("draft_parent_message")}
                disabled={previewAction.isPending || executeAction.isPending}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] text-white/55 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Draft parent message
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewAction("preview_teacher_assignment_change")}
                disabled={previewAction.isPending || executeAction.isPending}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] text-white/55 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Preview teacher assignment
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewAction("preview_homeroom_change")}
                disabled={previewAction.isPending || executeAction.isPending}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] text-white/55 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Preview homeroom
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewAction("preview_timetable_publish")}
                disabled={previewAction.isPending || executeAction.isPending}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] text-white/55 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Preview publish
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[110px_1fr] overflow-hidden">
            <aside className="min-h-0 overflow-y-auto border-r border-white/10 bg-white/2 p-2">
              {conversationsQuery.isLoading ? (
                <div className="flex items-center gap-2 px-2 py-3 text-xs text-white/45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading
                </div>
              ) : conversationsQuery.data?.length ? (
                <div className="space-y-1">
                  {conversationsQuery.data.slice(0, 8).map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={cn(
                        "w-full rounded-xl px-2 py-2 text-left text-[11px] leading-snug transition-colors",
                        conversation.id === activeConversationId
                          ? "bg-amber-400/15 text-amber-100"
                          : "text-white/55 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <span className="line-clamp-2">{conversation.title}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-3 text-xs text-white/40">No chats yet.</p>
              )}
            </aside>

            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
                {!activeConversationId && messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3">
                      <LeoIcon className="h-5 w-5 text-amber-200" />
                    </div>
                    <p className="text-sm font-medium">Ask Leo anything about this page.</p>
                    <p className="mt-1 max-w-[220px] text-xs text-white/45">
                      Use a quick prompt above or ask in your own words.
                    </p>
                  </div>
                ) : messagesQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/45">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading messages…
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        message.author === "user"
                          ? "ml-auto max-w-[85%] bg-amber-300 text-slate-950"
                          : "mr-auto max-w-[92%] border border-white/10 bg-white/5 text-white/85"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.contentText}</p>
                      {message.citations.length > 0 ? (
                        <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-white/45">
                          {message.citations.map((citation) => (
                            <div key={`${message.id}-${citation.ref}`}>
                              Source: {citation.label}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
                {sendMessage.isPending ? (
                  <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Leo is saving…
                  </div>
                ) : null}
                {sendError ? (
                  <div className="mr-auto rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    {sendError}
                  </div>
                ) : null}
                {actionPreview ? (
                  <LeoActionCard
                    preview={actionPreview}
                    onCancel={() => setActionPreview(null)}
                    onConfirm={() => void handleExecuteAction()}
                    isExecuting={executeAction.isPending}
                  />
                ) : null}
                {actionError ? (
                  <div className="mr-auto rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    {actionError}
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>

              <LeoConfirmDrawer
                preview={actionPreview}
                onCancel={() => setActionPreview(null)}
                onConfirm={() => void handleExecuteAction()}
                isExecuting={executeAction.isPending}
              />

              <div className="shrink-0 border-t border-white/10 p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Ask Leo…"
                    rows={2}
                    className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/35"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || sendMessage.isPending || createConversation.isPending}
                    className="rounded-xl bg-amber-300 p-2 text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send message to Leo"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-400/15 px-4 py-2.5 text-sm font-medium text-amber-100 shadow-lg shadow-black/30 backdrop-blur-sm",
          "hover:bg-amber-400/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300/60"
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <LeoIcon className="h-4 w-4 text-amber-200" />
        Ask Leo
      </button>
      {confirmationDialog}
    </div>
  );
}
