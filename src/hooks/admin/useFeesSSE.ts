// src/hooks/admin/useFeesSSE.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useFeesSSE() {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/admin/metrics/stream");

    es.addEventListener("fees.updated", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      // Update fee summary cache
      qc.setQueryData(["feeSummary"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          summary: {
            ...old.summary,
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

    return () => es.close();
  }, [qc]);
}
