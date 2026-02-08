/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sseManager } from "@/lib/network/sse-manager";

export function useAdminSSE() {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/admin/metrics/stream");
    const detachSSE = sseManager?.attachEventSource(es);
    const patch = (key: any[], updater: (draft: any) => any) => {
      const cur = qc.getQueryData(key);
      if (cur) qc.setQueryData(key, updater(cur));
    };

    es.addEventListener("students.updated", (e: any) => {
      const data = JSON.parse((e as MessageEvent).data);
      patch(["admin", "metrics"], (m: any) => ({
        ...m,
        students: { ...m.students, total: data.total },
      }));
    });

    es.addEventListener("teachers.updated", (e: any) => {
      const data = JSON.parse((e as MessageEvent).data);
      patch(["admin", "metrics"], (m: any) => ({
        ...m,
        teachers: { ...m.teachers, total: data.total },
      }));
    });

    es.addEventListener("subjects.updated", (e: any) => {
      const data = JSON.parse((e as MessageEvent).data);
      patch(["admin", "metrics"], (m: any) => ({
        ...m,
        subjects: { ...m.subjects, total: data.total },
      }));
    });

    es.addEventListener("period.updated", (e: any) => {
      const data = JSON.parse((e as MessageEvent).data);
      patch(["admin", "metrics"], (m: any) => ({ ...m, period: data.period }));
    });

    es.onerror = () => {
      /* optional: exponential backoff + reconnect */
    };
    return () => {
      detachSSE?.();
      es.close();
    };
  }, [qc]);
}
