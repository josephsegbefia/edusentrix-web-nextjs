import "server-only";

import { Types } from "mongoose";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { School } from "@/models/School";
import { StoredAsset } from "@/models/StoredAsset";
import { Student } from "@/models/Student";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { EmailMessage, type IEmailMessage } from "@/models/EmailMessage";
import { ensureReceiptVerification } from "@/lib/finance/receipt-verification";
import { renderLearnReceiptPdf } from "@/lib/learn/receipt-pdf";
import { renderSubscriptionReceiptPdf } from "@/lib/subscriptions/subscription-receipts";
import { getR2Port } from "@/lib/storage/r2";
import { getStoredAssetBytes } from "@/lib/storage/service";
import { parseStoredAssetId } from "@/lib/storage/urls";
import { getAppUrl } from "@/lib/utils/getAppUrl";

export type ReconstructedAttachment = {
  name: string;
  contentBase64: string;
};

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

async function streamToBuffer(
  body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | null
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Symbol.asyncIterator in (body as object)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function reconstructFeeReceiptPdf(paymentId: string): Promise<ReconstructedAttachment | null> {
  if (!Types.ObjectId.isValid(paymentId)) return null;
  const payment = await Payment.findById(paymentId).lean();
  if (!payment || payment.status !== "completed") return null;

  const [school, student, invoice] = await Promise.all([
    School.findById(payment.schoolId)
      .select("name logo")
      .lean<{ name?: string | null; logo?: string | null } | null>(),
    Student.findOne({ _id: payment.studentId, schoolId: payment.schoolId })
      .select("firstName middleName lastName")
      .lean<{
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
      } | null>(),
    payment.invoiceId
      ? Invoice.findOne({ _id: payment.invoiceId, schoolId: payment.schoolId })
          .select("totalOutstandingMinor")
          .lean<{ totalOutstandingMinor?: number | null } | null>()
      : Promise.resolve(null),
  ]);

  const schoolName = school?.name || "School";
  const receiptNumber =
    payment.receiptNumber || `FEE-${String(payment._id).slice(-8).toUpperCase()}`;
  const issuedAt = payment.paymentDate || payment.createdAt || new Date();
  const verification = await ensureReceiptVerification({
    schoolId: payment.schoolId,
    schoolName,
    issuedBy: payment.receivedBy || payment.studentId,
    receiptNumber,
    receiptTitle: "School Fee Payment Receipt",
    issuedAt,
    amountPaidMinor: payment.amountMinor || 0,
    balanceMinor: Math.max(0, Number(invoice?.totalOutstandingMinor || 0)),
    studentName: fullName(student) || "Student",
    paymentReference: payment.paystackReference || payment.externalReference || payment.receiptNumber || null,
    sourceEntityType: "Payment",
    sourceEntityId: String(payment._id),
  });
  const verificationPath = `/verify/receipt/${encodeURIComponent(verification.verificationId)}`;
  const pdf = await renderLearnReceiptPdf({
    receiptNumber,
    title: "School Fee Payment Receipt",
    schoolName,
    schoolLogoUrl: absoluteAssetUrl(school?.logo),
    studentName: fullName(student) || "Student",
    amountMinor: payment.amountMinor || 0,
    balanceMinor: Math.max(0, Number(invoice?.totalOutstandingMinor || 0)),
    currency: "GHS",
    status: payment.status,
    reference: payment.paystackReference || payment.externalReference || payment.receiptNumber,
    issuedAt,
    description: "School fee payment",
    verificationId: verification.verificationId,
    verificationUrl: `${getAppUrl().replace(/\/$/, "")}${verificationPath}`,
  });

  return {
    name: `${receiptNumber}.pdf`,
    contentBase64: Buffer.from(pdf).toString("base64"),
  };
}

export async function reconstructSubscriptionReceiptPdf(
  invoiceId: string
): Promise<ReconstructedAttachment | null> {
  if (!Types.ObjectId.isValid(invoiceId)) return null;
  const invoice = await SubscriptionInvoice.findById(invoiceId);
  if (!invoice || invoice.status !== "paid") return null;
  const school = await School.findById(invoice.schoolId)
    .select("name")
    .lean<{ name?: string | null } | null>();
  const pdf = await renderSubscriptionReceiptPdf({
    invoice: invoice.toObject(),
    schoolName: school?.name || "School",
  });
  return {
    name: `${invoice.invoiceNumber}-receipt.pdf`,
    contentBase64: pdf.toString("base64"),
  };
}

async function loadStoredAttachment(input: {
  storageKey: string;
  name: string;
  schoolId?: string | null;
}): Promise<ReconstructedAttachment | null> {
  const assetId = parseStoredAssetId(input.storageKey);
  if (assetId) {
    const stored = await getStoredAssetBytes({
      assetId,
      schoolId: input.schoolId || undefined,
    });
    return {
      name: stored.fileName || input.name,
      contentBase64: stored.buffer.toString("base64"),
    };
  }

  const byKey = await StoredAsset.findOne({ storageKey: input.storageKey })
    .select("_id schoolId")
    .lean<{ _id: Types.ObjectId; schoolId?: Types.ObjectId | null } | null>();
  if (byKey) {
    const stored = await getStoredAssetBytes({
      assetId: String(byKey._id),
      schoolId: input.schoolId || undefined,
    });
    return {
      name: stored.fileName || input.name,
      contentBase64: stored.buffer.toString("base64"),
    };
  }

  const object = await getR2Port().getObjectStream(input.storageKey);
  const buffer = await streamToBuffer(object.body);
  if (!buffer.byteLength) return null;
  return {
    name: input.name,
    contentBase64: buffer.toString("base64"),
  };
}

/**
 * Rebuild provider attachments from EmailMessage IDs/metadata.
 * Never reads bytes from BackgroundJob input.
 */
export async function reconstructDispatchAttachments(
  message: Pick<
    IEmailMessage,
    "relatedEntityType" | "relatedEntityId" | "attachments" | "schoolId"
  >
): Promise<ReconstructedAttachment[]> {
  if (message.relatedEntityType === "Payment" && message.relatedEntityId) {
    const pdf = await reconstructFeeReceiptPdf(message.relatedEntityId);
    return pdf ? [pdf] : [];
  }

  if (message.relatedEntityType === "SubscriptionInvoice" && message.relatedEntityId) {
    const pdf = await reconstructSubscriptionReceiptPdf(message.relatedEntityId);
    return pdf ? [pdf] : [];
  }

  const attachments: ReconstructedAttachment[] = [];
  const schoolId = message.schoolId ? String(message.schoolId) : null;
  for (const attachment of message.attachments || []) {
    if (!attachment.storageKey) continue;
    const rebuilt = await loadStoredAttachment({
      storageKey: attachment.storageKey,
      name: attachment.name,
      schoolId,
    });
    if (rebuilt) attachments.push(rebuilt);
  }
  return attachments;
}

export async function findReusableOutboundEmailMessage(input: {
  relatedEntityType: string;
  relatedEntityId: string;
  to: string;
}) {
  return EmailMessage.findOne({
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    to: input.to,
    direction: "outbound",
  }).sort({ createdAt: 1 });
}
