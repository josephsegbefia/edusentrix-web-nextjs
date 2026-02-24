// src/app/api/webhooks/paystack/route.ts
/**
 * Paystack webhook handler for payment events.
 * Handles: (1) school fee payments, (2) donation completions for fundraising campaigns.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingDonation, IFundraisingDonation } from "@/models/FundraisingDonation";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { recordActivity } from "@/lib/audit/recordActivity";
import { recordDonationInLedger } from "@/lib/finance/writeLedgerEntry";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { Student } from "@/models/Student";
import { allocateToInvoiceLineItems } from "@/lib/fees/allocateToInvoiceLineItems";
import { applyAllocationsToInvoice } from "@/lib/fees/applyAllocationsToInvoice";
import { formatMoney } from "@/lib/fees/money";
import { recordFeePaymentInLedger } from "@/lib/finance/writeLedgerEntry";
import {
  generatePaymentInternalReference,
  type PaymentMethodForRef,
} from "@/models/PaymentReferenceCounter";

// ============================================================================
// Types
// ============================================================================

interface PaystackEvent {
  event: string;
  data: {
    id?: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    gateway_response: string;
    channel: string;
    metadata?: {
      donationId?: string;
      campaignId?: string;
      schoolId?: string;
      invoiceId?: string;
      studentId?: string;
      paymentIntentId?: string;
      type?: string;
      custom_fields?: Array<{
        display_name: string;
        variable_name: string;
        value: string;
      }>;
    };
    customer?: {
      email?: string;
      customer_code?: string;
    };
    paid_at?: string;
    created_at?: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function verifyPaystackSignature(
  payload: string,
  signature: string | null,
  secretKey: string
): boolean {
  if (!signature) return false;
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(payload)
    .digest("hex");
  return hash === signature;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error("Paystack webhook: PAYSTACK_SECRET_KEY not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // Get raw body for signature verification
    const payload = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // Verify signature
    if (!verifyPaystackSignature(payload, signature, secretKey)) {
      console.error("Paystack webhook: Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event: PaystackEvent = JSON.parse(payload);
    console.log(`Paystack webhook received: ${event.event}`);

    // Handle charge.success event
    if (event.event === "charge.success") {
      const { metadata } = event.data;
      if (metadata?.invoiceId && metadata?.studentId && metadata?.schoolId) {
        await handleFeePaymentSuccess(event);
        return NextResponse.json({ received: true });
      }
      await handleChargeSuccess(event);
    }

    // Acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handleFeePaymentSuccess(event: PaystackEvent) {
  const { data } = event;
  const { reference, amount, status, metadata } = data;

  if (status !== "success") return;

  const schoolId = metadata?.schoolId;
  const invoiceId = metadata?.invoiceId;
  const studentId = metadata?.studentId;

  if (
    !schoolId ||
    !invoiceId ||
    !studentId ||
    !mongoose.Types.ObjectId.isValid(schoolId) ||
    !mongoose.Types.ObjectId.isValid(invoiceId) ||
    !mongoose.Types.ObjectId.isValid(studentId)
  ) {
    console.error("Paystack webhook: Invalid fee metadata", { schoolId, invoiceId, studentId });
    return;
  }

  await connectToDatabase();

  const schoolIdObj = new mongoose.Types.ObjectId(schoolId);
  const invoiceIdObj = new mongoose.Types.ObjectId(invoiceId);
  const studentIdObj = new mongoose.Types.ObjectId(studentId);

  // Idempotency: payment already exists for this Paystack reference
  const existingPayment = await Payment.findOne({
    schoolId: schoolIdObj,
    paystackReference: reference,
    status: { $nin: ["reversed", "failed"] },
  }).lean();

  if (existingPayment) {
    console.log(`Paystack webhook: Fee payment already recorded: ${reference}`);
    return;
  }

  const invoice = await Invoice.findOne({
    _id: invoiceIdObj,
    schoolId: schoolIdObj,
    studentId: studentIdObj,
  });

  if (!invoice) {
    console.error(`Paystack webhook: Invoice not found: ${invoiceId}`);
    return;
  }

  const amountMinor = Math.round(amount);
  const lineItems = await InvoiceLineItem.find({ invoiceId: invoice._id })
    .sort({ displayOrder: 1 })
    .lean();

  const normalizedLineItems = lineItems.map((li: any) => ({
    ...li,
    _id: String(li._id),
  }));

  const { allocations, allocatedMinor, unallocatedMinor } = allocateToInvoiceLineItems({
    lineItems: normalizedLineItems,
    amountMinor,
    mode: "auto",
  });

  const paymentId = new mongoose.Types.ObjectId();
  const paymentDate = data.paid_at ? new Date(data.paid_at) : new Date();

  applyAllocationsToInvoice(invoice, allocations, { lineItems: normalizedLineItems });

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

  let creditAddedMinor = 0;
  if (unallocatedMinor > 0) {
    creditAddedMinor = unallocatedMinor;
    await StudentCreditBalance.updateOne(
      { schoolId: schoolIdObj, studentId: studentIdObj },
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
      schoolId: schoolIdObj,
      invoiceId: invoice._id,
      studentId: studentIdObj,
      eventType: "adjustment_added",
      description: `Credit added from overpayment: ${formatMoney(creditAddedMinor)}`,
      metadata: { amountMinor: creditAddedMinor, sourcePaymentId: paymentId },
      relatedPaymentId: paymentId,
      performedBy: null,
    });
  }

  await InvoiceEvent.create({
    schoolId: schoolIdObj,
    invoiceId: invoice._id,
    studentId: studentIdObj,
    eventType: "payment_recorded",
    description: `Payment recorded: ${formatMoney(amountMinor)} via Paystack`,
    metadata: {
      paymentId,
      amountMinor,
      allocatedMinor,
      unallocatedMinor,
      paymentMethod: "paystack",
    },
    relatedPaymentId: paymentId,
    performedBy: null,
  });

  const internalReference = await generatePaymentInternalReference(
    schoolIdObj,
    "paystack" as PaymentMethodForRef
  );

  const now = new Date();
  await Payment.create({
    _id: paymentId,
    schoolId: schoolIdObj,
    studentId: studentIdObj,
    invoiceId: invoice._id,
    amountMinor,
    paymentDate,
    paymentMethod: "paystack",
    paystackReference: reference,
    paystackTransactionId: data.id ? String(data.id) : null,
    reconciliationStatus: "gateway_verified",
    gatewayVerifiedAt: now,
    internalReference,
    status: "completed",
    approvalStatus: "not_required",
    receivedBy: null,
  });

  if (allocations.length > 0) {
    await PaymentAllocation.insertMany(
      allocations.map((a) => ({
        paymentId,
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
    paymentId,
    invoiceId: invoice._id,
    studentId: studentIdObj,
    eventType: "payment_recorded",
    title: "Payment recorded (Paystack webhook)",
    description: `Recorded ${formatMoney(amountMinor)} via Paystack. Reference: ${reference}`,
    actorId: null,
    metadata: {
      paystackReference: reference,
      allocatedMinor,
      unallocatedMinor,
      automated: true,
    },
  });

  invoice.paidDate = invoice.totalOutstandingMinor <= 0 ? now : undefined;
  await invoice.save();

  try {
    const student = await Student.findById(studentId)
      .select("firstName lastName guardians")
      .lean() as { firstName: string; lastName: string; guardians?: Array<{ name?: string; email?: string; phone?: string }> } | null;

    const primaryGuardian = student?.guardians?.[0];

    await recordFeePaymentInLedger({
      schoolId,
      paymentId: String(paymentId),
      amountMinor,
      currency: data.currency || "GHS",
      paymentMethod: "paystack",
      paymentReference: reference,
      studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown Student",
      guardianName: primaryGuardian?.name || null,
      guardianEmail: primaryGuardian?.email || null,
      guardianPhone: primaryGuardian?.phone || null,
      invoiceNumber: invoice.invoiceNumber || null,
      description: `Fee payment for ${invoice.invoiceNumber || "invoice"} (Paystack)`,
      academicPeriodId: invoice.academicPeriodId ? String(invoice.academicPeriodId) : null,
      occurredAt: paymentDate,
      createdBy: null,
    });
  } catch (ledgerError) {
    console.error("Failed to write fee payment to ledger:", ledgerError);
  }

  console.log(`Paystack webhook: Fee payment recorded for invoice ${invoiceId}, ref ${reference}`);
}

async function handleChargeSuccess(event: PaystackEvent) {
  const { data } = event;
  const { reference, amount, status, metadata } = data;

  // Only process successful payments
  if (status !== "success") {
    console.log(`Paystack webhook: Ignoring non-success status: ${status}`);
    return;
  }

  // Check if this is a donation
  if (!metadata?.donationId) {
    console.log(`Paystack webhook: No donationId in metadata, skipping`);
    return;
  }

  await connectToDatabase();
  void FundraisingDonation.modelName;
  void FundraisingCampaign.modelName;

  const donationId = metadata.donationId;
  const campaignId = metadata.campaignId;
  const schoolId = metadata.schoolId;

  if (!mongoose.Types.ObjectId.isValid(donationId)) {
    console.error(`Paystack webhook: Invalid donationId: ${donationId}`);
    return;
  }

  // Find the donation
  const donation = await FundraisingDonation.findById(donationId).lean<IFundraisingDonation>();

  if (!donation) {
    console.error(`Paystack webhook: Donation not found: ${donationId}`);
    return;
  }

  // Skip if already completed
  if (donation.status === "completed") {
    console.log(`Paystack webhook: Donation already completed: ${donationId}`);
    return;
  }

  // Update donation to completed
  await FundraisingDonation.updateOne(
    { _id: donationId },
    {
      $set: {
        status: "completed",
        gatewayReference: reference,
        updatedAt: new Date(),
      },
    }
  );

  // Update campaign totals
  if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
    await FundraisingCampaign.updateOne(
      { _id: campaignId },
      {
        $inc: {
          raisedAmountMinor: donation.amountMinor,
          donorCount: 1,
        },
      }
    );

    // Check and update milestones
    const campaign = await FundraisingCampaign.findById(campaignId);
    if (campaign && campaign.milestones) {
      const newTotal = campaign.raisedAmountMinor;
      let milestonesUpdated = false;

      for (const milestone of campaign.milestones) {
        if (!milestone.reachedAt && newTotal >= milestone.amountMinor) {
          milestone.reachedAt = new Date();
          milestonesUpdated = true;
        }
      }

      if (milestonesUpdated) {
        await campaign.save();
      }
    }
  }

  // Record activity
  if (schoolId && mongoose.Types.ObjectId.isValid(schoolId)) {
    await recordActivity({
      schoolId,
      userId: donation.donorUserId ? String(donation.donorUserId) : schoolId,
      type: "donation.received",
      entityType: "fundraising_donation",
      entityId: donationId,
      description: `Online donation received: ${(donation.amountMinor / 100).toFixed(2)} ${donation.currency}`,
      metadata: {
        campaignId,
        amountMinor: donation.amountMinor,
        paymentMethod: "paystack",
        gatewayReference: reference,
      },
    });

    // Write to Financial Center ledger
    try {
      // Get campaign title for description
      const campaign = await FundraisingCampaign.findById(campaignId)
        .select("title")
        .lean() as { title: string } | null;

      await recordDonationInLedger({
        schoolId,
        donationId,
        campaignId: campaignId || "",
        campaignTitle: campaign?.title || "Fundraising Campaign",
        amountMinor: donation.amountMinor,
        currency: donation.currency,
        paymentMethod: "paystack",
        gatewayReference: reference,
        donorName: donation.donorName || "Anonymous",
        donorEmail: donation.donorEmail || null,
        donorPhone: donation.donorPhone || null,
        isAnonymous: donation.isAnonymous,
        receiptNumber: donation.receiptNumber || null,
        occurredAt: new Date(),
        createdBy: donation.donorUserId ? String(donation.donorUserId) : null,
      });
    } catch (ledgerError) {
      console.error("Failed to write donation to ledger:", ledgerError);
    }
  }

  console.log(`Paystack webhook: Successfully processed donation ${donationId}`);
}
