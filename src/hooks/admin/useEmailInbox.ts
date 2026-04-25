import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type EmailParticipant = {
  email: string;
  name?: string | null;
  roleHint?: string | null;
};

export type EmailThreadSummary = {
  _id: string;
  subject: string;
  threadType: string;
  status: string;
  participants: EmailParticipant[];
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  unreadCount: number;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  mailboxKey: string;
};

export type EmailMessageDTO = {
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
  templateKey: string | null;
  messageClass: string | null;
  attachments?: EmailAttachmentDTO[];
};

export type EmailAttachmentDTO = {
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string | null;
  contentBase64?: string;
  url?: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function useEmailInbox(opts: {
  status?: string;
  type?: string;
  mailbox?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.type) params.set("type", opts.type);
  if (opts.mailbox) params.set("mailbox", opts.mailbox);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));

  return useQuery<{
    success: boolean;
    data: EmailThreadSummary[];
    pagination: Pagination;
  }>({
    queryKey: ["email-inbox", opts],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/inbox?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch inbox");
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function useEmailThread(threadId: string | null) {
  return useQuery<{
    success: boolean;
    data: EmailThreadSummary & { routingToken: string; createdAt: string };
  }>({
    queryKey: ["email-thread", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/threads/${threadId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch thread");
      return res.json();
    },
    enabled: !!threadId,
  });
}

export function useEmailMessages(threadId: string | null) {
  return useQuery<{
    success: boolean;
    data: EmailMessageDTO[];
    pagination: Pagination;
  }>({
    queryKey: ["email-messages", threadId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/email/threads/${threadId}/messages?limit=100`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!threadId,
  });
}

export function useUpdateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      threadId: string;
      status?: string;
      markRead?: boolean;
    }) => {
      const res = await fetch(`/api/admin/email/threads/${args.threadId}`, {
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
      queryClient.invalidateQueries({ queryKey: ["email-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["email-thread"] });
    },
  });
}

export function useComposeEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      to: string;
      toName?: string;
      subject: string;
      htmlContent: string;
      textContent?: string;
      attachments?: EmailAttachmentDTO[];
      threadType?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    }) => {
      const res = await fetch("/api/admin/email/compose", {
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
      queryClient.invalidateQueries({ queryKey: ["email-inbox"] });
    },
  });
}

export function useEmailHistory(opts: {
  entityType?: string;
  entityId?: string;
  email?: string;
  direction?: string;
  status?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts.entityType) params.set("entityType", opts.entityType);
  if (opts.entityId) params.set("entityId", opts.entityId);
  if (opts.email) params.set("email", opts.email);
  if (opts.direction) params.set("direction", opts.direction);
  if (opts.status) params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));

  return useQuery<{
    success: boolean;
    data: Array<{
      _id: string;
      direction: string;
      from: string;
      fromName: string | null;
      to: string;
      subject: string;
      status: string;
      sentAt: string | null;
      receivedAt: string | null;
      createdAt: string;
      templateKey: string | null;
      messageClass: string | null;
      trafficClass: string | null;
      failureReason: string | null;
      skipReason: string | null;
    }>;
    pagination: Pagination;
  }>({
    queryKey: ["email-history", opts],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/history?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch email history");
      return res.json();
    },
    enabled: opts.enabled !== false,
    staleTime: 30_000,
  });
}

export function useEmailBatches(opts?: { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.limit) params.set("limit", String(opts.limit));

  return useQuery<{
    success: boolean;
    data: Array<{
      _id: string;
      subject: string;
      kind: string;
      status: string;
      recipientCount: number;
      sentCount: number;
      failedCount: number;
      templateKey: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: Pagination;
  }>({
    queryKey: ["email-batches", opts],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/bulk?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function useCreateBulkSend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      subject: string;
      htmlContent: string;
      textContent?: string;
      attachments?: EmailAttachmentDTO[];
      recipients: Array<{
        email: string;
        name?: string;
        userId?: string;
        role?: string;
      }>;
    }) => {
      const res = await fetch("/api/admin/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to create bulk send");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-batches"] });
    },
  });
}

export function useCancelBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const res = await fetch(`/api/admin/email/bulk?batchId=${batchId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel batch");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-batches"] });
    },
  });
}
