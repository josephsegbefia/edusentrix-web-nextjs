import { useMutation, useQuery } from "@tanstack/react-query";

export type ReminderChannel = "email" | "sms" | "whatsapp";

export type ReminderFilters = {
  onlyPrimaryGuardian: boolean;
  classGroupId?: string;
  maxRecipients: number;
};

export type ReminderChannelCapability = {
  enabled: boolean;
  ready: boolean;
  message: string;
};

export type ReminderPreviewResponse = {
  channel: ReminderChannel;
  capabilities: {
    email: ReminderChannelCapability;
    sms: ReminderChannelCapability;
    whatsapp: ReminderChannelCapability;
  };
  filters: {
    onlyPrimaryGuardian: boolean;
    classGroupId: string | null;
    maxRecipients: number;
  };
  summary: {
    recipientCount: number;
    studentCount: number;
    totalOutstandingMinor: number;
    overdueInvoiceCount: number;
    deliverableCount: number;
    truncated: boolean;
    totalPotentialRecipients: number;
  };
  recipients: Array<{
    userId: string;
    guardianName: string;
    email: string | null;
    phone: string | null;
    totalOutstandingMinor: number;
    overdueInvoiceCount: number;
    studentCount: number;
    students: Array<{
      studentId: string;
      studentName: string;
      classGroupName: string | null;
      outstandingMinor: number;
      overdueInvoiceCount: number;
    }>;
  }>;
};

export type ReminderSendResponse = {
  runId: string;
  channel: ReminderChannel;
  summary: {
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
    totalOutstandingMinor: number;
  };
  truncated?: boolean;
  totalPotentialRecipients?: number;
  failures?: Array<{ recipient: string; reason: string }>;
  deliveries?: Array<{
    recipientUserId: string;
    guardianName: string;
    contact: string | null;
    status: "sent" | "failed" | "skipped";
    reason?: string;
    totalOutstandingMinor: number;
    students: Array<{
      studentId: string;
      studentName: string;
      classGroupName: string | null;
      outstandingMinor: number;
    }>;
  }>;
  capabilities: {
    email: ReminderChannelCapability;
    sms: ReminderChannelCapability;
    whatsapp: ReminderChannelCapability;
  };
};

export type ReminderHistoryItem = {
  id: string;
  runId: string;
  channel: ReminderChannel;
  createdAt: string;
  actor: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
  summary: {
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
    totalOutstandingMinor: number;
  };
  deliveries: ReminderSendResponse["deliveries"];
};

function buildPreviewQuery(channel: ReminderChannel, filters: ReminderFilters) {
  const params = new URLSearchParams();
  params.set("channel", channel);
  params.set("onlyPrimaryGuardian", String(filters.onlyPrimaryGuardian));
  params.set("maxRecipients", String(filters.maxRecipients));
  if (filters.classGroupId) {
    params.set("classGroupId", filters.classGroupId);
  }
  return params.toString();
}

export function useFeeReminderPreview(
  channel: ReminderChannel,
  filters: ReminderFilters,
  enabled: boolean
) {
  return useQuery<ReminderPreviewResponse>({
    queryKey: ["admin", "fees", "reminders", "preview", channel, filters],
    queryFn: async () => {
      const query = buildPreviewQuery(channel, filters);
      const response = await fetch(`/api/admin/fees/reminders?${query}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to load reminder preview");
      }

      return json.data as ReminderPreviewResponse;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useSendFeeReminders() {
  return useMutation<
    ReminderSendResponse,
    Error,
    {
      channel: ReminderChannel;
      subject?: string;
      message?: string;
      filter: ReminderFilters;
    }
  >({
    mutationFn: async (payload) => {
      const response = await fetch("/api/admin/fees/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to send reminders");
      }

      return json.data as ReminderSendResponse;
    },
  });
}

export function useFeeReminderHistory(limit = 8, enabled = true) {
  return useQuery<ReminderHistoryItem[]>({
    queryKey: ["admin", "fees", "reminders", "history", limit],
    queryFn: async () => {
      const response = await fetch(`/api/admin/fees/reminders/history?limit=${limit}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to load reminder history");
      }
      return (json.data?.items || []) as ReminderHistoryItem[];
    },
    enabled,
    staleTime: 30_000,
  });
}
