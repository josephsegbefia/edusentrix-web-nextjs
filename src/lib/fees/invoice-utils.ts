// src/lib/fees/invoice-utils.ts
import type { IInvoice, IInvoiceLineItem } from "@/models/Invoice";
import type { IInvoiceLineItem as InvoiceLineItemModel } from "@/models/InvoiceLineItem";

/**
 * Generate unique invoice number
 * Format: INV-{year}-{sequence}
 */
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${sequence.toString().padStart(4, "0")}`;
}

/**
 * Calculate invoice totals from line items
 */
export function calculateInvoiceTotals(
  lineItems: Array<{ amountMinor: number; amountPaidMinor: number }>
): {
  totalAmountMinor: number;
  totalPaidMinor: number;
  totalOutstandingMinor: number;
} {
  const totalAmountMinor = lineItems.reduce((sum, item) => sum + item.amountMinor, 0);
  const totalPaidMinor = lineItems.reduce((sum, item) => sum + item.amountPaidMinor, 0);
  const totalOutstandingMinor = totalAmountMinor - totalPaidMinor;

  return {
    totalAmountMinor,
    totalPaidMinor,
    totalOutstandingMinor,
  };
}

/**
 * Calculate line item status
 */
export function calculateLineItemStatus(
  amountPaidMinor: number,
  amountMinor: number,
  dueDate: Date
): "pending" | "partially_paid" | "paid" | "overdue" {
  if (amountPaidMinor >= amountMinor) {
    return "paid";
  }
  if (amountPaidMinor > 0) {
    const isOverdue = new Date() > dueDate;
    return isOverdue ? "overdue" : "partially_paid";
  }
  const isOverdue = new Date() > dueDate;
  return isOverdue ? "overdue" : "pending";
}

/**
 * Calculate invoice status
 */
export function calculateInvoiceStatus(
  totalPaidMinor: number,
  totalAmountMinor: number,
  lineItems: Array<{ status: string }>,
  issueDate: Date | null | undefined
): "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled" {
  // If not issued, it's draft
  if (!issueDate) {
    return "draft";
  }

  // If fully paid
  if (totalPaidMinor >= totalAmountMinor) {
    return "paid";
  }

  // If no payments yet
  if (totalPaidMinor === 0) {
    return "issued";
  }

  // Check if any line item is overdue
  const hasOverdue = lineItems.some((item) => item.status === "overdue");
  if (hasOverdue) {
    return "overdue";
  }

  // Otherwise partially paid
  return "partially_paid";
}

/**
 * Update line item payment totals
 */
export function updateLineItemTotals(
  lineItem: InvoiceLineItemModel,
  allocationAmountMinor: number
): {
  amountPaidMinor: number;
  amountOutstandingMinor: number;
  isFullyPaid: boolean;
  status: "pending" | "partially_paid" | "paid" | "overdue";
} {
  const newAmountPaidMinor = lineItem.amountPaidMinor + allocationAmountMinor;
  const newAmountOutstandingMinor = lineItem.amountMinor - newAmountPaidMinor;
  const isFullyPaid = newAmountPaidMinor >= lineItem.amountMinor;

  // Note: We'll need dueDate from invoice to calculate status properly
  // For now, use a simple check
  const status = isFullyPaid
    ? "paid"
    : newAmountPaidMinor > 0
      ? "partially_paid"
      : "pending";

  return {
    amountPaidMinor: newAmountPaidMinor,
    amountOutstandingMinor: newAmountOutstandingMinor,
    isFullyPaid,
    status: status as "pending" | "partially_paid" | "paid" | "overdue",
  };
}
