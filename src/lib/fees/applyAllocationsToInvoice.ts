/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AllocationInput } from "./allocateToInvoiceLineItems";

type ApplyAllocationsOpts = {
  lineItems?: any[];
};

export function applyAllocationsToInvoice(
  invoice: any,
  allocations: AllocationInput[],
  opts?: ApplyAllocationsOpts
) {
  // Prefer explicitly provided line items (e.g. fetched from a separate collection)
  const lineItems = opts?.lineItems ?? invoice.lineItems ?? [];

  const byId = new Map<string, any>();
  for (const li of lineItems) byId.set(String(li._id), li);

  for (const a of allocations) {
    const li = byId.get(String(a.invoiceLineItemId));
    if (!li) throw new Error("Allocation references missing line item");

    const paid = li.amountPaidMinor ?? 0;
    li.amountPaidMinor = paid + a.amountMinor;

    // keep outstanding consistent
    const amountMinor = li.amountMinor ?? 0;
    li.amountOutstandingMinor = Math.max(
      0,
      amountMinor - (li.amountPaidMinor ?? 0)
    );

    // Update flags for consumers that expect these fields
    li.isFullyPaid = (li.amountOutstandingMinor ?? 0) <= 0;
    li.status = li.isFullyPaid
      ? "paid"
      : (li.amountPaidMinor ?? 0) > 0
      ? "partially_paid"
      : "pending";
  }

  // recompute invoice totals (if you already have calculateInvoiceTotals, use it instead)
  const totalAmountMinor = lineItems.reduce(
    (s: number, li: any) => s + (li.amountMinor ?? 0),
    0
  );
  const totalPaidMinor = lineItems.reduce(
    (s: number, li: any) => s + (li.amountPaidMinor ?? 0),
    0
  );
  const totalOutstandingMinor = Math.max(0, totalAmountMinor - totalPaidMinor);

  invoice.totalAmountMinor = totalAmountMinor;
  invoice.totalPaidMinor = totalPaidMinor;
  invoice.totalOutstandingMinor = totalOutstandingMinor;

  invoice.status =
    totalOutstandingMinor <= 0
      ? "paid"
      : totalPaidMinor > 0
      ? "partially_paid"
      : "unpaid";

  return invoice;
}
