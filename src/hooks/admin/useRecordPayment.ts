import { useMutation, useQueryClient } from "@tanstack/react-query";

type Payload = {
  studentId: string;
  invoiceId: string;
  amountMinor: number;
  paymentDate: string;
  paymentMethod:
    | "cash"
    | "bank_transfer"
    | "mobile_money"
    | "paystack"
    | "cheque"
    | "other";
  receiptNumber?: string;
  reference?: string;
  note?: string;
  status: "completed" | "pending_approval";
  allocationMode: "auto" | "manual";
  allocations?: { invoiceLineItemId: string; amountMinor: number }[];
};

export function useRecordPayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Payload) => {
      const res = await fetch("/api/admin/fees/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to record payment");
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate all fees-related queries for instant updates
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["studentFeesLedger"] });
      qc.invalidateQueries({ queryKey: ["studentCreditBalance"] });
      qc.invalidateQueries({ queryKey: ["student-payments"] });
      qc.invalidateQueries({ queryKey: ["student-fees-summary"] });
      qc.invalidateQueries({ queryKey: ["student-invoices"] });
      qc.invalidateQueries({ queryKey: ["student-installments"] });
    },
  });
}
