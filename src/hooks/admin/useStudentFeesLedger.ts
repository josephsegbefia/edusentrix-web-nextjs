/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";

export type LedgerScope = "term" | "all";

export type FeesLedgerRow = any;

export function useStudentFeesLedger(args: {
  studentId?: string;
  scope: LedgerScope;
  includePending: boolean;
  invoiceId?: string | null;
  academicPeriodId?: string | null;
}) {
  const { studentId, scope, includePending, invoiceId, academicPeriodId } =
    args;

  return useQuery<{
    creditBalance: { balanceMinor: number };
    ledger: FeesLedgerRow[];
  }>({
    queryKey: [
      "fees-ledger",
      studentId,
      scope,
      includePending,
      invoiceId,
      academicPeriodId,
    ],
    enabled: Boolean(studentId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!studentId) throw new Error("Missing studentId");

      const params = new URLSearchParams();
      params.set("scope", scope);
      params.set("includePending", includePending ? "true" : "false");
      if (scope === "term" && invoiceId) params.set("invoiceId", invoiceId);
      if (scope === "term" && !invoiceId && academicPeriodId)
        params.set("academicPeriodId", academicPeriodId);

      const res = await fetch(
        `/api/admin/fees/ledger/${studentId}?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch fees ledger");
      return res.json();
    },
  });
}
