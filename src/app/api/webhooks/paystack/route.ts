// src/app/api/webhooks/paystack/route.ts
/**
 * Paystack webhook handler for payment events.
 * Handles: (1) school fee payments, (2) donation completions for fundraising campaigns,
 * (3) school store orders, (4) payout transfer status updates.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingDonation, IFundraisingDonation } from "@/models/FundraisingDonation";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { recordActivity } from "@/lib/audit/recordActivity";
import { User } from "@/models/User";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { Student } from "@/models/Student";
import { School } from "@/models/School";
import { Message } from "@/models/Message";
import { MessageThread } from "@/models/MessageThread";
import { UserMembership } from "@/models/UserMembership";
import { allocateToInvoiceLineItems } from "@/lib/fees/allocateToInvoiceLineItems";
import { applyAllocationsToInvoice } from "@/lib/fees/applyAllocationsToInvoice";
import { reconcileInvoicePaymentState } from "@/lib/fees/reconcile-invoice-payment-state";
import { formatMoney } from "@/lib/fees/money";
import { ensureReceiptVerification } from "@/lib/finance/receipt-verification";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { learnReceiptNumber, renderLearnReceiptPdf } from "@/lib/learn/receipt-pdf";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { buildTransferReconciliationUpdate } from "@/lib/finance/disbursements";
import {
  recordDonationInLedger,
  recordFeePaymentInLedger,
  recordStoreSaleInLedger,
} from "@/lib/finance/writeLedgerEntry";
import {
  generatePaymentInternalReference,
  type PaymentMethodForRef,
} from "@/models/PaymentReferenceCounter";
import { PaymentIntent } from "@/models/PaymentIntent";
import { StoreOrder } from "@/models/StoreOrder";
import { SchoolDisbursement } from "@/models/SchoolDisbursement";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AuditEvent } from "@/models/AuditEvent";
import { Notification } from "@/models/Notification";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import {
  fulfillLearnPaymentSuccess,
  markLearnPaymentFailed,
} from "@/lib/learn/fulfill-learn-payment";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildPaystackWebhookAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import {
  markFeeFailedByReference,
  markFeePaidByReference,
} from "@/lib/admissions/fee-payments";
import { fulfillSubscriptionCheckoutSuccess } from "@/lib/subscriptions/subscription-checkout";

// ============================================================================
// Types
// ============================================================================

interface PaystackEvent {
  event: string;
  data: {
    id?: number;
    reference: string;
    amount: number;
    fees?: number;
    fee_charged?: number;
    currency: string;
    status: string;
    gateway_response: string;
    channel: string;
    transfer_code?: string;
    metadata?: {
      donationId?: string;
      campaignId?: string;
      schoolId?: string;
      invoiceId?: string;
      studentId?: string;
      paymentIntentId?: string;
      subscriptionCheckoutIntentId?: string;
      tierId?: string;
      storeOrderId?: string;
      parentUserId?: string;
      accountId?: string;
      academicPeriodId?: string | null;
      admissionApplicationId?: string;
      admissionCycleId?: string;
      edusentrixTransactionFeeMinor?: number | string | null;
      edusentrixTransactionFeePercent?: number | string | null;
      edusentrixTransactionFeeCapMinor?: number | string | null;
      invoiceAmountMinor?: number | string | null;
      parentPayableMinor?: number | string | null;
      payerMode?: "payer_pays" | "school_absorbs" | "waived" | string | null;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fullName(row: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
} | null) {
  return [row?.firstName, row?.middleName, row?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function absoluteAssetUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${getAppUrl().replace(/\/$/, "")}${value}`;
  return value;
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
      if (
        metadata?.type === "store_order" &&
        metadata?.storeOrderId &&
        metadata?.schoolId
      ) {
        await handleStoreOrderSuccess(event);
        return NextResponse.json({ received: true });
      }
      if (
        metadata?.type === "learn_access" &&
        metadata?.paymentIntentId &&
        metadata?.studentId &&
        metadata?.schoolId
      ) {
        await handleLearnAccessSuccess(event);
        return NextResponse.json({ received: true });
      }
      if (
        metadata?.type === "admissions_fee" &&
        metadata?.admissionApplicationId
      ) {
        await handleAdmissionsFeeSuccess(event);
        return NextResponse.json({ received: true });
      }
      if (
        metadata?.type === "subscription_invoice" &&
        metadata?.subscriptionCheckoutIntentId
      ) {
        await handleSubscriptionInvoiceSuccess(event);
        return NextResponse.json({ received: true });
      }
      if (metadata?.invoiceId && metadata?.studentId && metadata?.schoolId) {
        await handleFeePaymentSuccess(event, req);
        return NextResponse.json({ received: true });
      }
      await handleChargeSuccess(event);
    }

    if (event.event === "charge.failed") {
      const { metadata } = event.data;
      if (
        metadata?.type === "admissions_fee" &&
        metadata?.admissionApplicationId
      ) {
        await handleAdmissionsFeeFailure(event);
        return NextResponse.json({ received: true });
      }
      if (
        metadata?.type === "learn_access" &&
        metadata?.paymentIntentId
      ) {
        await handleLearnAccessFailure(event);
        return NextResponse.json({ received: true });
      }
    }

    if (
      event.event === "transfer.success" ||
      event.event === "transfer.failed" ||
      event.event === "transfer.reversed"
    ) {
      await handleTransferUpdate(event);
      return NextResponse.json({ received: true });
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

async function handleLearnAccessSuccess(event: PaystackEvent) {
  const { data } = event;
  const { reference, status } = data;
  if (status !== "success" || !reference) return;

  const outcome = await fulfillLearnPaymentSuccess({
    reference,
    verification: {
      id: data.id,
      reference,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      channel: data.channel,
      paid_at: data.paid_at ?? null,
      metadata: data.metadata ?? null,
    },
    actorType: "webhook",
  });

  if (!outcome.ok) {
    console.error("Paystack webhook: Learn fulfillment failed", {
      reference,
      message: outcome.message,
    });
  }
}

async function handleSubscriptionInvoiceSuccess(event: PaystackEvent) {
  const { data } = event;
  if (data.status !== "success" || !data.reference) return;

  const outcome = await fulfillSubscriptionCheckoutSuccess({
    reference: data.reference,
    verification: {
      id: data.id,
      reference: data.reference,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      channel: data.channel,
      paid_at: data.paid_at ?? null,
      metadata: data.metadata ?? null,
    },
    actorType: "webhook",
  });

  if (!outcome.ok) {
    console.error("Paystack webhook: Subscription checkout fulfillment failed", {
      reference: data.reference,
      message: outcome.message,
    });
  }
}

async function handleLearnAccessFailure(event: PaystackEvent) {
  const paymentIntentId = event.data.metadata?.paymentIntentId;
  if (!paymentIntentId || !mongoose.Types.ObjectId.isValid(paymentIntentId)) return;

  await markLearnPaymentFailed({
    paymentIntentId: new mongoose.Types.ObjectId(paymentIntentId),
    reference: event.data.reference,
    failureReason: event.data.gateway_response || "Paystack charge failed.",
  });
}

async function sendFeePaymentFollowUps(args: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  paymentId: mongoose.Types.ObjectId;
  parentUserId: mongoose.Types.ObjectId | null;
  amountMinor: number;
  balanceMinor: number;
  receiptNumber: string;
  reference: string;
  paymentDate: Date;
}) {
  if (!args.parentUserId) return;

  try {
    const [school, student, parentUser] = await Promise.all([
      School.findById(args.schoolId)
        .select("name logo")
        .lean<{ name?: string | null; logo?: string | null } | null>(),
      Student.findOne({ _id: args.studentId, schoolId: args.schoolId })
        .select("firstName middleName lastName")
        .lean<{
          firstName?: string | null;
          middleName?: string | null;
          lastName?: string | null;
        } | null>(),
      User.findById(args.parentUserId)
        .select("firstName lastName email")
        .lean<{
          firstName?: string | null;
          lastName?: string | null;
          email?: string | null;
        } | null>(),
    ]);

    const schoolName = school?.name || "School";
    const studentName = fullName(student) || "your ward";
    const payerName =
      [parentUser?.firstName, parentUser?.lastName].filter(Boolean).join(" ").trim() ||
      parentUser?.email ||
      null;
    const paidText = formatMoney(args.amountMinor);
    const balanceText = formatMoney(args.balanceMinor);
    const receiptPath = `/api/parent/receipts/fee/${String(args.paymentId)}/download`;
    const receiptViewPath = `${receiptPath}?disposition=inline`;
    const appUrl = getAppUrl().replace(/\/$/, "");
    const receiptViewUrl = `${appUrl}${receiptViewPath}`;
    const receiptDownloadUrl = `${appUrl}${receiptPath}`;
    const notificationBody =
      args.balanceMinor > 0
        ? `We received ${paidText} for ${studentName}. Remaining balance: ${balanceText}.`
        : `We received ${paidText} for ${studentName}. This invoice is now fully paid.`;

    const existingNotification = await Notification.findOne({
      schoolId: args.schoolId,
      userId: args.parentUserId,
      entityType: "Payment",
      entityId: args.paymentId,
    })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (!existingNotification) {
      await Notification.create({
        schoolId: args.schoolId,
        userId: args.parentUserId,
        type: "fee",
        title: "Payment confirmed",
        body: notificationBody,
        priority: "normal",
        wardId: args.studentId,
        entityType: "Payment",
        entityId: args.paymentId,
        actionUrl: "/parent/receipts",
        metadata: {
          invoiceId: String(args.invoiceId),
          receiptNumber: args.receiptNumber,
          paystackReference: args.reference,
          amountMinor: args.amountMinor,
          balanceMinor: args.balanceMinor,
        },
      });
    }

    const senderMembership = await UserMembership.findOne({
      schoolId: args.schoolId,
      status: "active",
      roles: { $in: ["billing_owner", "bursar", "school_admin"] },
      userId: { $ne: args.parentUserId },
    })
      .sort({ updatedAt: -1 })
      .select("userId roles")
      .lean<{ userId: mongoose.Types.ObjectId; roles?: string[] } | null>();

    if (senderMembership?.userId) {
      const now = new Date();
      const messageBody =
        `${notificationBody}\n\nReceipt: ${args.receiptNumber}\nReference: ${args.reference}`;
      const subject = `Payment receipt ${args.receiptNumber}`;
      const existingThread = await MessageThread.findOne({
        schoolId: args.schoolId,
        studentId: args.studentId,
        subject,
        "participants.userId": { $all: [args.parentUserId, senderMembership.userId] },
      })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId } | null>();
      const threadId =
        existingThread?._id ||
        (
          await MessageThread.create({
            schoolId: args.schoolId,
            studentId: args.studentId,
            subject,
            participants: [
              { userId: args.parentUserId, role: "parent" },
              {
                userId: senderMembership.userId,
                role: senderMembership.roles?.includes("bursar")
                  ? "bursar"
                  : senderMembership.roles?.includes("school_admin")
                    ? "school_admin"
                    : "staff",
              },
            ],
            createdBy: senderMembership.userId,
            lastMessageAt: now,
            lastMessagePreview: notificationBody,
          })
        )._id;

      await Message.create({
        threadId,
        schoolId: args.schoolId,
        senderId: senderMembership.userId,
        body: messageBody,
        attachments: [
          {
            name: `${args.receiptNumber}.pdf`,
            url: receiptPath,
            type: "application/pdf",
          },
        ],
        readBy: [{ userId: senderMembership.userId, readAt: now }],
      });
      await MessageThread.findByIdAndUpdate(threadId, {
        $set: {
          lastMessageAt: now,
          lastMessagePreview: notificationBody,
        },
      });
    }

    if (parentUser?.email) {
      const verification = await ensureReceiptVerification({
        schoolId: args.schoolId,
        schoolName,
        issuedBy: args.parentUserId,
        receiptNumber: args.receiptNumber,
        receiptTitle: "School Fee Payment Receipt",
        issuedAt: args.paymentDate,
        amountPaidMinor: args.amountMinor,
        balanceMinor: args.balanceMinor,
        studentName,
        payerName,
        paymentReference: args.reference,
        sourceEntityType: "Payment",
        sourceEntityId: String(args.paymentId),
      });
      const verificationPath = `/verify/receipt/${encodeURIComponent(verification.verificationId)}`;
      const pdf = await renderLearnReceiptPdf({
        receiptNumber: args.receiptNumber,
        title: "School Fee Payment Receipt",
        schoolName,
        schoolLogoUrl: absoluteAssetUrl(school?.logo),
        studentName,
        payerName,
        amountMinor: args.amountMinor,
        balanceMinor: args.balanceMinor,
        currency: "GHS",
        status: "completed",
        reference: args.reference,
        issuedAt: args.paymentDate,
        description: "School fee payment",
        verificationId: verification.verificationId,
        verificationUrl: `${appUrl}${verificationPath}`,
      });
      const pdfBuffer = Buffer.from(pdf);

      await sendTrackedBrevoEmail({
        to: parentUser.email,
        toName: payerName,
        subject: `Payment receipt ${args.receiptNumber}`,
        htmlContent: [
          `<p>Your school fee payment for <strong>${escapeHtml(studentName)}</strong> has been confirmed.</p>`,
          `<p><strong>Amount paid:</strong> ${escapeHtml(paidText)}<br/><strong>Remaining balance:</strong> ${escapeHtml(balanceText)}</p>`,
          `<p>Your receipt is attached. You can also <a href="${escapeHtml(receiptViewUrl)}">view it online</a> or <a href="${escapeHtml(receiptDownloadUrl)}">download a copy</a>.</p>`,
        ].join(""),
        textContent: `Your school fee payment for ${studentName} has been confirmed. Amount paid: ${paidText}. Remaining balance: ${balanceText}. Receipt: ${args.receiptNumber}.`,
        templateKey: "PAYMENT_RECEIPT",
        schoolId: String(args.schoolId),
        schoolName,
        schoolLogo: school?.logo ?? null,
        attachments: [
          {
            name: `${args.receiptNumber}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: pdfBuffer.byteLength,
            contentBase64: pdfBuffer.toString("base64"),
          },
        ],
        relatedEntityType: "Payment",
        relatedEntityId: String(args.paymentId),
        recipientUserId: String(args.parentUserId),
        recipientRole: "parent",
        async: true,
      });
    }
  } catch (followUpError) {
    console.error("Paystack webhook: Fee payment follow-up failed", {
      paymentId: String(args.paymentId),
      reference: args.reference,
      error: followUpError,
    });
  }
}

async function handleFeePaymentSuccess(event: PaystackEvent, req: NextRequest) {
  const { data } = event;
  const { reference, amount, status, metadata } = data;

  if (status !== "success") return;

  const schoolId = metadata?.schoolId;
  const invoiceId = metadata?.invoiceId;
  const studentId = metadata?.studentId;
  const paymentIntentId =
    metadata?.paymentIntentId &&
    mongoose.Types.ObjectId.isValid(metadata.paymentIntentId)
      ? new mongoose.Types.ObjectId(metadata.paymentIntentId)
      : null;
  const platformFeeMinor = Math.max(
    0,
    Math.round(Number(metadata?.edusentrixTransactionFeeMinor || 0))
  );

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
  const gatewayAmountMinor = Math.max(0, Math.round(amount));
  const processorFeeMinor = Math.max(0, Math.round(Number(data.fees || 0)));
  let intent: {
    amountMinor?: number;
    parentPayableMinor?: number;
    payerMode?: "payer_pays" | "school_absorbs" | "waived";
    initiatedBy?: mongoose.Types.ObjectId | null;
  } | null = null;
  let intentLockAcquired = false;

  if (paymentIntentId) {
    const lockedIntent = await PaymentIntent.findOneAndUpdate(
      {
        _id: paymentIntentId,
        status: { $in: ["initiated", "awaiting_webhook"] },
      },
      {
        $set: {
          status: "processing",
          failureReason: null,
        },
      },
      { new: true }
    )
      .select("amountMinor parentPayableMinor payerMode initiatedBy")
      .lean<typeof intent>();

    if (lockedIntent) {
      intent = lockedIntent;
      intentLockAcquired = true;
    } else {
      intent = await PaymentIntent.findById(paymentIntentId)
        .select("amountMinor parentPayableMinor payerMode initiatedBy")
        .lean<typeof intent>();
    }
  }
  const parentUserId =
    intent?.initiatedBy ||
    (metadata?.parentUserId && mongoose.Types.ObjectId.isValid(metadata.parentUserId)
      ? new mongoose.Types.ObjectId(metadata.parentUserId)
      : null);
  const metadataInvoiceAmountMinor = Number(metadata?.invoiceAmountMinor || 0);
  const amountMinor = Math.max(
    0,
    Math.round(
      Number(intent?.amountMinor || 0) ||
        (Number.isFinite(metadataInvoiceAmountMinor)
          ? metadataInvoiceAmountMinor
          : 0) ||
        gatewayAmountMinor - platformFeeMinor
    )
  );
  const netSchoolAmountMinor = Math.max(
    0,
    gatewayAmountMinor - platformFeeMinor - processorFeeMinor
  );

  // Idempotency: payment already exists for this Paystack reference
  const existingPaymentRaw = await Payment.findOne({
    schoolId: schoolIdObj,
    paystackReference: reference,
    status: { $nin: ["reversed", "failed"] },
  })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId } | null>();
  const existingPayment = Array.isArray(existingPaymentRaw)
    ? existingPaymentRaw[0]
    : existingPaymentRaw;

  if (existingPayment) {
    await reconcileInvoicePaymentState({
      schoolId: schoolIdObj,
      invoiceId: invoiceIdObj,
    }).catch((error) => {
      console.error("Paystack webhook: existing payment rebalance failed", {
        reference,
        invoiceId,
        error,
      });
    });
    if (paymentIntentId) {
      await PaymentIntent.findByIdAndUpdate(paymentIntentId, {
        $set: {
          status: "succeeded",
          paymentId: existingPayment._id,
          paystackReference: reference,
          platformFeeMinor,
          processorFeeMinor,
          netSchoolAmountMinor,
          parentPayableMinor: intent?.parentPayableMinor || gatewayAmountMinor,
          failureReason: null,
          expiresAt: null,
        },
      }).catch(() => undefined);
    }
    console.log(`Paystack webhook: Fee payment already recorded: ${reference}`);
    return;
  }

  if (paymentIntentId && !intentLockAcquired) {
    console.log("Paystack webhook: Fee payment is already being processed", {
      reference,
      paymentIntentId: String(paymentIntentId),
    });
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
      platformFeeMinor,
      processorFeeMinor,
      netSchoolAmountMinor,
      gatewayAmountMinor,
      payerMode: intent?.payerMode || metadata?.payerMode || "school_absorbs",
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
  const receiptNumber = internalReference || learnReceiptNumber(String(paymentId));

  const now = new Date();
  await Payment.create({
    _id: paymentId,
    schoolId: schoolIdObj,
    studentId: studentIdObj,
    invoiceId: invoice._id,
    paymentIntentId,
    amountMinor,
    platformFeeMinor,
    processorFeeMinor,
    netSchoolAmountMinor,
    paymentDate,
    paymentMethod: "paystack",
    paystackReference: reference,
    paystackTransactionId: data.id ? String(data.id) : null,
    reconciliationStatus: "gateway_verified",
    gatewayVerifiedAt: now,
    gatewayResponse: {
      id: data.id ?? null,
      status: data.status,
      channel: data.channel || null,
      gatewayResponse: data.gateway_response || null,
      currency: data.currency || null,
      fees: processorFeeMinor,
      gatewayAmountMinor,
      paidAt: data.paid_at || null,
      createdAt: data.created_at || null,
      edusentrixTransactionFeeMinor: platformFeeMinor,
      netSchoolAmountMinor,
    },
    internalReference,
    receiptNumber,
    status: "completed",
    approvalStatus: "not_required",
    receivedBy: null,
  });

  if (paymentIntentId) {
    await PaymentIntent.findByIdAndUpdate(paymentIntentId, {
      $set: {
        status: "succeeded",
        paymentId,
        paystackReference: reference,
        platformFeeMinor,
        processorFeeMinor,
        netSchoolAmountMinor,
        parentPayableMinor: intent?.parentPayableMinor || gatewayAmountMinor,
        failureReason: null,
        expiresAt: null,
      },
    }).catch(() => undefined);
  }

  if (allocations.length > 0) {
    await PaymentAllocation.bulkWrite(
      allocations.map((a) => ({
        updateOne: {
          filter: {
            paymentId,
            invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
            installmentScheduleId: null,
            installmentNumber: null,
          },
          update: {
            $setOnInsert: {
              paymentId,
              invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
              amountMinor: a.amountMinor,
              installmentScheduleId: null,
              installmentNumber: null,
              notes: null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
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
      platformFeeMinor,
      processorFeeMinor,
      netSchoolAmountMinor,
      gatewayAmountMinor,
      allocatedMinor,
      unallocatedMinor,
      automated: true,
    },
  });

  const financeAuditStreamKey = `school:${schoolId}:finance`;
  const auditSession = await mongoose.startSession();
  try {
    await auditSession.withTransaction(async () => {
      await writeTransactionalAuditEvent(auditSession, {
        actionCode: "payment.recorded",
        scopeType: "school",
        scopeId: schoolId,
        result: "succeeded",
        target: {
          targetEntityType: "Payment",
          targetEntityId: paymentId,
          secondaryEntityType: "Invoice",
          secondaryEntityId: invoice._id,
        },
        context: buildPaystackWebhookAuditContext(req, {
          schoolId: schoolIdObj,
          idempotencyKey: resolveAuditIdempotencyKey(req, `paystack:${reference}`),
        }),
        payload: {
          metadata: {
            amountMinor,
            gatewayAmountMinor,
            netSchoolAmountMinor,
            channel: data.channel,
          },
        },
        streamKey: financeAuditStreamKey,
      });
    });
  } finally {
    await auditSession.endSession();
  }

  const { invoice: reconciledInvoice } = await reconcileInvoicePaymentState({
    schoolId: schoolIdObj,
    invoiceId: invoice._id,
  });
  const finalInvoice = reconciledInvoice || invoice;

  await sendFeePaymentFollowUps({
    schoolId: schoolIdObj,
    studentId: studentIdObj,
    invoiceId: invoice._id,
    paymentId,
    parentUserId,
    amountMinor,
    balanceMinor: Math.max(0, Number(finalInvoice.totalOutstandingMinor || 0)),
    receiptNumber,
    reference,
    paymentDate,
  });

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

async function handleStoreOrderSuccess(event: PaystackEvent) {
  const { data } = event;
  const { reference, amount, status, metadata } = data;

  if (status !== "success") return;

  const schoolId = metadata?.schoolId;
  const storeOrderId = metadata?.storeOrderId;
  if (
    !schoolId ||
    !storeOrderId ||
    !mongoose.Types.ObjectId.isValid(schoolId) ||
    !mongoose.Types.ObjectId.isValid(storeOrderId)
  ) {
    console.error("Paystack webhook: Invalid store order metadata");
    return;
  }

  await connectToDatabase();

  const schoolIdObj = new mongoose.Types.ObjectId(schoolId);
  const order = await StoreOrder.findOne({
    _id: new mongoose.Types.ObjectId(storeOrderId),
    schoolId: schoolIdObj,
  }).lean();

  if (!order) {
    console.error("Paystack webhook: Store order not found", storeOrderId);
    return;
  }

  if (order.status === "paid") {
    console.log("Paystack webhook: Store order already paid", storeOrderId);
    return;
  }

  if (order.status !== "pending_payment") {
    console.error("Paystack webhook: Store order not pending", order.status);
    return;
  }

  const amountMinor = Math.round(amount);
  if (amountMinor !== order.totalMinor) {
    console.error("Paystack webhook: Store order amount mismatch", {
      amountMinor,
      expected: order.totalMinor,
    });
    return;
  }

  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
  const platformFeeMinor = Math.max(
    0,
    Math.round(Number(metadata?.edusentrixTransactionFeeMinor || 0))
  );

  await StoreOrder.findByIdAndUpdate(order._id, {
    $set: {
      status: "paid",
      paystackReference: reference,
      paidAt,
      failureReason: null,
    },
  });

  const parentUser = await User.findById(order.parentUserId)
    .select("email firstName lastName")
    .lean<{ email?: string; firstName?: string; lastName?: string } | null>();
  const stu = await Student.findById(order.studentId)
    .select("firstName lastName")
    .lean<{ firstName: string; lastName: string } | null>();
  const studentName = stu ? `${stu.firstName} ${stu.lastName}` : null;
  const parentName =
    [parentUser?.firstName, parentUser?.lastName].filter(Boolean).join(" ") ||
    null;

  const lineSummary = order.lines
    .map((l) => `${l.nameSnapshot} ×${l.quantity}`)
    .join(", ");

  try {
    await recordStoreSaleInLedger({
      schoolId: String(order.schoolId),
      storeOrderId: String(order._id),
      amountMinor,
      feeAmountMinor: platformFeeMinor,
      paymentMethod: "paystack",
      gatewayReference: reference,
      parentName,
      parentEmail: parentUser?.email || null,
      studentName,
      studentId: String(order.studentId),
      lineSummary,
      occurredAt: paidAt,
    });
  } catch (ledgerError) {
    console.error("Failed to record store sale in ledger:", ledgerError);
  }

  try {
    await recordActivity({
      schoolId: order.schoolId,
      userId: order.parentUserId,
      type: "store.order_paid",
      entityType: "store_order",
      entityId: order._id,
      description: `Store purchase: ${formatMoney(amountMinor)} (${lineSummary})`,
      metadata: {
        paystackReference: reference,
        studentId: String(order.studentId),
      },
    });
  } catch (e) {
    console.error("Store order activity log failed:", e);
  }

  console.log(`Paystack webhook: Store order paid ${storeOrderId}, ref ${reference}`);
}

async function handleTransferUpdate(event: PaystackEvent) {
  const reference = event.data?.reference;
  if (!reference) return;

  await connectToDatabase();

  const statusUpdate =
    event.event === "transfer.success"
      ? "completed"
      : event.event === "transfer.reversed"
        ? "cancelled"
        : "failed";

  const existing = await SchoolDisbursement.findOne({ reference })
    .select("_id amountMinor platformFeeMinor processorFeeMinor")
    .lean<{
      _id: mongoose.Types.ObjectId;
      amountMinor: number;
      platformFeeMinor: number;
      processorFeeMinor: number;
    } | null>();

  if (!existing) {
    return;
  }

  const update = buildTransferReconciliationUpdate({
    amountMinor: existing.amountMinor,
    platformFeeMinor: existing.platformFeeMinor,
    existingProcessorFeeMinor: existing.processorFeeMinor,
    transfer: {
      id: event.data?.id,
      transfer_code: event.data?.transfer_code,
      status: event.data?.status || event.event.replace("transfer.", ""),
      reason: event.data?.gateway_response || null,
      fee_charged: event.data?.fee_charged,
      reference,
      gateway_response: event.data?.gateway_response || null,
    },
  });

  await SchoolDisbursement.findByIdAndUpdate(
    existing._id,
    {
      $set: {
        status: statusUpdate,
        processedAt: update.processedAt,
        processorFeeMinor: update.processorFeeMinor,
        totalDebitMinor: update.totalDebitMinor,
        "gateway.transferCode": update.gateway.transferCode,
        "gateway.transferId": update.gateway.transferId,
        "gateway.transferStatus": update.gateway.transferStatus,
        "gateway.response": event.data,
        "gateway.lastError":
          event.event === "transfer.success"
            ? null
            : update.gateway.lastError,
      },
    }
  );
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

// ============================================================================
// Admissions fee handlers (Phase 5 — application fee collection)
// ============================================================================

async function handleAdmissionsFeeSuccess(event: PaystackEvent) {
  const { data } = event;
  if (data.status !== "success") return;

  const outcome = await markFeePaidByReference({
    reference: data.reference,
    amountMinor: Math.round(data.amount),
    currency: data.currency || "GHS",
    paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
    channel: data.channel ?? null,
    paystackMeta: {
      paystackId: data.id ?? null,
      status: data.status,
      gatewayResponse: data.gateway_response ?? null,
    },
  });

  if (outcome.status === "not_found") {
    console.error(
      `Paystack webhook: admissions fee reference not found: ${data.reference}`
    );
    return;
  }
  console.log(
    `Paystack webhook: admissions fee ${outcome.status} for ${outcome.status === "skipped" ? data.reference : outcome.applicationId}`
  );
}

async function handleAdmissionsFeeFailure(event: PaystackEvent) {
  const { data } = event;
  await markFeeFailedByReference({
    reference: data.reference,
    amountMinor: Math.round(data.amount),
    currency: data.currency || "GHS",
    failureReason: data.gateway_response || data.status || "Payment failed",
  });
}
