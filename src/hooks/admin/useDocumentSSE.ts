// src/hooks/admin/useDocumentSSE.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sseManager } from "@/lib/network/sse-manager";

/**
 * Hook to listen for real-time document updates via SSE
 * Invalidates student detail queries when document changes are detected
 *
 * Note: This is a placeholder for when Document model is implemented
 */
export function useDocumentSSE(studentId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!studentId) return;

    const es = new EventSource("/api/admin/metrics/stream");
    const detachSSE = sseManager?.attachEventSource(es);

    es.addEventListener("documents.updated", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        // If the update is for this student, invalidate the student detail query
        if (data.studentId === studentId) {
          qc.invalidateQueries({ queryKey: ["student", studentId] });
        }
      } catch (err) {
        console.error("Failed to parse document update:", err);
      }
    });

    es.onerror = () => {
      // SSE connection error - will auto-reconnect
    };

    return () => {
      detachSSE?.();
      es.close();
    };
  }, [studentId, qc]);
}
