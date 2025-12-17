/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/fees/ledger/[studentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFeesStaff } from "@/lib/auth/requireFeesStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";

type LedgerStatus = "posted" | "pending_approval";

type LedgerItem =
  | {
      id: string;
      type: "invoice_issued";
      status: "posted";
      date: string;
      invoiceId: string;
      invoiceNumber: string;
      termLabel?: string | null;
      amountMinor: number; // charge
      label: string;
    }
  | {
      id: string;
      type: "payment_applied";
      status: LedgerStatus;
      date: string;
      invoiceId: string;
      paymentId: string;
      receiptNumber?: string | null;
      method: string;
      appliedMinor: number; // applied to line items
      label: string;
    }
  | {
      id: string;
      type: "credit_added";
      status: "posted";
      date: string;
      paymentId?: string | null;
      amountMinor: number; // unapplied credit
      label: string;
    }
  | {
      id: string;
      type: "credit_applied";
      status: "posted";
      date: string;
      invoiceId: string;
      invoiceLineItemId?: string | null;
      amountMinor: number; // credit used to settle invoice/li
      label: string;
    };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { schoolId } = await requireFeesStaff();
  await connectToDatabase();

  const { studentId } = await params;
  const { searchParams } = new URL(req.url);
  const includePending = searchParams.get("includePending") === "true";

  // Optional: scope to one term/invoice
  const invoiceIdFilter = searchParams.get("invoiceId");

  // Validate student
  const student = await Student.findOne({ _id: studentId, schoolId })
    .select("_id firstName lastName admissionNo")
    .lean();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Invoices (issued/paid/overdue/partially_paid)
  const invoiceQuery: any = {
    schoolId,
    studentId: new mongoose.Types.ObjectId(studentId),
    status: { $ne: "draft" },
  };
  if (invoiceIdFilter)
    invoiceQuery._id = new mongoose.Types.ObjectId(invoiceIdFilter);

  const invoices = await Invoice.find(invoiceQuery)
    .sort({ issueDate: -1 })
    .select(
      "_id invoiceNumber issueDate totalAmountMinor academicPeriodId status"
    )
    .populate("academicPeriodId", "yearLabel term")
    .lean();

  const invoiceIds = invoices.map((i) => i._id);

  // Payments (completed always, and pending if includePending)
  const paymentStatuses = includePending
    ? ["completed", "pending"]
    : ["completed"];
  const payments = await Payment.find({
    schoolId,
    studentId: new mongoose.Types.ObjectId(studentId),
    invoiceId: invoiceIds.length ? { $in: invoiceIds } : undefined,
    status: { $in: paymentStatuses },
  })
    .sort({ paymentDate: -1 })
    .select(
      "_id invoiceId amountMinor paymentDate paymentMethod receiptNumber status"
    )
    .lean();

  const paymentIds = payments.map((p) => p._id);

  const allocations = paymentIds.length
    ? await PaymentAllocation.find({ paymentId: { $in: paymentIds } })
        .select(
          "_id paymentId invoiceLineItemId amountMinor installmentScheduleId installmentNumber"
        )
        .lean()
    : [];

  const allocSumByPayment = new Map<string, number>();
  for (const a of allocations) {
    const k = String(a.paymentId);
    allocSumByPayment.set(k, (allocSumByPayment.get(k) || 0) + a.amountMinor);
  }

  // Credit balance + entries
  const creditBalanceDoc = await StudentCreditBalance.findOne({
    schoolId,
    studentId,
  })
    .select("balanceMinor entries")
    .lean();

  // TypeScript incorrectly infers findOne().lean() could return an array
  // findOne() always returns a single document or null, never an array
  const creditBalance = (
    Array.isArray(creditBalanceDoc)
      ? creditBalanceDoc[0] || null
      : creditBalanceDoc
  ) as { balanceMinor: number; entries: any[] } | null;

  // Optional enrichment for credit-applied labels (line item name)
  const lineItemIds = (creditBalance?.entries || [])
    .map((e: any) => e.appliedToLineItemId)
    .filter(Boolean)
    .map((x: any) => String(x));

  const lineItems = lineItemIds.length
    ? await InvoiceLineItem.find({ _id: { $in: lineItemIds } })
        .select("_id name")
        .lean()
    : [];

  const lineItemNameById = new Map(
    lineItems.map((li) => [String(li._id), li.name])
  );

  const items: LedgerItem[] = [];

  // 1) Issued invoices
  for (const inv of invoices) {
    if (!inv.issueDate) continue;
    const ap: any = inv.academicPeriodId;
    const termLabel = ap
      ? `${ap.yearLabel ?? ""} ${ap.term ?? ""}`.trim()
      : null;

    items.push({
      id: `inv_${inv._id}`,
      type: "invoice_issued",
      status: "posted",
      date: new Date(inv.issueDate).toISOString(),
      invoiceId: String(inv._id),
      invoiceNumber: inv.invoiceNumber,
      termLabel,
      amountMinor: inv.totalAmountMinor,
      label: `Invoice issued (${inv.invoiceNumber})`,
    });
  }

  // 2) Payments (applied portion only) + Pending proof
  for (const p of payments) {
    const appliedMinor = allocSumByPayment.get(String(p._id)) || 0;

    items.push({
      id: `pay_${p._id}`,
      type: "payment_applied",
      status: p.status === "pending" ? "pending_approval" : "posted",
      date: new Date(p.paymentDate).toISOString(),
      invoiceId: String(p.invoiceId),
      paymentId: String(p._id),
      receiptNumber: p.receiptNumber || null,
      method: p.paymentMethod,
      appliedMinor,
      label:
        p.status === "pending"
          ? `Payment submitted (Pending approval)`
          : `Payment applied (${p.receiptNumber ?? "receipt"})`,
    });
  }

  // 3) Credit entries (overpayment credit lines + credit applied lines)
  for (const entry of creditBalance?.entries || []) {
    const createdAt = entry.createdAt
      ? new Date(entry.createdAt).toISOString()
      : new Date().toISOString();

    if (entry.type === "credit") {
      items.push({
        id: `cr_${entry._id ?? createdAt}`,
        type: "credit_added",
        status: "posted",
        date: createdAt,
        paymentId: entry.sourcePaymentId ? String(entry.sourcePaymentId) : null,
        amountMinor: entry.amountMinor,
        label: entry.reason || "Credit added",
      });
    }

    if (entry.type === "application") {
      const liName = entry.appliedToLineItemId
        ? lineItemNameById.get(String(entry.appliedToLineItemId))
        : null;

      items.push({
        id: `cap_${entry._id ?? createdAt}`,
        type: "credit_applied",
        status: "posted",
        date: createdAt,
        invoiceId: entry.appliedToInvoiceId
          ? String(entry.appliedToInvoiceId)
          : "",
        invoiceLineItemId: entry.appliedToLineItemId
          ? String(entry.appliedToLineItemId)
          : null,
        amountMinor: entry.amountMinor,
        label: entry.reason || `Credit applied${liName ? ` (${liName})` : ""}`,
      });
    }
  }

  // Sort newest first for UI
  items.sort((a, b) => (a.date < b.date ? 1 : -1));

  return NextResponse.json({
    student,
    creditBalance: {
      balanceMinor: creditBalance?.balanceMinor ?? 0,
    },
    ledger: items,
  });
}
