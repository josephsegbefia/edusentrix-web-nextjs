import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ReconciliationSourceType = "gateway" | "bank" | "manual";
export type ReconciliationStatus = "unmatched" | "matched" | "ambiguous" | "ignored";

type ReconciliationIngestionItem = {
  id: string;
  schoolId: string;
  sourceType: ReconciliationSourceType;
  externalTxnId: string;
  normalizedReference: string | null;
  rawReference: string | null;
  amountMinor: number;
  currency: string;
  transactionDate: string;
  payerName: string | null;
  payerPhone: string | null;
  payerEmail: string | null;
  channel: string | null;
  status: ReconciliationStatus;
  matchMethod: string;
  matchedPaymentId: string | null;
  candidatePaymentIds: string[];
  confidence: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReconciliationRunItem = {
  id: string;
  mode: "manual" | "scheduled";
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  summary: {
    inspectedIngestion: number;
    matched: number;
    ambiguous: number;
    unchanged: number;
    staleEscalated: number;
    paymentStatusUpdated: number;
    errors: number;
  } | null;
  notes: string | null;
  errorMessage: string | null;
  triggeredBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
  } | null;
};

export function useReconciliationIngestions(filters?: {
  sourceType?: ReconciliationSourceType;
  status?: ReconciliationStatus;
  q?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      "reconciliation",
      "ingestions",
      filters?.sourceType || "all",
      filters?.status || "all",
      filters?.q || "",
      filters?.page || 1,
      filters?.limit || 20,
    ],
    enabled: filters?.enabled ?? true,
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (filters?.sourceType) sp.set("sourceType", filters.sourceType);
      if (filters?.status) sp.set("status", filters.status);
      if (filters?.q?.trim()) sp.set("q", filters.q.trim());
      sp.set("page", String(filters?.page || 1));
      sp.set("limit", String(filters?.limit || 20));

      const res = await fetch(
        `/api/admin/fees/reconciliation/ingestions?${sp.toString()}`,
        { cache: "no-store" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || "Failed to load reconciliation ingestions");
      }
      return payload.data as {
        items: ReconciliationIngestionItem[];
        summary: Record<ReconciliationStatus, number>;
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useReconciliationAlerts(refresh = true, enabled = true) {
  return useQuery({
    queryKey: ["reconciliation", "alerts", refresh],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("refresh", String(refresh));
      const res = await fetch(
        `/api/admin/fees/reconciliation/alerts?${params.toString()}`,
        { cache: "no-store" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || "Failed to load reconciliation alerts");
      }
      return payload.data as {
        snapshot: {
          stalePendingApprovals: number;
          staleReconciliation: number;
          ambiguousIngestion: number;
          unmatchedAging: number;
          activeAlerts: number;
        } | null;
        active: Array<{
          id: string;
          alertKey: string;
          severity: "info" | "warning" | "critical";
          title: string;
          description: string;
          queue: string | null;
          count: number;
          status: "active" | "resolved";
          firstDetectedAt: string;
          lastDetectedAt: string;
          resolvedAt: string | null;
        }>;
        recentResolved: Array<{
          id: string;
          alertKey: string;
          severity: "info" | "warning" | "critical";
          title: string;
          description: string;
          queue: string | null;
          count: number;
          status: "active" | "resolved";
          firstDetectedAt: string;
          lastDetectedAt: string;
          resolvedAt: string | null;
        }>;
      };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useIngestReconciliationData() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      sourceType: ReconciliationSourceType;
      entries: Array<{
        externalTxnId: string;
        amountMinor: number;
        transactionDate: string;
        reference?: string;
        currency?: string;
        payerName?: string;
        payerPhone?: string;
        payerEmail?: string;
        bankAccountName?: string;
        channel?: string;
        notes?: string;
        metadata?: Record<string, unknown>;
      }>;
    }) => {
      const res = await fetch("/api/admin/fees/reconciliation/ingestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Failed to ingest reconciliation records");
      }
      return data.data as {
        sourceType: ReconciliationSourceType;
        total: number;
        created: number;
        updated: number;
        unchanged: number;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation", "ingestions"] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "alerts"] });
    },
  });
}

export function useReconciliationRuns(limit = 20, enabled = true) {
  return useQuery({
    queryKey: ["reconciliation", "runs", limit],
    enabled,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/fees/reconciliation/runs?limit=${limit}`,
        { cache: "no-store" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || "Failed to fetch reconciliation runs");
      }
      return (payload.data?.runs || []) as ReconciliationRunItem[];
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMatchReconciliationItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      ingestionId: string;
      paymentId: string;
      note?: string;
    }) => {
      const res = await fetch("/api/admin/fees/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Failed to match reconciliation item");
      }
      return data.data as {
        ingestionId: string;
        paymentId: string;
        nextStatus: string;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation", "ingestions"] });
      qc.invalidateQueries({ queryKey: ["pending-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-detail"] });
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "alerts"] });
    },
  });
}

export function useUnmatchReconciliationItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { ingestionId: string; note?: string }) => {
      const res = await fetch("/api/admin/fees/reconciliation/unmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Failed to unmatch reconciliation item");
      }
      return data.data as {
        ingestionId: string;
        previousPaymentId: string | null;
        status: string;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation", "ingestions"] });
      qc.invalidateQueries({ queryKey: ["payment-detail"] });
      qc.invalidateQueries({ queryKey: ["pending-payments"] });
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "alerts"] });
    },
  });
}
