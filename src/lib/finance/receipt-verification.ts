import "server-only";

import crypto from "node:crypto";
import { Types } from "mongoose";
import { ReportVerification } from "@/models/ReportVerification";

type ReceiptVerificationInput = {
  schoolId: Types.ObjectId;
  schoolName: string;
  issuedBy: Types.ObjectId;
  receiptNumber: string;
  receiptTitle: string;
  issuedAt: Date;
  amountPaidMinor: number;
  balanceMinor?: number | null;
  studentName?: string | null;
  payerName?: string | null;
  paymentReference?: string | null;
  sourceEntityType: "Payment" | "LearnPaymentIntent";
  sourceEntityId: string;
};

function normalizeReceiptNumber(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildVerificationId(input: ReceiptVerificationInput) {
  const normalized = normalizeReceiptNumber(input.receiptNumber);
  const digest = crypto
    .createHash("sha256")
    .update(`${input.sourceEntityType}:${input.sourceEntityId}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  if (normalized) return `RCPT-${normalized.slice(0, 48)}-${digest.slice(0, 8)}`;
  return `RCPT-${digest}`;
}

export async function ensureReceiptVerification(input: ReceiptVerificationInput) {
  const verificationId = buildVerificationId(input);
  const issuedAt = Number.isNaN(input.issuedAt.getTime()) ? new Date() : input.issuedAt;

  const verification = await ReportVerification.findOneAndUpdate(
    { verificationId },
    {
      $setOnInsert: {
        verificationId,
        reportType: "payment_receipt",
        status: "issued",
        schoolId: input.schoolId,
        schoolName: input.schoolName,
        issuedBy: input.issuedBy,
        reportLabel: input.receiptTitle,
        range: {
          startDate: issuedAt,
          endDate: issuedAt,
          source: input.sourceEntityType,
          periodLabel: input.receiptNumber,
        },
        meta: {
          categories: ["finance", "receipts"],
          version: 2,
          rowCount: 1,
          receiptNumber: input.receiptNumber,
          amountPaidMinor: input.amountPaidMinor,
          balanceMinor: input.balanceMinor ?? null,
          studentName: input.studentName ?? null,
          payerName: input.payerName ?? null,
          paymentReference: input.paymentReference ?? null,
        },
        issuedAt,
        revokedAt: null,
      },
    },
    { new: true, upsert: true }
  ).lean<{ verificationId: string; issuedAt?: Date }>();

  return {
    verificationId: verification.verificationId,
    issuedAt: verification.issuedAt ?? issuedAt,
  };
}
