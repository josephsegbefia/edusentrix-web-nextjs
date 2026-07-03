/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaffOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { StudentCreditBalance } from "@/models/StudentCreditBalance"; // create if missing
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import { allocateToInvoiceLineItems } from "@/lib/fees/allocateToInvoiceLineItems";
import { applyAllocationsToInvoice } from "@/lib/fees/applyAllocationsToInvoice";
import { formatMoney } from "@/lib/fees/money";
import { recordFeePaymentInLedger } from "@/lib/finance/writeLedgerEntry";
import { Student } from "@/models/Student";
import { User } from "@/models/User";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildFinanceStaffAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import {
  generatePaymentInternalReference,
  type PaymentMethodForRef,
} from "@/models/PaymentReferenceCounter";

const BodySchema = z
  .object({
    studentId: z.string().min(1),
    invoiceId: z.string().min(1),

    amountMinor: z.number().int().positive(),
    paymentDate: z.string().min(1), // ISO
    paymentMethod: z.enum([
      "cash",
      "bank_transfer",
      "mobile_money",
      "paystack",
      "cheque",
      "other",
    ]),
    receiptNumber: z.string().optional(),
    reference: z.string().optional(),
    paystackReference: z.string().optional(),
    idempotencyKey: z.string().optional(),
    allowDuplicate: z.boolean().optional(),
    duplicateReason: z.string().optional(),
    note: z.string().optional(),

    status: z.enum(["completed", "pending_approval"]).default("completed"),

    allocationMode: z.enum(["auto", "manual"]).default("auto"),
    allocations: z
      .array(
        z.object({
          invoiceLineItemId: z.string().min(1),
          amountMinor: z.number().int().positive(),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      const hasRef =
        (data.receiptNumber?.trim()?.length ?? 0) > 0 ||
        (data.reference?.trim()?.length ?? 0) > 0 ||
        (data.paystackReference?.trim()?.length ?? 0) > 0;
      if (["paystack", "bank_transfer", "mobile_money"].includes(data.paymentMethod)) {
        return !!hasRef;
      }
      return true;
    },
    {
      message:
        "A reference is required for Paystack, bank transfer, and mobile money payments. Provide receipt number, bank/MoMo reference, or Paystack reference.",
    }
  );

// One-time index fix - drop and recreate paystackReference index with correct config
let indexFixed = false;
async function fixPaystackReferenceIndex() {
  if (indexFixed) return;
  try {
    const indexes = await Payment.collection.getIndexes();
    const existingIndex = indexes.paystackReference_1 as any;
    if (existingIndex && !existingIndex.partialFilterExpression) {
      // Drop old index
      await Payment.collection.dropIndex("paystackReference_1").catch(() => {
        // Ignore if already dropped
      });
      // Recreate with correct config
      await Payment.collection.createIndex(
        { paystackReference: 1 },
        {
          unique: true,
          sparse: true,
          partialFilterExpression: { paystackReference: { $ne: null } },
          name: "paystackReference_1",
        }
      );
      indexFixed = true;
    }
  } catch (error) {
    // Ignore errors, will retry next time
    console.warn("Failed to fix paystackReference index:", error);
  }
}

function normalizeRef(value?: string | null) {
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export async function POST(req: NextRequest) {
  const { schoolId, userId, roles } =
    await requireFinanceStaffOrDelegatedAnyPermission(["fees.record_payment"]);
  await connectToDatabase();

  if (!schoolId) {
    return NextResponse.json(
      { error: "School ID not found" },
      { status: 400 }
    );
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Fix index if needed (one-time)
  await fixPaystackReferenceIndex();

  const body = BodySchema.parse(await req.json());

  const actorUser = await User.findById(userId).select("email name").lean();

  if (
    !mongoose.Types.ObjectId.isValid(body.studentId) ||
    !mongoose.Types.ObjectId.isValid(body.invoiceId)
  ) {
    return NextResponse.json(
      { error: "Invalid student or bill ID" },
      { status: 400 }
    );
  }

  const receiptNumber = normalizeRef(body.receiptNumber);
  const externalReference = normalizeRef(body.reference);
  const paystackReference = normalizeRef(body.paystackReference);
  const idempotencyKey = normalizeRef(body.idempotencyKey);
  const allowDuplicate = body.allowDuplicate === true;

  if (idempotencyKey) {
    const idempotentExisting = await Payment.findOne({
      schoolId: schoolIdObj,
      idempotencyKey,
    })
      .select("_id invoiceId status amountMinor")
      .lean();
    const idempotentPayment = Array.isArray(idempotentExisting)
      ? idempotentExisting[0]
      : idempotentExisting;

    if (idempotentPayment) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        paymentId: String(idempotentPayment._id),
        invoiceId: String(idempotentPayment.invoiceId),
        allocatedMinor: idempotentPayment.amountMinor || 0,
        unallocatedMinor: 0,
        creditAddedMinor: 0,
        status: idempotentPayment.status || "completed",
        warning: "Existing payment returned from idempotency key.",
      });
    }
  }

  const duplicateCandidates: Array<{
    paymentId: string;
    field: "receiptNumber" | "externalReference" | "paystackReference";
    value: string;
    amountMinor: number;
    paymentDate: Date | string;
    invoiceId: string;
    studentId: string;
  }> = [];

  if (receiptNumber) {
    const receiptDupes = await Payment.find({
      schoolId: schoolIdObj,
      receiptNumber,
      status: { $nin: ["reversed", "failed"] },
    })
      .select("_id amountMinor paymentDate invoiceId studentId")
      .limit(5)
      .lean();
    for (const dupe of receiptDupes) {
      duplicateCandidates.push({
        paymentId: String(dupe._id),
        field: "receiptNumber",
        value: receiptNumber,
        amountMinor: Number(dupe.amountMinor || 0),
        paymentDate: dupe.paymentDate,
        invoiceId: String(dupe.invoiceId),
        studentId: String(dupe.studentId),
      });
    }
  }

  if (externalReference) {
    const refDupes = await Payment.find({
      schoolId: schoolIdObj,
      externalReference,
      status: { $nin: ["reversed", "failed"] },
    })
      .select("_id amountMinor paymentDate invoiceId studentId")
      .limit(5)
      .lean();
    for (const dupe of refDupes) {
      duplicateCandidates.push({
        paymentId: String(dupe._id),
        field: "externalReference",
        value: externalReference,
        amountMinor: Number(dupe.amountMinor || 0),
        paymentDate: dupe.paymentDate,
        invoiceId: String(dupe.invoiceId),
        studentId: String(dupe.studentId),
      });
    }
  }

  if (paystackReference) {
    const gatewayDupes = await Payment.find({
      schoolId: schoolIdObj,
      paystackReference,
      status: { $nin: ["reversed", "failed"] },
    })
      .select("_id amountMinor paymentDate invoiceId studentId")
      .limit(5)
      .lean();
    for (const dupe of gatewayDupes) {
      duplicateCandidates.push({
        paymentId: String(dupe._id),
        field: "paystackReference",
        value: paystackReference,
        amountMinor: Number(dupe.amountMinor || 0),
        paymentDate: dupe.paymentDate,
        invoiceId: String(dupe.invoiceId),
        studentId: String(dupe.studentId),
      });
    }
  }

  const uniqueDuplicateCandidates = duplicateCandidates.filter(
    (candidate, index, list) =>
      list.findIndex((entry) => entry.paymentId === candidate.paymentId) ===
      index
  );

  if (uniqueDuplicateCandidates.length > 0 && !allowDuplicate) {
    return NextResponse.json(
      {
        code: "DUPLICATE_PAYMENT_REFERENCE",
        error:
          "Potential duplicate payment found for this receipt/reference. Review and confirm before retrying.",
        duplicates: uniqueDuplicateCandidates,
      },
      { status: 409 }
    );
  }

  const invoice = await Invoice.findOne({
    _id: new mongoose.Types.ObjectId(body.invoiceId),
    schoolId,
    studentId: body.studentId,
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Fetch line items from separate collection
  const lineItems = await InvoiceLineItem.find({
    invoiceId: invoice._id,
  })
    .sort({ displayOrder: 1 })
    .lean();

  // Normalize IDs to strings for consistent comparison
  const normalizedLineItems = lineItems.map((li: any) => ({
    ...li,
    _id: String(li._id),
  }));

  const { allocations, allocatedMinor, unallocatedMinor } =
    allocateToInvoiceLineItems({
      lineItems: normalizedLineItems,
      amountMinor: body.amountMinor,
      mode: body.allocationMode,
      manualAllocations: body.allocations,
    });

  const paymentId = new mongoose.Types.ObjectId();

  // Store payment as subdoc so invoiceDetail continues to work
  const paymentSubdoc: any = {
    _id: paymentId,
    amountMinor: body.amountMinor,
    paymentDate: body.paymentDate,
    paymentMethod: body.paymentMethod,
    receiptNumber,
    reference: externalReference,
    note: body.note,
    status: body.status,
    createdAt: new Date(),
    createdByUserId: userId ?? null,
    allocations: allocations.map((a) => ({
      _id: new mongoose.Types.ObjectId(),
      invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
      amountMinor: a.amountMinor,
    })),
  };

  invoice.payments = invoice.payments ?? [];
  invoice.payments.push(paymentSubdoc);

  let creditAddedMinor = 0;

  if (body.status === "completed") {
    // Apply to invoice line items NOW (posted)
    applyAllocationsToInvoice(invoice, allocations, {
      lineItems: normalizedLineItems,
    });

    // Persist updated line item balances
    const allocatedIds = new Set(allocations.map((a) => String(a.invoiceLineItemId)));
    const bulkUpdates = normalizedLineItems
      .filter((li: any) => allocatedIds.has(String(li._id)))
      .map((li: any) => {
        const amountPaidMinor = li.amountPaidMinor ?? 0;
        const amountOutstandingMinor =
          li.amountOutstandingMinor ??
          Math.max(0, (li.amountMinor ?? 0) - amountPaidMinor);
        const isFullyPaid = amountOutstandingMinor <= 0;
        const status = isFullyPaid
          ? "paid"
          : amountPaidMinor > 0
          ? "partially_paid"
          : "pending";

        return {
          updateOne: {
            filter: { _id: li._id },
            update: {
              $set: {
                amountPaidMinor,
                amountOutstandingMinor,
                isFullyPaid,
                status,
              },
            },
          },
        };
      });

    if (bulkUpdates.length > 0) {
      await InvoiceLineItem.bulkWrite(bulkUpdates);
    }

    // Overpayment => credit wallet line (separate ledger line)
    if (unallocatedMinor > 0) {
      creditAddedMinor = unallocatedMinor;

      await StudentCreditBalance.updateOne(
        { schoolId, studentId: body.studentId },
        {
          $inc: { balanceMinor: creditAddedMinor },
          $push: {
            entries: {
              type: "credit",
              amountMinor: creditAddedMinor,
              createdAt: new Date(),
              reason: "Overpayment",
              sourcePaymentId: paymentId,
            },
          },
        },
        { upsert: true }
      );

      await InvoiceEvent.create({
        schoolId,
        invoiceId: invoice._id,
        studentId: new mongoose.Types.ObjectId(body.studentId),
        eventType: "adjustment_added",
        description: `Credit added from overpayment: ${formatMoney(creditAddedMinor)}`,
        metadata: { amountMinor: creditAddedMinor, sourcePaymentId: paymentId },
        relatedPaymentId: paymentId,
        performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
      });
    }

    await InvoiceEvent.create({
      schoolId,
      invoiceId: invoice._id,
      studentId: new mongoose.Types.ObjectId(body.studentId),
      eventType: "payment_recorded",
      description: `Payment recorded: ${formatMoney(body.amountMinor)} via ${body.paymentMethod}`,
      metadata: {
        paymentId,
        amountMinor: body.amountMinor,
        allocatedMinor,
        unallocatedMinor,
        paymentMethod: body.paymentMethod,
      },
      relatedPaymentId: paymentId,
      performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
    });
  } else {
    // pending_approval => DO NOT alter invoice totals/outstanding
    await InvoiceEvent.create({
      schoolId,
      invoiceId: invoice._id,
      studentId: new mongoose.Types.ObjectId(body.studentId),
      eventType: "payment_recorded",
      description: `Payment pending approval: ${formatMoney(body.amountMinor)} via ${body.paymentMethod}`,
      metadata: {
        paymentId,
        amountMinor: body.amountMinor,
        allocationMode: body.allocationMode,
        paymentMethod: body.paymentMethod,
      },
      relatedPaymentId: paymentId,
      performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
    });
  }

  // Generate internal reference (e.g. RCP-24-000001, BNK-24-000002)
  const internalReference = await generatePaymentInternalReference(
    schoolIdObj,
    body.paymentMethod as PaymentMethodForRef
  );

  // Create Payment record (for history + SSE + approvals)
  // Only include paystackReference if it exists to avoid unique index conflicts
  const paymentData: any = {
    _id: paymentId,
    schoolId: schoolIdObj,
    studentId: new mongoose.Types.ObjectId(body.studentId),
    invoiceId: invoice._id,
    amountMinor: body.amountMinor,
    paymentDate: new Date(body.paymentDate),
    paymentMethod: body.paymentMethod,
    idempotencyKey,
    internalReference,
    receiptNumber: receiptNumber || null,
    externalReference: externalReference || null,
    notes: body.note || null,
    status: body.status === "completed" ? "completed" : "pending",
    approvalStatus: body.status === "completed" ? "not_required" : "pending",
    receivedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
    requestedAllocations:
      body.status === "pending_approval"
        ? allocations.map((a) => ({
            invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
            amountMinor: a.amountMinor,
            installmentScheduleId: null,
            installmentNumber: null,
            notes: null,
          }))
        : [],
  };

  // Only include paystackReference if it has a value (to avoid unique index issues with null)
  // Delete the property if not provided to ensure Mongoose doesn't set default null
  if (paystackReference) {
    paymentData.paystackReference = paystackReference;
  } else {
    // Delete the property to ensure it's not included in the document
    delete paymentData.paystackReference;
  }

  // Ensure paystackReference is truly omitted if not provided (not null or undefined)
  // This prevents MongoDB unique index conflicts
  if (!paymentData.paystackReference) {
    delete paymentData.paystackReference;
  }

  const paymentDoc = await Payment.create(paymentData);

  // Persist allocations for completed payments (used by history + ledger)
  if (body.status === "completed" && allocations.length > 0) {
    await PaymentAllocation.insertMany(
      allocations.map((a) => ({
        paymentId: paymentDoc._id,
        invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
        amountMinor: a.amountMinor,
        installmentScheduleId: null,
        installmentNumber: null,
        notes: null,
      }))
    );
  }

  await PaymentAuditEvent.create({
    schoolId: schoolIdObj,
    paymentId: paymentDoc._id,
    invoiceId: invoice._id,
    studentId: new mongoose.Types.ObjectId(body.studentId),
    eventType: "payment_recorded",
    title:
      body.status === "completed"
        ? "Payment recorded"
        : "Payment submitted for approval",
    description:
      body.status === "completed"
        ? `Recorded ${formatMoney(body.amountMinor)} via ${body.paymentMethod.replaceAll(
            "_",
            " "
          )}`
        : `Submitted ${formatMoney(body.amountMinor)} for approval`,
    actorId: userId ? new mongoose.Types.ObjectId(userId) : null,
    metadata: {
      internalReference,
      receiptNumber,
      externalReference,
      paystackReference,
      allocatedMinor,
      unallocatedMinor,
    },
  });

  const financeAuditStreamKey = `school:${String(schoolId)}:finance`;
  {
    const auditSession = await mongoose.startSession();
    try {
      await auditSession.withTransaction(async () => {
        await writeTransactionalAuditEvent(auditSession, {
          actionCode: "payment.recorded",
          scopeType: "school",
          scopeId: String(schoolId),
          result: "succeeded",
          target: {
            targetEntityType: "Payment",
            targetEntityId: paymentDoc._id,
            secondaryEntityType: "Invoice",
            secondaryEntityId: invoice._id,
          },
          context: buildFinanceStaffAuditContext(req, {
            userId: userId as mongoose.Types.ObjectId,
            schoolId: schoolIdObj,
            roles,
            actorEmail: (actorUser as { email?: string } | null)?.email ?? null,
            actorName: (actorUser as { name?: string } | null)?.name ?? null,
            idempotencyKey: resolveAuditIdempotencyKey(
              req,
              idempotencyKey || `payment.recorded:${String(paymentDoc._id)}`
            ),
          }),
          payload: {
            metadata: {
              internalReference,
              status: body.status,
              paymentMethod: body.paymentMethod,
              amountMinor: body.amountMinor,
            },
          },
          streamKey: financeAuditStreamKey,
        });
      });
    } finally {
      await auditSession.endSession();
    }
  }

  if (uniqueDuplicateCandidates.length > 0 && allowDuplicate) {
    await PaymentAuditEvent.create({
      schoolId: schoolIdObj,
      paymentId: paymentDoc._id,
      invoiceId: invoice._id,
      studentId: new mongoose.Types.ObjectId(body.studentId),
      eventType: "payment_duplicate_detected",
      title: "Duplicate check overridden",
      description:
        body.duplicateReason?.trim() ||
        "Payment was saved after duplicate warning was acknowledged.",
      actorId: userId ? new mongoose.Types.ObjectId(userId) : null,
      metadata: {
        duplicateCount: uniqueDuplicateCandidates.length,
        duplicates: uniqueDuplicateCandidates,
      },
    });

    const dupAuditSession = await mongoose.startSession();
    try {
      await dupAuditSession.withTransaction(async () => {
        await writeTransactionalAuditEvent(dupAuditSession, {
          actionCode: "payment.duplicate_override.accepted",
          scopeType: "school",
          scopeId: String(schoolId),
          result: "succeeded",
          target: {
            targetEntityType: "Payment",
            targetEntityId: paymentDoc._id,
            secondaryEntityType: "Invoice",
            secondaryEntityId: invoice._id,
          },
          context: buildFinanceStaffAuditContext(req, {
            userId: userId as mongoose.Types.ObjectId,
            schoolId: schoolIdObj,
            roles,
            actorEmail: (actorUser as { email?: string } | null)?.email ?? null,
            actorName: (actorUser as { name?: string } | null)?.name ?? null,
            idempotencyKey: resolveAuditIdempotencyKey(
              req,
              `duplicate_override:${String(paymentDoc._id)}`
            ),
          }),
          reason: {
            reason: body.duplicateReason?.trim() || "Duplicate override acknowledged",
          },
          payload: {
            metadata: {
              duplicateCount: uniqueDuplicateCandidates.length,
            },
          },
          streamKey: financeAuditStreamKey,
        });
      });
    } finally {
      await dupAuditSession.endSession();
    }
  }

  await invoice.save();

  // Write to Financial Center ledger for completed payments
  if (body.status === "completed") {
    try {
      // Get student info for ledger entry
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
      const student = await Student.findById(body.studentId)
        .select("firstName lastName guardians")
        .lean() as StudentLean | null;

      const primaryGuardian = student?.guardians?.[0];

      await recordFeePaymentInLedger({
        schoolId: String(schoolId),
        paymentId: String(paymentId),
        amountMinor: body.amountMinor,
        currency: "GHS",
        paymentMethod: body.paymentMethod,
        paymentReference:
          internalReference ||
          paystackReference ||
          externalReference ||
          receiptNumber ||
          null,
        studentId: body.studentId,
        studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown Student",
        guardianName: primaryGuardian?.name || null,
        guardianEmail: primaryGuardian?.email || null,
        guardianPhone: primaryGuardian?.phone || null,
        invoiceNumber: invoice.invoiceNumber || null,
        description: `Fee payment for ${invoice.invoiceNumber || "invoice"}`,
        academicPeriodId: invoice.academicPeriodId ? String(invoice.academicPeriodId) : null,
        occurredAt: new Date(body.paymentDate),
        createdBy: userId ? String(userId) : null,
      });
    } catch (ledgerError) {
      // Log but don't fail the payment
      console.error("Failed to write fee payment to ledger:", ledgerError);
    }
  }

  return NextResponse.json({
    ok: true,
    paymentId: String(paymentId),
    internalReference,
    invoiceId: String(invoice._id),
    allocatedMinor,
    unallocatedMinor,
    creditAddedMinor,
    status: body.status,
    duplicateOverrideApplied:
      uniqueDuplicateCandidates.length > 0 && allowDuplicate,
  });
}
