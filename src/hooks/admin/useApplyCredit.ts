import { useMutation, useQueryClient } from "@tanstack/react-query";

type Payload = {
  studentId: string;
  invoiceId: string;
  amountMinor: number;
  note?: string;
  allocationMode: "auto" | "manual";
  allocations?: { invoiceLineItemId: string; amountMinor: number }[];
};

export function useApplyCredit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Payload) => {
      const res = await fetch("/api/admin/fees/credits/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to apply credit");
      return data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate all fees-related queries for instant updates
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["student-fees-ledger"] });
      qc.invalidateQueries({ queryKey: ["studentCreditBalance"] });
      qc.invalidateQueries({ queryKey: ["student-payments"] });
      qc.invalidateQueries({ queryKey: ["student-fees-summary", variables.studentId] });
      qc.invalidateQueries({ queryKey: ["student-invoices", variables.studentId] });
      qc.invalidateQueries({ queryKey: ["student-installments", variables.studentId] });
      qc.invalidateQueries({ queryKey: ["admin-student-detail", variables.studentId] });
    },
  });
}
