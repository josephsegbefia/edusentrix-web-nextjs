import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SessionStatus = "preparing" | "in_progress" | "review" | "locked" | "reopened";

export type SessionUser = { id: string; name?: string; email?: string } | string;

export type SessionSummary = {
  totalIngested: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  ignored: number;
  paymentStatusUpdated: number;
  aiSuggestionsAccepted: number;
  aiSuggestionsRejected: number;
  manualMatches: number;
  errors: number;
};

export type SessionTimelineEvent = {
  action: string;
  userId: string | null;
  at: string;
  reason?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ReconciliationSessionItem = {
  id: string;
  schoolId: string;
  label: string;
  status: SessionStatus;
  currentStep: string;
  createdBy: SessionUser;
  sourceTypes: string[];
  dateRange?: { startDate?: string | null; endDate?: string | null } | null;
  prepareNotes: string | null;
  importNotes: string | null;
  reviewNotes: string | null;
  finalizeNotes: string | null;
  runIds: string[];
  summary: SessionSummary;
  reportVerificationId: string | null;
  lockedBy: SessionUser | null;
  lockedAt: string | null;
  lockReason: string | null;
  reopenedBy: SessionUser | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  timeline: SessionTimelineEvent[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AISuggestion = {
  ingestionId: string;
  recommendedPaymentId: string | null;
  confidence: number;
  reasoning: string;
};

export type ReconciliationReport = {
  executiveSummary: string;
  sections: Array<{ title: string; content: string; highlights?: string[] }>;
  exceptions: string[];
  recommendations: string[];
};

export function useReconciliationSessions(filters?: {
  status?: SessionStatus;
  q?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["reconciliation", "sessions", filters],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (filters?.status) sp.set("status", filters.status);
      if (filters?.q) sp.set("q", filters.q);
      if (filters?.page) sp.set("page", String(filters.page));
      if (filters?.limit) sp.set("limit", String(filters.limit));

      const res = await fetch(`/api/admin/fees/reconciliation/sessions?${sp.toString()}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load sessions");
      return payload.data as {
        sessions: ReconciliationSessionItem[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    },
  });
}

export function useReconciliationSession(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ["reconciliation", "session", id],
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const res = await fetch(`/api/admin/fees/reconciliation/sessions/${id}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load session");
      return payload.data as ReconciliationSessionItem;
    },
  });
}

export function useCreateReconciliationSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      label: string;
      sourceTypes: string[];
      dateRange?: { startDate?: string; endDate?: string };
      prepareNotes?: string;
    }) => {
      const res = await fetch("/api/admin/fees/reconciliation/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to create session");
      return payload.data as { id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation", "sessions"] });
    },
  });
}

export function useUpdateReconciliationSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      label?: string;
      currentStep?: string;
      status?: SessionStatus;
      prepareNotes?: string | null;
      importNotes?: string | null;
      reviewNotes?: string | null;
      finalizeNotes?: string | null;
      sourceTypes?: string[];
      dateRange?: { startDate?: string | null; endDate?: string | null };
      summary?: Partial<SessionSummary>;
      runId?: string;
      timelineEvent?: {
        action: string;
        reason?: string | null;
        notes?: string | null;
        metadata?: Record<string, unknown> | null;
      };
    }) => {
      const res = await fetch(`/api/admin/fees/reconciliation/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update session");
      return payload.data as { id: string };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["reconciliation", "session", variables.id] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "sessions"] });
    },
  });
}

export function useLockReconciliationSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; reason: string; notes?: string }) => {
      const res = await fetch(
        `/api/admin/fees/reconciliation/sessions/${input.id}/lock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: input.reason, notes: input.notes }),
        }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to lock session");
      return payload;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["reconciliation", "session", variables.id] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "sessions"] });
    },
  });
}

export function useReopenReconciliationSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; reason: string; notes?: string }) => {
      const res = await fetch(
        `/api/admin/fees/reconciliation/sessions/${input.id}/reopen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: input.reason, notes: input.notes }),
        }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to reopen session");
      return payload;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["reconciliation", "session", variables.id] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "sessions"] });
    },
  });
}

export function useAIReconciliationSuggestions() {
  return useMutation({
    mutationFn: async (input: { sessionId: string; ingestionIds?: string[] }) => {
      const res = await fetch(
        `/api/admin/fees/reconciliation/sessions/${input.sessionId}/ai-suggest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingestionIds: input.ingestionIds }),
        }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to get AI suggestions");
      return payload.data as { suggestions: AISuggestion[]; message?: string };
    },
  });
}

export function useGenerateReconciliationReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; notes?: string }) => {
      const res = await fetch(
        `/api/admin/fees/reconciliation/sessions/${input.sessionId}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: input.notes }),
        }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to generate report");
      return payload.data as {
        verificationId: string;
        report: ReconciliationReport;
        sessionSummary: SessionSummary & { matchRate: number };
      };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["reconciliation", "session", variables.sessionId] });
    },
  });
}
