// src/app/api/admin/fees/ledger/[studentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { requireFinanceStaffOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";

const ACTIVE_INVOICE_STATUSES = [
  "issued",
  "partially_paid",
  "paid",
  "overdue",
] as const;

type LedgerRow =
  | {
      id: string;
      kind: "invoice_issued";
      date: string | Date;
      title: string;
      subtitle: string | null;
      amountMinor: number;
      status: "posted";
      invoiceId: string;
    }
  | {
      id: string;
      kind: "payment" | "payment_pending";
      date: string | Date;
      title: string;
      subtitle: string | null;
      amountMinor: number;
      status: "pending" | "posted";
      invoiceId: string;
      paymentId: string;
    }
  | {
      id: string;
      kind: "credit_added";
      date: string | Date;
      title: string;
      subtitle: string | null;
      amountMinor: number;
      status: "posted";
      sourcePaymentId: string | null;
    }
  | {
      id: string;
      kind: "credit_applied";
      date: string | Date;
      title: string;
      subtitle: string | null;
      amountMinor: number;
      status: "posted";
      appliedToInvoiceId: string | null;
      appliedToLineItemId: string | null;
    };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { schoolId } = await requireFinanceStaffOrDelegatedModuleView("fees");
  await connectToDatabase();

  const { studentId } = await params;
  const { searchParams } = new URL(req.url);

  const academicPeriodId = searchParams.get("academicPeriodId"); // "all" or ObjectId
  const includePending = searchParams.get("includePending") !== "false";
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
  }
  if (
    academicPeriodId &&
    academicPeriodId !== "all" &&
    !mongoose.Types.ObjectId.isValid(academicPeriodId)
  ) {
    return NextResponse.json(
      { error: "Invalid academic period ID" },
      { status: 400 }
    );
  }

  const student = await Student.findOne({ _id: studentId, schoolId }).lean();
  if (!student)
    return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const invoiceQuery: mongoose.FilterQuery<typeof Invoice> = {
    schoolId,
    studentId: new mongoose.Types.ObjectId(studentId),
    status: { $in: ACTIVE_INVOICE_STATUSES },
  };
  if (academicPeriodId && academicPeriodId !== "all") {
    invoiceQuery.academicPeriodId = new mongoose.Types.ObjectId(
      academicPeriodId
    );
  }

  const invoices = await Invoice.find(invoiceQuery)
    .populate("academicPeriodId", "yearLabel term")
    .sort({ issueDate: -1 })
    .lean();

  const invoiceIds = invoices.map((i: any) => i._id);
  const payments = invoiceIds.length
    ? await Payment.find({
        schoolId,
        invoiceId: { $in: invoiceIds },
        $or: [
          { status: "completed" },
          includePending
            ? { status: "pending", approvalStatus: "pending" }
            : { _id: null },
        ],
      })
        .sort({ paymentDate: -1 })
        .lean()
    : [];

  const credit = await StudentCreditBalance.findOne({
    schoolId,
    studentId,
  }).lean();

  // Build rows: posted bills + completed payments + pending payments + credit entries
  const rows: LedgerRow[] = [];

  for (const inv of invoices) {
    if (inv.issueDate) {
      rows.push({
        id: `inv:${inv._id}`,
        kind: "invoice_issued",
        date: inv.issueDate,
        title: `Bill Issued • ${inv.invoiceNumber}`,
        subtitle: inv.academicPeriodId
          ? `${inv.academicPeriodId.yearLabel} • ${inv.academicPeriodId.term}`
          : null,
        amountMinor: inv.totalAmountMinor,
        status: "posted",
        invoiceId: String(inv._id),
      });
    }
  }

  for (const p of payments) {
    rows.push({
      id: `pay:${p._id}`,
      kind: p.status === "pending" ? "payment_pending" : "payment",
      date: p.paymentDate,
      title:
        p.status === "pending"
          ? `Payment Proof • Pending approval`
          : `Payment Received • ${String(p.paymentMethod).replaceAll(
              "_",
              " "
            )}`,
      subtitle: p.receiptNumber ? `Receipt: ${p.receiptNumber}` : null,
      amountMinor: p.amountMinor,
      status: p.status === "pending" ? "pending" : "posted",
      invoiceId: String(p.invoiceId),
      paymentId: String(p._id),
    });
  }

  // credit ledger lines:
  // - credit added (overpayments) as separate row
  // - credit applied (application) as separate row (filter to invoice when term chosen)
  if (credit?.entries?.length) {
    for (const e of credit.entries) {
      if (academicPeriodId && academicPeriodId !== "all") {
        // for term filter: include only (a) credits from payments on invoices in this term, or (b) applications to invoices in this term
        const invoiceIdStr = e.appliedToInvoiceId
          ? String(e.appliedToInvoiceId)
          : null;
        const isApplicationToTermInvoice =
          invoiceIdStr && invoiceIds.some((x) => String(x) === invoiceIdStr);

        const isCreditFromTermPayment =
          e.type === "credit" &&
          e.sourcePaymentId &&
          payments.some((p) => String(p._id) === String(e.sourcePaymentId));

        if (!isApplicationToTermInvoice && !isCreditFromTermPayment) continue;
      }

      if (e.type === "credit") {
        rows.push({
          id: `cr:${e.createdAt}:${e.amountMinor}:${String(
            e.sourcePaymentId || ""
          )}`,
          kind: "credit_added",
          date: e.createdAt,
          title: "Credit Added (Overpayment)",
          subtitle: e.reason || null,
          amountMinor: e.amountMinor,
          status: "posted",
          sourcePaymentId: e.sourcePaymentId ? String(e.sourcePaymentId) : null,
        });
      } else if (e.type === "application" || e.type === "apply") {
        rows.push({
          id: `crapp:${e.createdAt}:${e.amountMinor}:${String(
            e.appliedToInvoiceId || ""
          )}`,
          kind: "credit_applied",
          date: e.createdAt,
          title: "Credit Applied",
          subtitle: e.reason || null,
          amountMinor: e.amountMinor,
          status: "posted",
          appliedToInvoiceId: e.appliedToInvoiceId
            ? String(e.appliedToInvoiceId)
            : null,
          appliedToLineItemId: e.appliedToLineItemId
            ? String(e.appliedToLineItemId)
            : null,
        });
      }
    }
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const creditBalanceMinor =
    credit && !Array.isArray(credit) ? credit.balanceMinor ?? 0 : 0;

  return NextResponse.json({
    creditBalance: {
      balanceMinor: creditBalanceMinor,
    },
    ledger: rows,
    scope: academicPeriodId && academicPeriodId !== "all" ? "term" : "all_time",
  });
}
