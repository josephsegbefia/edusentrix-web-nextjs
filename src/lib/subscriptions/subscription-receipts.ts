import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Types } from "mongoose";
import { School } from "@/models/School";
import { SubscriptionInvoice, type ISubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { Notification } from "@/models/Notification";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { resolveSchoolBillingRecipients } from "./admin-recipients";

type PopulatedInvoice = ISubscriptionInvoice & {
  _id: Types.ObjectId;
};

function formatGhs(minor: number) {
  return `GHS ${(minor / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date | null | undefined) {
  return date
    ? date.toLocaleDateString("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" })
    : "Not set";
}

export async function renderSubscriptionReceiptPdf(input: {
  invoice: PopulatedInvoice;
  schoolName: string;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  let y = 790;

  const draw = (text: string, x: number, size = 10, font = regular, color = rgb(0.12, 0.16, 0.22)) => {
    page.drawText(text, { x, y, size, font, color });
  };
  const next = (amount = 18) => {
    y -= amount;
    if (y < 80) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
  };

  page.drawRectangle({ x: 0, y: 762, width, height: 80, color: rgb(0.02, 0.08, 0.14) });
  page.drawText("EduSentrix", { x: 48, y: 802, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Subscription Payment Receipt", {
    x: 48,
    y: 778,
    size: 13,
    font: regular,
    color: rgb(0.72, 0.88, 0.92),
  });

  y = 730;
  draw("Receipt", 48, 18, bold);
  draw(input.invoice.invoiceNumber, 400, 12, bold);
  next(26);
  draw("School", 48, 10, bold);
  draw(input.schoolName, 160);
  next();
  draw("Status", 48, 10, bold);
  draw(input.invoice.status.toUpperCase(), 160);
  next();
  draw("Paid date", 48, 10, bold);
  draw(formatDate(input.invoice.paidAt), 160);
  next();
  draw("Payment reference", 48, 10, bold);
  draw(input.invoice.paidReference || "Not recorded", 160);
  next(28);

  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: rgb(0.84, 0.88, 0.92) });
  next(22);
  draw("Description", 48, 10, bold);
  draw("Qty", 360, 10, bold);
  draw("Amount", 440, 10, bold);
  next(18);
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.88, 0.9, 0.94) });
  next(18);

  for (const line of input.invoice.lines ?? []) {
    const description = line.description.length > 62 ? `${line.description.slice(0, 59)}...` : line.description;
    draw(description, 48);
    draw(String(line.quantity), 360);
    draw(formatGhs(line.subtotalMinor), 440);
    next(18);
  }

  next(12);
  page.drawLine({ start: { x: 330, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.88, 0.9, 0.94) });
  next(18);
  draw("Subtotal", 360, 10, bold);
  draw(formatGhs(input.invoice.subtotalMinor), 440);
  next(18);
  draw("Tax", 360, 10, bold);
  draw(formatGhs(input.invoice.taxMinor), 440);
  next(18);
  draw("Total paid", 360, 12, bold);
  draw(formatGhs(input.invoice.totalMinor), 440, 12, bold, rgb(0.02, 0.42, 0.46));

  y = 110;
  page.drawText("This receipt was generated automatically after the subscription invoice was marked paid.", {
    x: 48,
    y,
    size: 8,
    font: regular,
    color: rgb(0.42, 0.47, 0.55),
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export async function sendSubscriptionReceiptForInvoice(invoiceId: string | Types.ObjectId) {
  const invoice = await SubscriptionInvoice.findById(invoiceId);
  if (!invoice || invoice.status !== "paid") {
    return { sent: 0, skipped: true, reason: "Invoice is not paid." };
  }

  const school = await School.findById(invoice.schoolId).select("name logo").lean<{
    name?: string | null;
    logo?: string | null;
  } | null>();
  const schoolName = school?.name || "School";
  const recipients = await resolveSchoolBillingRecipients(invoice.schoolId);
  if (!recipients.length) {
    return { sent: 0, skipped: true, reason: "No billing recipient found." };
  }

  const pdfBuffer = await renderSubscriptionReceiptPdf({ invoice: invoice.toObject() as PopulatedInvoice, schoolName });
  const attachment = {
    name: `${invoice.invoiceNumber}-receipt.pdf`,
    mimeType: "application/pdf",
    sizeBytes: pdfBuffer.byteLength,
    contentBase64: pdfBuffer.toString("base64"),
  };

  let sent = 0;
  for (const recipient of recipients) {
    await sendTrackedBrevoEmail({
      to: recipient.email,
      toName: recipient.name,
      subject: `Subscription receipt ${invoice.invoiceNumber}`,
      htmlContent: `<p>Your EduSentrix subscription payment has been recorded.</p><p><strong>Amount paid:</strong> ${formatGhs(invoice.totalMinor)}</p><p>The PDF receipt is attached for your records.</p>`,
      textContent: `Your EduSentrix subscription payment has been recorded. Amount paid: ${formatGhs(invoice.totalMinor)}. The PDF receipt is attached.`,
      templateKey: "PAYMENT_RECEIPT",
      schoolId: String(invoice.schoolId),
      schoolName,
      schoolLogo: school?.logo ?? null,
      attachments: [attachment],
      relatedEntityType: "SubscriptionInvoice",
      relatedEntityId: String(invoice._id),
      recipientUserId: recipient.userId ? String(recipient.userId) : null,
      recipientRole: recipient.role,
      async: true,
    });
    sent += 1;

    if (recipient.userId) {
      await Notification.create({
        schoolId: invoice.schoolId,
        userId: recipient.userId,
        type: "system",
        title: "Subscription receipt issued",
        body: `${invoice.invoiceNumber} has been marked paid. Receipt amount: ${formatGhs(invoice.totalMinor)}.`,
        priority: "normal",
        entityType: "SubscriptionInvoice",
        entityId: invoice._id,
        actionUrl: `/admin/subscription`,
        metadata: { invoiceNumber: invoice.invoiceNumber, totalMinor: invoice.totalMinor },
      });
    }
  }

  return { sent, skipped: false };
}
