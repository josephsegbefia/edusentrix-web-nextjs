/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/admin/useBulkCreateClassGroups.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBusyToast } from "@/hooks/useBusyToast";
import { invalidateSetupReadiness } from "@/lib/query/invalidate-setup-readiness";

type Strategy =
  | { kind: "letters"; from: string; to: string }
  | { kind: "numbers"; from: number; to: number }
  | { kind: "custom"; names: string[] };

type GradeConfig = {
  gradeId: string;
  strategy: Strategy;
};

export function useBulkCreateClassGroups() {
  const qc = useQueryClient();
  const busy = useBusyToast();

  return useMutation({
    mutationFn: async (payload: {
      gradeConfigs: GradeConfig[];
      subjectIds?: string[];
      subjectIdsByGrade?: Record<string, string[]>;
      homeroomTeacherId?: string | null;
      capacity?: number | null;
      capacitiesByClassName?: Record<string, number | null>;
    }) => {
      const res = await fetch("/api/admin/class-groups/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ success: boolean; created: number }>;
    },
    onMutate: () => busy.toast("Creating class groups…"),
    onSuccess: (d) => {
      busy.success(`Class groups created: ${d.created}`);
      qc.invalidateQueries({ queryKey: ["class-groups"] });
      invalidateSetupReadiness(qc);
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
      qc.invalidateQueries({ queryKey: ["class-groups", "count"] });
    },
    onError: (e: any) =>
      busy.error(e?.message ?? "Failed to create class groups"),
  });
}
