/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/admin/useBulkCreateSubjects.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBusyToast } from "@/hooks/useBusyToast";
import { invalidateSetupReadiness } from "@/lib/query/invalidate-setup-readiness";

export function useBulkCreateSubjects() {
  const qc = useQueryClient();
  const busy = useBusyToast();

  return useMutation({
    mutationFn: async (names: string[]) => {
      const res = await fetch("/api/admin/subjects/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        success: boolean;
        created: number;
        skipped: number;
      }>;
    },
    onMutate: () => busy.toast("Creating subjects…"),
    onSuccess: (d) => {
      busy.success(
        `Subjects created: ${d.created}${
          d.skipped ? `, skipped: ${d.skipped}` : ""
        }`
      );
      qc.invalidateQueries({ queryKey: ["subjects"] });
      invalidateSetupReadiness(qc);
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
    },
    onError: (e: any) => busy.error(e?.message ?? "Failed to create subjects"),
  });
}
