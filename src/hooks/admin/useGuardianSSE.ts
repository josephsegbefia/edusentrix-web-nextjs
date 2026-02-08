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

    es.addEventListener("guardians.updated", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        // If the update is for this student, invalidate the guardians query
        if (data.studentId === studentId) {
          qc.invalidateQueries({ queryKey: ["guardians", studentId] });
          qc.invalidateQueries({ queryKey: ["student", studentId] });
        }
      } catch (err) {
        console.error("Failed to parse guardian update:", err);
      }
    });

    es.onerror = () => {
      // SSE connection error - will auto-reconnect
      // Could implement exponential backoff here if needed
    };

    return () => {
      detachSSE?.();
      es.close();
    };
  }, [studentId, qc]);
}
