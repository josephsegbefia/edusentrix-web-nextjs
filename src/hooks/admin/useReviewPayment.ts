/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function postAction(
  paymentId: string,
  action: string,
  reviewNotes?: string
) {
  const res = await fetch(`/api/admin/fees/payments/${paymentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reviewNotes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

export function useReviewPayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (args: {
      paymentId: string;
      action: "approve_proof" | "reject_proof" | "reverse";
      reviewNotes?: string;
    }) => postAction(args.paymentId, args.action, args.reviewNotes),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["pending-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-detail"] });
      qc.invalidateQueries({ queryKey: ["student-fees-ledger"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
}
