// src/hooks/admin/useFeesSSE.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sseManager } from "@/lib/network/sse-manager";

export function useFeesSSE() {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/admin/metrics/stream");
    const detachSSE = sseManager?.attachEventSource(es);

    es.addEventListener("fees.updated", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      // Update fee summary cache
      qc.setQueryData(["feeSummary"], (old: unknown) => {
        if (!old || typeof old !== "object") return old;

        const current = old as {
          summary?: {
            totalRevenueMinor?: number;
            totalOutstandingMinor?: number;
            overdueCount?: number;
          };
          [key: string]: unknown;
        };
        if (!current.summary || typeof current.summary !== "object") {
          return old;
        }

        return {
          ...current,
          summary: {
            ...current.summary,
            totalRevenueMinor: data.totalRevenueMinor,
            totalOutstandingMinor: data.totalOutstandingMinor,
            overdueCount: data.overdueCount,
          },
        };
      });
    });

    es.addEventListener("payments.updated", () => {
      // Invalidate payments queries
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["feeSummary"] });
    });

    es.addEventListener("invoices.updated", () => {
      // Invalidate invoices queries
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["feeSummary"] });
    });

    es.onerror = () => {
      // Optional: exponential backoff + reconnect
    };

    return () => {
      detachSSE?.();
      es.close();
    };
  }, [qc]);
}
