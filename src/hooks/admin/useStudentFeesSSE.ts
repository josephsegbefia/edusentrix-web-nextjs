// src/hooks/admin/useStudentFeesSSE.ts
import { useEffect } from "react";
import { Query, useQueryClient } from "@tanstack/react-query";
import { sseManager } from "@/lib/network/sse-manager";

function matchesStudentPayments(q: Query, studentId: string) {
  const key = q.queryKey;
  return Array.isArray(key) && key[0] === "student-payments" && key[1] === studentId;
}

function matchesStudentLedger(q: Query, studentId: string) {
  const key = q.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === "student-fees-ledger" &&
    key[1] === studentId
  );
}

export function useStudentFeesSSE(opts: {
  studentId?: string;
  invoiceId?: string | null;
}) {
  const { studentId, invoiceId } = opts;
  const qc = useQueryClient();

  useEffect(() => {
    if (!studentId) return;

    const es = new EventSource("/api/admin/metrics/stream");
    const detachSSE = sseManager?.attachEventSource(es);

    const invalidateFees = () => {
      qc.invalidateQueries({
        predicate: (q) =>
          matchesStudentPayments(q, studentId) || matchesStudentLedger(q, studentId),
      });

      qc.invalidateQueries({ queryKey: ["student-fees-summary", studentId] });
      qc.invalidateQueries({ queryKey: ["studentCreditBalance", studentId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      if (invoiceId) qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    };

    es.addEventListener("payments.updated", invalidateFees);
    es.addEventListener("invoices.updated", invalidateFees);

    es.onerror = () => {
      // allow default auto-retry; avoid noisy logs
    };

    return () => {
      detachSSE?.();
      es.close();
    };
  }, [invoiceId, qc, studentId]);
}
