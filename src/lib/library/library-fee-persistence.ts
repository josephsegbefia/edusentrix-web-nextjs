import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Invoice } from "@/models/Invoice";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { Student } from "@/models/Student";
import {
  calculateInvoiceStatus,
  calculateInvoiceTotals,
  calculateLineItemStatus,
  generateInvoiceNumber,
} from "@/lib/fees/invoice-utils";
import { toMinorUnits } from "@/lib/fees/money";
import { stubLibraryFeeChargeIntent } from "@/lib/library/library-fee-hook";

export async function resolveLibraryBillingAcademicPeriod(
  schoolId: mongoose.Types.ObjectId,
  session: ClientSession | null
): Promise<{ _id: mongoose.Types.ObjectId; endDate: Date } | null> {
  const q1 = { schoolId, isCurrent: true as const };
  let p = session
    ? await AcademicPeriod.findOne(q1).session(session).lean()
    : await AcademicPeriod.findOne(q1).lean();
  if (p) return { _id: p._id, endDate: p.endDate };

  const now = new Date();
  const q2 = { schoolId, startDate: { $lte: now }, endDate: { $gte: now } };
  p = session
    ? await AcademicPeriod.findOne(q2).session(session).lean()
    : await AcademicPeriod.findOne(q2).lean();
  if (p) return { _id: p._id, endDate: p.endDate };

  const latest = session
    ? await AcademicPeriod.find({ schoolId })
        .sort({ endDate: -1 })
        .limit(1)
        .session(session)
        .lean()
    : await AcademicPeriod.find({ schoolId }).sort({ endDate: -1 }).limit(1).lean();
  const row = latest[0];
  return row ? { _id: row._id, endDate: row.endDate } : null;
}

/**
 * Append a consolidated "Library charge" line item to the student's current-period invoice
 * (or create a draft invoice for that period). Runs inside the caller's transaction.
 */
export async function persistStudentLibraryReturnFees(args: {
  session: ClientSession;
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  performedBy: mongoose.Types.ObjectId;
  loanId: mongoose.Types.ObjectId;
  fineAmountMajor: number;
  replacementFeeAmountMajor: number;
}): Promise<mongoose.Types.ObjectId | null> {
  const fine = Math.max(0, args.fineAmountMajor || 0);
  const repl = Math.max(0, args.replacementFeeAmountMajor || 0);
  const totalMajor = Math.round((fine + repl) * 100) / 100;
  if (!(totalMajor > 0)) return null;

  const student = await Student.findOne({ _id: args.studentId, schoolId: args.schoolId })
    .session(args.session)
    .select("_id")
    .lean();
  if (!student) {
    stubLibraryFeeChargeIntent({
      schoolId: String(args.schoolId),
      loanId: String(args.loanId),
      kind: "overdue_fine",
      amount: totalMajor,
      borrowerType: "student",
      borrowerId: String(args.studentId),
    });
    return null;
  }

  const period = await resolveLibraryBillingAcademicPeriod(args.schoolId, args.session);
  if (!period) {
    stubLibraryFeeChargeIntent({
      schoolId: String(args.schoolId),
      loanId: String(args.loanId),
      kind: "overdue_fine",
      amount: totalMajor,
      borrowerType: "student",
      borrowerId: String(args.studentId),
    });
    return null;
  }

  let invoice = await Invoice.findOne({
    schoolId: args.schoolId,
    studentId: args.studentId,
    academicPeriodId: period._id,
    status: { $ne: "cancelled" },
  })
    .session(args.session)
    .exec();

  if (!invoice) {
    const year = new Date().getFullYear();
    const count = await Invoice.countDocuments({ schoolId: args.schoolId })
      .session(args.session);
    const invoiceNumber = generateInvoiceNumber(year, count + 1);
    const created = await Invoice.create(
      [
        {
          schoolId: args.schoolId,
          studentId: args.studentId,
          academicPeriodId: period._id,
          invoiceNumber,
          status: "draft",
          totalAmountMinor: 0,
          totalPaidMinor: 0,
          totalOutstandingMinor: 0,
          totalCreditAppliedMinor: 0,
          version: 1,
          dueDate: period.endDate,
          notes: null,
          terms: null,
        },
      ],
      { session: args.session }
    );
    invoice = created[0]!;
    await InvoiceEvent.create(
      [
        {
          invoiceId: invoice._id,
          schoolId: args.schoolId,
          studentId: args.studentId,
          eventType: "created",
          description: `Invoice ${invoiceNumber} created (library charge)`,
          performedBy: args.performedBy,
        },
      ],
      { session: args.session }
    );
  }

  const parts: string[] = [];
  if (fine > 0) parts.push(`Overdue fine: GHS ${fine.toFixed(2)}`);
  if (repl > 0) parts.push(`Replacement: GHS ${repl.toFixed(2)}`);
  const description = [`Loan ${String(args.loanId)}`, ...parts].join(" — ");

  const amountMinor = toMinorUnits(totalMajor);
  const maxOrderDoc = await InvoiceLineItem.findOne({ invoiceId: invoice._id })
    .sort({ displayOrder: -1 })
    .session(args.session)
    .select("displayOrder")
    .lean();
  const nextOrder = (maxOrderDoc?.displayOrder ?? 0) + 1;

  const [lineItem] = await InvoiceLineItem.create(
    [
      {
        invoiceId: invoice._id,
        feeStructureId: null,
        name: "Library charge",
        description,
        amountMinor,
        displayOrder: nextOrder,
        allowsInstallments: false,
        numberOfInstallments: null,
        amountPaidMinor: 0,
        amountOutstandingMinor: amountMinor,
        isFullyPaid: false,
        status: calculateLineItemStatus(0, amountMinor, invoice.dueDate),
        isAdjustment: false,
      },
    ],
    { session: args.session }
  );

  const allLineItems = await InvoiceLineItem.find({ invoiceId: invoice._id }).session(
    args.session
  );
  const totals = calculateInvoiceTotals(
    allLineItems.map((li) => ({
      amountMinor: li.amountMinor,
      amountPaidMinor: li.amountPaidMinor,
    }))
  );
  invoice.totalAmountMinor = totals.totalAmountMinor;
  invoice.totalOutstandingMinor = Math.max(totals.totalOutstandingMinor, 0);
  invoice.status = calculateInvoiceStatus(
    invoice.totalPaidMinor,
    invoice.totalAmountMinor,
    allLineItems as Array<{ status: string }>,
    invoice.issueDate
  );
  await invoice.save({ session: args.session });

  await InvoiceEvent.create(
    [
      {
        invoiceId: invoice._id,
        schoolId: args.schoolId,
        studentId: args.studentId,
        eventType: "line_item_added",
        description: `Library charge added (GHS ${totalMajor.toFixed(2)})`,
        performedBy: args.performedBy,
        relatedLineItemId: lineItem!._id,
      },
    ],
    { session: args.session }
  );

  return lineItem!._id as mongoose.Types.ObjectId;
}
