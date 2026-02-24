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
  paystackReference?: string;
  idempotencyKey?: string;
  allowDuplicate?: boolean;
  duplicateReason?: string;
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
      if (!res.ok) {
        const error = new Error(data?.error || "Failed to record payment");
        (error as any).code = data?.code;
        (error as any).duplicates = data?.duplicates;
        throw error;
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate all fees-related queries for instant updates
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["student-fees-ledger"] });
      qc.invalidateQueries({ queryKey: ["studentCreditBalance"] });
      qc.invalidateQueries({ queryKey: ["student-payments"] });
      qc.invalidateQueries({ queryKey: ["pending-payments"] });
      qc.invalidateQueries({ queryKey: ["student-fees-summary", variables.studentId] });
      qc.invalidateQueries({ queryKey: ["student-invoices", variables.studentId] });
      qc.invalidateQueries({ queryKey: ["student-installments", variables.studentId] });
      qc.invalidateQueries({ queryKey: ["admin-student-detail", variables.studentId] });
    },
  });
}
