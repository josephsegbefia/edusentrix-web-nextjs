import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDailyReconciliation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: { mode?: "manual" | "scheduled"; notes?: string } = {}
    ) => {
      const query = variables.mode === "scheduled" ? "?mode=scheduled" : "";
      const res = await fetch(`/api/admin/fees/reconciliation/daily${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: variables.notes || null,
        }),
      });
      const responseJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          responseJson?.error || "Failed to run daily reconciliation"
        );
      }
      return responseJson as {
        ok: true;
        runId: string;
        mode: "manual" | "scheduled";
        inspected: number;
        updated: number;
        byStatus: Record<string, number>;
        slaHours: number;
        summary?: {
          inspectedIngestion: number;
          matched: number;
          ambiguous: number;
          unchanged: number;
          staleEscalated: number;
          paymentStatusUpdated: number;
          errors: number;
        };
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-payments"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
      qc.invalidateQueries({ queryKey: ["student-fees-ledger"] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "ingestions"] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "runs"] });
      qc.invalidateQueries({ queryKey: ["reconciliation", "alerts"] });
    },
  });
}
