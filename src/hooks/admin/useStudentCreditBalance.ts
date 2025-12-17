import { useQuery } from "@tanstack/react-query";

export type CreditEntryOTO = {
  type: "credit" | "application";
  amountMinor: number;
  sourcePaymentId?: string | null;
  appliedToInvoiceId?: string | null;
  appliedToLineItemId?: string | null;
  reason?: string | null;
  createdAt: string;
};

export type StudentCreditBalanceDTO = {
  _id: string;
  schoolId: string;
  balanceMinor: number;
  entries: CreditEntryOTO[];
  createdAt?: string;
};

export function useStudentCreditBalance(studentId?: string) {
  return useQuery<{ creditBalance: StudentCreditBalanceDTO }>({
    queryKey: ["studentCreditBalance", studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      if (!studentId) throw new Error("Missing studnetId");
      const res = await fetch(`/api/admin/fees/credit/${studentId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch credit balance");
      const json = await res.json();
      return { creditBalance: json.creditBalance as StudentCreditBalanceDTO };
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 15_000,
  });
}
