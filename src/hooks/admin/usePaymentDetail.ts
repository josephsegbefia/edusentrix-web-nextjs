/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";

export function usePaymentDetail(paymentId: string | null) {
  return useQuery({
    queryKey: ["payment-detail", paymentId],
    enabled: Boolean(paymentId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/fees/payments/${paymentId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch payment");
      return res.json() as Promise<{ payment: any }>;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}
