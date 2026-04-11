import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type PlatformEmailThread = {
  _id: string;
  subject: string;
  threadType: string;
  status: string;
  participants: { email: string; name?: string | null }[];
  lastMessageAt: string | null;
  unreadCount: number;
  mailboxKey: string;
  createdAt: string;
  messages?: PlatformEmailMessage[];
};

export type PlatformEmailMessage = {
  _id: string;
  direction: "inbound" | "outbound";
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  htmlBody: string | null;
  textBody: string | null;
  status: string;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
};

export type SuppressionEntry = {
  _id: string;
  email: string;
  reason: string;
  source: string;
  createdAt: string;
};

export function usePlatformInbox(opts: {
  mailbox?: string;
  status?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (opts.mailbox) params.set("mailbox", opts.mailbox);
  if (opts.status) params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));

  return useQuery<{
    success: boolean;
    data: PlatformEmailThread[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["platform-email-inbox", opts],
    queryFn: async () => {
      const res = await fetch(`/api/platform/email/inbox?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch platform inbox");
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function usePlatformThread(threadId: string | null) {
  return useQuery<{
    success: boolean;
    data: PlatformEmailThread;
  }>({
    queryKey: ["platform-email-thread", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/platform/email/threads/${threadId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch thread");
      return res.json();
    },
    enabled: !!threadId,
  });
}

export function useUpdatePlatformThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      threadId: string;
      status?: string;
      markRead?: boolean;
    }) => {
      const res = await fetch(`/api/platform/email/threads/${args.threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: args.status,
          markRead: args.markRead,
        }),
      });
      if (!res.ok) throw new Error("Failed to update thread");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-email-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["platform-email-thread"] });
    },
  });
}

export function usePlatformCompose() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      to: string;
      toName?: string;
      subject: string;
      htmlContent: string;
      textContent?: string;
      senderFamily?: "support" | "billing";
    }) => {
      const res = await fetch("/api/platform/email/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-email-inbox"] });
    },
  });
}

export function usePlatformSuppressions(opts?: { page?: number }) {
  const params = new URLSearchParams();
  if (opts?.page) params.set("page", String(opts.page));

  return useQuery<{
    success: boolean;
    data: SuppressionEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["platform-suppressions", opts],
    queryFn: async () => {
      const res = await fetch(`/api/platform/email/suppressions?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch suppressions");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useAddSuppression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; reason: string }) => {
      const res = await fetch("/api/platform/email/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add suppression");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-suppressions"] });
    },
  });
}

export function useRemoveSuppression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(
        `/api/platform/email/suppressions?email=${encodeURIComponent(email)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to remove suppression");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-suppressions"] });
    },
  });
}
