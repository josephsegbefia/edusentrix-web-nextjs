import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { PaystackTransactionVerification } from "@/lib/paystack";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AuditEvent } from "@/models/AuditEvent";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { Notification } from "@/models/Notification";

export type LearnPaymentFulfillActor = "webhook" | "verify";

export type LearnPaymentFulfillResult = {
  ok: boolean;
  alreadyFulfilled: boolean;
  paymentIntentId: string;
  accessId: string | null;
  studentId: string;
  message: string;
};

function parseObjectId(value: string | undefined | null) {
  if (!value || !Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

function learnMetadataFromVerification(verification: PaystackTransactionVerification) {
  const metadata = verification.metadata || {};
  return {
    type: String(metadata.type || ""),
    schoolId: String(metadata.schoolId || ""),
    studentId: String(metadata.studentId || ""),
    accountId: String(metadata.accountId || ""),
    parentUserId: String(metadata.parentUserId || ""),
    paymentIntentId: String(metadata.paymentIntentId || ""),
    academicPeriodId: metadata.academicPeriodId
      ? String(metadata.academicPeriodId)
      : null,
  };
}

export function learnVerificationMatchesIntent(args: {
  verification: PaystackTransactionVerification;
  intent: {
    _id: Types.ObjectId;
    schoolId: Types.ObjectId;
    studentId: Types.ObjectId;
    accountId?: Types.ObjectId | null;
    amountMinor: number;
  };
}) {
  const metadata = learnMetadataFromVerification(args.verification);
  const verifiedAmountMinor = Math.round(Number(args.verification.amount || 0));

  return (
    metadata.type === "learn_access" &&
    metadata.paymentIntentId === String(args.intent._id) &&
    metadata.schoolId === String(args.intent.schoolId) &&
    metadata.studentId === String(args.intent.studentId) &&
    (!args.intent.accountId ||
      metadata.accountId === String(args.intent.accountId)) &&
    verifiedAmountMinor === Number(args.intent.amountMinor || 0)
  );
}

/**
 * Idempotent fulfillment for a successful parent Learn Paystack charge.
 * Safe to call from the webhook or the parent verify fallback.
 */
export async function fulfillLearnPaymentSuccess(input: {
  reference: string;
  verification: PaystackTransactionVerification;
  actorType?: LearnPaymentFulfillActor;
}): Promise<LearnPaymentFulfillResult> {
  await connectToDatabase();

  const metadata = learnMetadataFromVerification(input.verification);
  const schoolIdObj = parseObjectId(metadata.schoolId);
  const studentIdObj = parseObjectId(metadata.studentId);
  const accountIdObj = parseObjectId(metadata.accountId);
  const parentUserIdObj = parseObjectId(metadata.parentUserId);
  const paymentIntentIdObj = parseObjectId(metadata.paymentIntentId);

  if (
    metadata.type !== "learn_access" ||
    !schoolIdObj ||
    !studentIdObj ||
    !accountIdObj ||
    !parentUserIdObj ||
    !paymentIntentIdObj
  ) {
    return {
      ok: false,
      alreadyFulfilled: false,
      paymentIntentId: metadata.paymentIntentId || "",
      accessId: null,
      studentId: metadata.studentId || "",
      message: "Learn payment metadata is incomplete.",
    };
  }

  const existingIntent = await LearnPaymentIntent.findById(paymentIntentIdObj)
    .select("_id status accessId academicPeriodId amountMinor schoolId studentId accountId")
    .lean<{
      _id: Types.ObjectId;
      status: string;
      accessId?: Types.ObjectId | null;
      academicPeriodId?: Types.ObjectId | null;
      amountMinor: number;
      schoolId: Types.ObjectId;
      studentId: Types.ObjectId;
      accountId?: Types.ObjectId | null;
    } | null>();

  if (!existingIntent) {
    return {
      ok: false,
      alreadyFulfilled: false,
      paymentIntentId: String(paymentIntentIdObj),
      accessId: null,
      studentId: String(studentIdObj),
      message: "Learn payment intent not found.",
    };
  }

  if (!learnVerificationMatchesIntent({ verification: input.verification, intent: existingIntent })) {
    return {
      ok: false,
      alreadyFulfilled: false,
      paymentIntentId: String(paymentIntentIdObj),
      accessId: null,
      studentId: String(studentIdObj),
      message: "Paystack payment details do not match this Learn checkout.",
    };
  }

  if (existingIntent.status === "succeeded" && existingIntent.accessId) {
    return {
      ok: true,
      alreadyFulfilled: true,
      paymentIntentId: String(paymentIntentIdObj),
      accessId: String(existingIntent.accessId),
      studentId: String(studentIdObj),
      message: "Learn access is already active for this payment.",
    };
  }

  const now = new Date();
  const existingActiveAccess = await LearnAccess.findOne({
    schoolId: schoolIdObj,
    studentId: studentIdObj,
    status: "active",
    expiresAt: { $gt: now },
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  let accessId = existingActiveAccess?._id || null;
  if (!accessId) {
    const academicPeriodId =
      existingIntent.academicPeriodId ||
      parseObjectId(metadata.academicPeriodId);
    const period = academicPeriodId
      ? await AcademicPeriod.findOne({ _id: academicPeriodId, schoolId: schoolIdObj })
          .select("_id endDate")
          .lean<{ _id: Types.ObjectId; endDate: Date } | null>()
      : await AcademicPeriod.findOne({ schoolId: schoolIdObj, isCurrent: true })
          .select("_id endDate")
          .lean<{ _id: Types.ObjectId; endDate: Date } | null>();
    const fallbackExpiry = new Date(now);
    fallbackExpiry.setDate(fallbackExpiry.getDate() + 120);

    const access = await LearnAccess.create({
      schoolId: schoolIdObj,
      studentId: studentIdObj,
      accountId: accountIdObj,
      academicPeriodId: period?._id || null,
      source: "parent_paid",
      status: "active",
      startsAt: now,
      expiresAt: period?.endDate && period.endDate > now ? period.endDate : fallbackExpiry,
      paymentIntentId: paymentIntentIdObj,
      grantedBy: parentUserIdObj,
      note: "Activated by parent Learn checkout.",
    });
    accessId = access._id as Types.ObjectId;
  }

  const amountMinor = Math.round(Number(input.verification.amount || existingIntent.amountMinor));
  const paidAt = input.verification.paid_at
    ? new Date(input.verification.paid_at)
    : now;

  await LearnPaymentIntent.findByIdAndUpdate(paymentIntentIdObj, {
    $set: {
      status: "succeeded",
      accessId,
      paystackReference: input.reference,
      succeededAt: paidAt,
      failureReason: null,
      gatewayMetadata: {
        amountMinor,
        currency: input.verification.currency,
        channel: input.verification.channel,
        paystackId: input.verification.id ?? null,
        gatewayResponse:
          typeof input.verification.metadata?.gateway_response === "string"
            ? input.verification.metadata.gateway_response
            : null,
      },
    },
  });

  const actorType = input.actorType || "webhook";

  if (!existingIntent.accessId || existingIntent.status !== "succeeded") {
    await Promise.all([
      Notification.create({
        schoolId: schoolIdObj,
        userId: parentUserIdObj,
        type: "system",
        title: "EduSentrix Learn access activated",
        body: "Your EduSentrix Learn payment was successful and access is now active.",
        priority: "high",
        isRead: false,
        wardId: studentIdObj,
        entityType: "LearnAccess",
        entityId: accessId,
        actionUrl: `/parent/learn/wards/${String(studentIdObj)}`,
        metadata: {
          paymentIntentId: String(paymentIntentIdObj),
          paystackReference: input.reference,
        },
      }),
      AuditEvent.create({
        scopeType: "school",
        scopeId: schoolIdObj,
        domain: "billing",
        tier: 1,
        actionCode: "learn.payment.succeeded",
        result: "succeeded",
        occurredAt: paidAt,
        actorType: actorType === "verify" ? "user" : "webhook",
        actorId: parentUserIdObj,
        targetEntityType: "LearnPaymentIntent",
        targetEntityId: paymentIntentIdObj,
        secondaryEntityType: "LearnAccess",
        secondaryEntityId: accessId,
        metadata: {
          amountMinor,
          currency: input.verification.currency,
          paystackReference: input.reference,
          fulfillmentSource: actorType,
        },
        sensitivity: "moderate",
        redactionMode: "masked",
        retentionClass: "financial_critical",
      }),
    ]);
  }

  return {
    ok: true,
    alreadyFulfilled: false,
    paymentIntentId: String(paymentIntentIdObj),
    accessId: String(accessId),
    studentId: String(studentIdObj),
    message: "Learn access activated.",
  };
}

export async function markLearnPaymentFailed(input: {
  paymentIntentId: Types.ObjectId;
  reference: string;
  failureReason: string;
  verification?: PaystackTransactionVerification;
}) {
  await connectToDatabase();

  const existing = await LearnPaymentIntent.findById(input.paymentIntentId)
    .select("status schoolId studentId parentUserId")
    .lean<{
      status: string;
      schoolId: Types.ObjectId;
      studentId: Types.ObjectId;
      parentUserId: Types.ObjectId;
    } | null>();

  if (!existing || existing.status === "failed") return;

  await LearnPaymentIntent.findByIdAndUpdate(input.paymentIntentId, {
    $set: {
      status: "failed",
      paystackReference: input.reference,
      failureReason: input.failureReason,
      gatewayMetadata: input.verification
        ? {
            currency: input.verification.currency,
            channel: input.verification.channel,
            paystackId: input.verification.id ?? null,
          }
        : undefined,
    },
  });

  const intent = existing;

  await Notification.create({
    schoolId: intent.schoolId,
    userId: intent.parentUserId,
    type: "system",
    title: "EduSentrix Learn payment failed",
    body: input.failureReason,
    priority: "normal",
    isRead: false,
    wardId: intent.studentId,
    entityType: "LearnPaymentIntent",
    entityId: input.paymentIntentId,
    actionUrl: `/parent/learn/wards/${String(intent.studentId)}`,
  });
}
