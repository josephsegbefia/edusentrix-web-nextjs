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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["studentFeesLedger"] });
      qc.invalidateQueries({ queryKey: ["studentCreditBalance"] });
    },
  });
}
