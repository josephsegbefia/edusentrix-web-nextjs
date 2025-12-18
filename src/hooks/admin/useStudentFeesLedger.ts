/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";

export type LedgerScope = string | "all"; // academicPeriodId or "all"

export function useStudentFeesLedger(
  studentId: string | undefined,
  academicPeriodId: LedgerScope | null,
  includePending: boolean
) {
  return useQuery({
    queryKey: [
      "student-fees-ledger",
      studentId,
      academicPeriodId,
      includePending,
    ],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("academicPeriodId", academicPeriodId || "all");
      sp.set("includePending", includePending ? "true" : "false");

      const res = await fetch(
        `/api/admin/fees/ledger/${studentId}?${sp.toString()}`,
        {
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error("Failed to fetch ledger");
      return res.json() as Promise<{
        creditBalance: { balanceMinor: number };
        ledger: any[];
        scope: "term" | "all_time";
      }>;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
