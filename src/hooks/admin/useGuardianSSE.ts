// src/hooks/admin/useGuardianSSE.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sseManager } from "@/lib/network/sse-manager";

/**
 * Hook to listen for real-time guardian updates via SSE
 * Invalidates guardians queries when changes are detected
 */
export function useGuardianSSE(studentId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!studentId) return;

    const es = new EventSource("/api/admin/metrics/stream");
    const detachSSE = sseManager?.attachEventSource(es);

    const invalidateStudentDetail = () => {
      qc.invalidateQueries({ queryKey: ["admin-student-detail", studentId] });
    };

    const onGuardiansUpdated = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        // If the update is for this student, invalidate the guardians query
        if (data.studentId === studentId) {
          qc.invalidateQueries({ queryKey: ["guardians", studentId] });
          invalidateStudentDetail();
        }
      } catch (err) {
        console.error("Failed to parse guardian update:", err);
      }
    };

    const onAttendanceUpdated = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { studentId?: string | null };
        if (!data.studentId || data.studentId === studentId) {
          invalidateStudentDetail();
        }
      } catch {
        invalidateStudentDetail();
      }
    };

    const onPaymentsOrInvoicesUpdated = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { studentId?: string | null };
        if (!data.studentId || data.studentId === studentId) {
          invalidateStudentDetail();
        }
      } catch {
        invalidateStudentDetail();
      }
    };

    es.addEventListener("guardians.updated", onGuardiansUpdated);
    es.addEventListener("attendance.updated", onAttendanceUpdated);
    es.addEventListener("payments.updated", onPaymentsOrInvoicesUpdated);
    es.addEventListener("invoices.updated", onPaymentsOrInvoicesUpdated);

    es.onerror = () => {
      // SSE connection error - will auto-reconnect
      // Could implement exponential backoff here if needed
    };

    return () => {
      es.removeEventListener("guardians.updated", onGuardiansUpdated);
      es.removeEventListener("attendance.updated", onAttendanceUpdated);
      es.removeEventListener("payments.updated", onPaymentsOrInvoicesUpdated);
      es.removeEventListener("invoices.updated", onPaymentsOrInvoicesUpdated);
      detachSSE?.();
      es.close();
    };
  }, [studentId, qc]);
}
