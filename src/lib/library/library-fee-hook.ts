/**
 * V1.2 fee-module integration stub. Replace with real Fee persistence when billing is wired.
 */
export function stubLibraryFeeChargeIntent(payload: {
  schoolId: string;
  loanId: string;
  kind: "overdue_fine" | "replacement";
  amount: number;
  borrowerType: string;
  borrowerId: string;
}): void {
  if (process.env.NODE_ENV === "development") {
    console.debug("[library-fee-stub]", {
      ...payload,
      message: "Fee charge not persisted — hook for future Fee module",
    });
  }
}
