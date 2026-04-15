/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/fees/payments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import {
  calculateInvoiceTotals,
  calculateInvoiceStatus,
} from "@/lib/fees/invoice-utils";
import { applyPaymentAllocations } from "@/lib/fees/applyPaymentAllocation";
import { recordFeePaymentInLedger } from "@/lib/finance/writeLedgerEntry";
import { Student } from "@/models/Student";
import { User } from "@/models/User";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildFinanceStaffAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";

function buildActorName(actor: any) {
  if (!actor) return null;
  const fullName = String(
    actor.name || `${actor.firstName || ""} ${actor.lastName || ""}`.trim()
  ).trim();
  return fullName || actor.email || null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  const payment = await Payment.findOne({ _id: id, schoolId })
    .populate("studentId", "firstName lastName admissionNo")
    .populate({
      path: "invoiceId",
      select: "invoiceNumber academicPeriodId issueDate dueDate",
      populate: { path: "academicPeriodId", select: "yearLabel term isCurrent" },
    })
    .populate("receivedBy", "name firstName lastName email")
    .populate("reviewedBy", "name firstName lastName email")
    .lean();

  if (!payment)
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const allocations = await PaymentAllocation.find({
    paymentId: new mongoose.Types.ObjectId(id),
  })
    .populate("invoiceLineItemId", "name amountMinor")
    .lean();

  const timeline = await PaymentAuditEvent.find({
    schoolId,
    paymentId: new mongoose.Types.ObjectId(id),
  })
    .sort({ createdAt: -1 })
    .populate("actorId", "name firstName lastName email")
    .lean();

  return NextResponse.json({
    payment: {
      ...payment,
      allocations,
      timeline: timeline.map((event: any) => ({
        ...event,
        _id: String(event._id),
        paymentId: String(event.paymentId),
        invoiceId: event.invoiceId ? String(event.invoiceId) : null,
        studentId: event.studentId ? String(event.studentId) : null,
        actorLabel: event.actorId
          ? buildActorName(event.actorId)
          : event.actorName || null,
      })),
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId, roles } = await requireFinanceStaff();
  await connectToDatabase();

  const actorUser = await User.findById(userId).select("email name").lean();

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }
  const body = await req.json();
  const { action, reviewNotes } = body as {
    action: "approve_proof" | "reject_proof" | "reverse";
    reviewNotes?: string;
  };
  if (!["approve_proof", "reject_proof", "reverse"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const auditStreamKey = `school:${String(schoolId)}:finance`;
  const auditContext = (idempotencySuffix: string) =>
    buildFinanceStaffAuditContext(req, {
      userId: userId as mongoose.Types.ObjectId,
      schoolId: schoolId as mongoose.Types.ObjectId,
      roles,
      actorEmail: (actorUser as { email?: string } | null)?.email ?? null,
      actorName: (actorUser as { name?: string } | null)?.name ?? null,
      idempotencyKey: resolveAuditIdempotencyKey(req, idempotencySuffix),
    });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await Payment.findOne({ _id: id, schoolId }).session(
      session
    );
    if (!payment) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const invoice = await Invoice.findOne({
      _id: payment.invoiceId,
      schoolId,
    }).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (action === "approve_proof") {
      if (
        payment.status !== "pending" ||
        payment.approvalStatus !== "pending"
      ) {
        await session.abortTransaction();
        return NextResponse.json(
          { error: "Payment is not pending approval" },
          { status: 400 }
        );
      }

      // Post allocations from requestedAllocations
      const requested = (payment.requestedAllocations || []).map((a: any) => ({
        invoiceLineItemId: String(a.invoiceLineItemId),
        amountMinor: a.amountMinor,
        installmentScheduleId: a.installmentScheduleId
          ? String(a.installmentScheduleId)
          : null,
        installmentNumber: a.installmentNumber ?? null,
        notes: a.notes ?? null,
      }));

      if (!requested.length) {
        await session.abortTransaction();
        return NextResponse.json(
          { error: "No requested allocations to approve" },
          { status: 400 }
        );
      }

      const { overpaymentMinor } = await applyPaymentAllocations({
        session,
        paymentId: payment._id,
        invoiceId: invoice._id,
        allocations: requested,
      });

      // credit overpayment
      if (overpaymentMinor > 0) {
        let credit = await StudentCreditBalance.findOne({
          schoolId,
          studentId: invoice.studentId,
        }).session(session);

        if (!credit) {
          [credit] = await StudentCreditBalance.create(
            [
              {
                schoolId,
                studentId: invoice.studentId,
                balanceMinor: 0,
                entries: [],
              },
            ],
            { session }
          );
        }

        credit.balanceMinor += overpaymentMinor;
        credit.entries.push({
          type: "credit",
          amountMinor: overpaymentMinor,
          sourcePaymentId: payment._id,
          reason: `Overpayment from payment ${payment.receiptNumber}`,
          createdAt: new Date(),
        });
        await credit.save({ session });
      }

      // recalc invoice totals
      const lineItems = await InvoiceLineItem.find({
        invoiceId: invoice._id,
      }).session(session);
      const totals = calculateInvoiceTotals(
        lineItems.map((li) => ({
          amountMinor: li.amountMinor,
          amountPaidMinor: li.amountPaidMinor,
        }))
      );

      invoice.totalPaidMinor = totals.totalPaidMinor;
      invoice.totalOutstandingMinor = totals.totalOutstandingMinor;
      invoice.status = calculateInvoiceStatus(
        invoice.totalPaidMinor,
        invoice.totalAmountMinor,
        lineItems,
        invoice.issueDate
      );
      if (invoice.status === "paid") invoice.paidDate = new Date();
      if (invoice.status !== "paid") invoice.paidDate = null;

      await invoice.save({ session });

      payment.status = "completed";
      payment.approvalStatus = "approved";
      payment.reviewedBy = userId || null;
      payment.reviewedAt = new Date();
      payment.reviewNotes = reviewNotes || null;
      payment.receivedBy = userId || null;
      await payment.save({ session });

      await InvoiceEvent.create(
        [
          {
            invoiceId: invoice._id,
            schoolId,
            studentId: invoice.studentId,
            eventType: "payment_recorded",
            description: `Payment proof approved • ${payment.receiptNumber}`,
            performedBy: userId || null,
            relatedPaymentId: payment._id,
          },
        ],
        { session }
      );

      await PaymentAuditEvent.create(
        [
          {
            schoolId,
            paymentId: payment._id,
            invoiceId: invoice._id,
            studentId: invoice.studentId,
            eventType: "payment_approved",
            title: "Payment approved",
            description:
              reviewNotes?.trim() ||
              `Payment proof approved${
                payment.receiptNumber ? ` (${payment.receiptNumber})` : ""
              }.`,
            actorId: userId ? new mongoose.Types.ObjectId(userId) : null,
            metadata: {
              approvalStatus: "approved",
              paymentStatus: payment.status,
            },
          },
        ],
        { session }
      );

      await writeTransactionalAuditEvent(session, {
        actionCode: "payment.proof_approved",
        scopeType: "school",
        scopeId: String(schoolId),
        result: "succeeded",
        target: {
          targetEntityType: "Payment",
          targetEntityId: payment._id,
          secondaryEntityType: "Invoice",
          secondaryEntityId: invoice._id,
        },
        context: auditContext(`payment.proof_approved:${id}`),
        payload: {
          metadata: {
            amountMinor: payment.amountMinor,
            receiptNumber: payment.receiptNumber ?? null,
            approvalStatus: payment.approvalStatus,
            paymentStatus: payment.status,
          },
        },
        streamKey: auditStreamKey,
      });

      await session.commitTransaction();

      // Write to Financial Center ledger
      try {
        interface StudentLean {
          _id: mongoose.Types.ObjectId;
          firstName: string;
          lastName: string;
          guardians?: Array<{
            name?: string;
            email?: string;
            phone?: string;
          }>;
        }
        const student = await Student.findById(invoice.studentId)
          .select("firstName lastName guardians")
          .lean() as StudentLean | null;

        const primaryGuardian = student?.guardians?.[0];

        await recordFeePaymentInLedger({
          schoolId: String(schoolId),
          paymentId: String(payment._id),
          amountMinor: payment.amountMinor,
          currency: "GHS",
          paymentMethod: payment.paymentMethod,
          paymentReference: payment.paystackReference || payment.receiptNumber || null,
          studentId: String(invoice.studentId),
          studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown Student",
          guardianName: primaryGuardian?.name || null,
          guardianEmail: primaryGuardian?.email || null,
          guardianPhone: primaryGuardian?.phone || null,
          invoiceNumber: invoice.invoiceNumber || null,
          description: `Fee payment for ${invoice.invoiceNumber || "invoice"} (approved)`,
          academicPeriodId: invoice.academicPeriodId ? String(invoice.academicPeriodId) : null,
          occurredAt: payment.paymentDate,
          createdBy: userId ? String(userId) : null,
        });
      } catch (ledgerError) {
        console.error("Failed to write approved fee payment to ledger:", ledgerError);
      }

      return NextResponse.json({ success: true });
    }

    if (action === "reject_proof") {
      if (
        payment.status !== "pending" ||
        payment.approvalStatus !== "pending"
      ) {
        await session.abortTransaction();
        return NextResponse.json(
          { error: "Payment is not pending approval" },
          { status: 400 }
        );
      }

      payment.approvalStatus = "rejected";
      payment.reviewedBy = userId || null;
      payment.reviewedAt = new Date();
      payment.reviewNotes = reviewNotes || null;
      payment.status = "failed";
      await payment.save({ session });

      await InvoiceEvent.create(
        [
          {
            invoiceId: invoice._id,
            schoolId,
            studentId: invoice.studentId,
            eventType: "payment_recorded",
            description: `Payment proof rejected • ${payment.receiptNumber}`,
            performedBy: userId || null,
            relatedPaymentId: payment._id,
          },
        ],
        { session }
      );

      await PaymentAuditEvent.create(
        [
          {
            schoolId,
            paymentId: payment._id,
            invoiceId: invoice._id,
            studentId: invoice.studentId,
            eventType: "payment_rejected",
            title: "Payment rejected",
            description:
              reviewNotes?.trim() ||
              `Payment proof rejected${
                payment.receiptNumber ? ` (${payment.receiptNumber})` : ""
              }.`,
            actorId: userId ? new mongoose.Types.ObjectId(userId) : null,
            metadata: {
              approvalStatus: "rejected",
              paymentStatus: payment.status,
            },
          },
        ],
        { session }
      );

      await writeTransactionalAuditEvent(session, {
        actionCode: "payment.proof_rejected",
        scopeType: "school",
        scopeId: String(schoolId),
        result: "succeeded",
        target: {
          targetEntityType: "Payment",
          targetEntityId: payment._id,
          secondaryEntityType: "Invoice",
          secondaryEntityId: invoice._id,
        },
        context: auditContext(`payment.proof_rejected:${id}`),
        reason: {
          reason: reviewNotes?.trim() || "Payment proof rejected",
        },
        payload: {
          metadata: {
            receiptNumber: payment.receiptNumber ?? null,
            paymentStatus: payment.status,
          },
        },
        streamKey: auditStreamKey,
      });

      await session.commitTransaction();
      return NextResponse.json({ success: true });
    }

    if (action === "reverse") {
      if (payment.status !== "completed") {
        await session.abortTransaction();
        return NextResponse.json(
          { error: "Only completed payments can be reversed" },
          { status: 400 }
        );
      }

      const beforePaymentStatusForAudit = payment.status;

      // Safety: if this payment created credit, don’t reverse yet (until you track credit source usage)
      const credit = await StudentCreditBalance.findOne({
        schoolId,
        studentId: invoice.studentId,
      }).session(session);
      const creditFromPayment =
        credit?.entries?.filter(
          (e: any) =>
            e.type === "credit" &&
            String(e.sourcePaymentId) === String(payment._id)
        ) || [];
      if (creditFromPayment.length) {
        await session.abortTransaction();
        return NextResponse.json(
          {
            error:
              "This payment created credit. Reverse credit usage first (safe-guard).",
          },
          { status: 400 }
        );
      }

      const allocations = await PaymentAllocation.find({
        paymentId: payment._id,
      }).session(session);

      // Reverse line item + schedules
      for (const a of allocations) {
        const li = await InvoiceLineItem.findById(a.invoiceLineItemId).session(
          session
        );
        if (!li) continue;

        li.amountPaidMinor = Math.max(0, li.amountPaidMinor - a.amountMinor);
        li.amountOutstandingMinor = li.amountMinor - li.amountPaidMinor;
        li.isFullyPaid = li.amountOutstandingMinor <= 0;
        li.status = li.isFullyPaid
          ? "paid"
          : li.amountPaidMinor > 0
          ? "partially_paid"
          : "pending";
        await li.save({ session });

        if (a.installmentScheduleId) {
          const sch = await (
            await import("@/models/InstallmentSchedule")
          ).InstallmentSchedule.findById(a.installmentScheduleId).session(
            session
          );

          if (sch) {
            sch.amountPaidMinor = Math.max(
              0,
              sch.amountPaidMinor - a.amountMinor
            );
            sch.amountOutstandingMinor = sch.amountMinor - sch.amountPaidMinor;
            sch.status =
              sch.amountPaidMinor >= sch.amountMinor
                ? "paid"
                : sch.amountPaidMinor > 0
                ? "partially_paid"
                : "pending";
            await sch.save({ session });
          }
        }
      }

      // Recalc invoice
      const lineItems = await InvoiceLineItem.find({
        invoiceId: invoice._id,
      }).session(session);
      const totals = calculateInvoiceTotals(
        lineItems.map((li) => ({
          amountMinor: li.amountMinor,
          amountPaidMinor: li.amountPaidMinor,
        }))
      );

      invoice.totalPaidMinor = totals.totalPaidMinor;
      invoice.totalOutstandingMinor = totals.totalOutstandingMinor;
      invoice.status = calculateInvoiceStatus(
        invoice.totalPaidMinor,
        invoice.totalAmountMinor,
        lineItems,
        invoice.issueDate
      );
      if (invoice.status !== "paid") invoice.paidDate = null;
      await invoice.save({ session });

      payment.status = "reversed";
      payment.notes = payment.notes
        ? `${payment.notes}\nReversed: ${reviewNotes || ""}`
        : `Reversed: ${reviewNotes || ""}`;
      await payment.save({ session });

      await InvoiceEvent.create(
        [
          {
            invoiceId: invoice._id,
            schoolId,
            studentId: invoice.studentId,
            eventType: "refunded",
            description: `Payment reversed • ${payment.receiptNumber}`,
            performedBy: userId || null,
            relatedPaymentId: payment._id,
          },
        ],
        { session }
      );

      await PaymentAuditEvent.create(
        [
          {
            schoolId,
            paymentId: payment._id,
            invoiceId: invoice._id,
            studentId: invoice.studentId,
            eventType: "payment_reversed",
            title: "Payment reversed",
            description:
              reviewNotes?.trim() ||
              `Payment reversed${
                payment.receiptNumber ? ` (${payment.receiptNumber})` : ""
              }.`,
            actorId: userId ? new mongoose.Types.ObjectId(userId) : null,
            metadata: { paymentStatus: payment.status },
          },
        ],
        { session }
      );

      await writeTransactionalAuditEvent(session, {
        actionCode: "payment.reversed",
        scopeType: "school",
        scopeId: String(schoolId),
        result: "succeeded",
        target: {
          targetEntityType: "Payment",
          targetEntityId: payment._id,
          secondaryEntityType: "Invoice",
          secondaryEntityId: invoice._id,
        },
        context: auditContext(`payment.reversed:${id}`),
        reason: {
          reason: reviewNotes?.trim() || "Payment reversed",
        },
        payload: {
          before: { paymentStatus: beforePaymentStatusForAudit },
          after: { paymentStatus: payment.status },
          metadata: {
            receiptNumber: payment.receiptNumber ?? null,
          },
        },
        streamKey: auditStreamKey,
      });

      await session.commitTransaction();
      return NextResponse.json({ success: true });
    }

    await session.abortTransaction();
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    await session.abortTransaction();
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  } finally {
    await session.endSession();
  }
}
