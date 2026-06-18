import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type LearnReceiptPdfInput = {
  receiptNumber: string;
  title?: string;
  schoolName: string;
  studentName: string;
  payerName?: string | null;
  amountMinor: number;
  currency: "GHS";
  status: string;
  reference?: string | null;
  issuedAt?: Date | null;
  description?: string;
};

function formatMoney(minor: number, currency: string) {
  if (currency === "GHS") {
    return `GHS ${(minor / 100).toFixed(2)}`;
  }

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function formatDate(date?: Date | null) {
  return date
    ? date.toLocaleDateString("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" })
    : "Not issued";
}

function safeText(value: string | null | undefined, fallback = "Not recorded") {
  return String(value || fallback).slice(0, 94);
}

export async function renderLearnReceiptPdf(input: LearnReceiptPdfInput): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();

  page.drawRectangle({ x: 0, y: 762, width, height: 80, color: rgb(0.02, 0.08, 0.14) });
  page.drawText("EduSentrix", { x: 48, y: 802, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(input.title || "Learn Payment Receipt", {
    x: 48,
    y: 778,
    size: 13,
    font: regular,
    color: rgb(0.72, 0.88, 0.92),
  });

  let y = 720;
  const drawLabel = (label: string, value: string) => {
    page.drawText(label, { x: 48, y, size: 10, font: bold, color: rgb(0.13, 0.18, 0.25) });
    page.drawText(value, { x: 190, y, size: 10, font: regular, color: rgb(0.13, 0.18, 0.25) });
    y -= 24;
  };

  page.drawText("Receipt", { x: 48, y, size: 18, font: bold, color: rgb(0.13, 0.18, 0.25) });
  page.drawText(input.receiptNumber, { x: 380, y: y + 2, size: 12, font: bold, color: rgb(0.02, 0.42, 0.46) });
  y -= 38;

  drawLabel("School", safeText(input.schoolName, "School"));
  drawLabel("Student", safeText(input.studentName, "Student"));
  drawLabel("Payer", safeText(input.payerName, "Parent/guardian"));
  drawLabel("Status", input.status.replace(/_/g, " ").toUpperCase());
  drawLabel("Issued date", formatDate(input.issuedAt));
  drawLabel("Payment reference", safeText(input.reference));

  y -= 10;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: rgb(0.84, 0.88, 0.92) });
  y -= 28;

  page.drawText("Description", { x: 48, y, size: 10, font: bold, color: rgb(0.13, 0.18, 0.25) });
  page.drawText("Amount", { x: 430, y, size: 10, font: bold, color: rgb(0.13, 0.18, 0.25) });
  y -= 22;
  page.drawText(safeText(input.description, "EduSentrix Learn access"), {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: rgb(0.13, 0.18, 0.25),
  });
  page.drawText(formatMoney(input.amountMinor, input.currency), {
    x: 430,
    y,
    size: 10,
    font: regular,
    color: rgb(0.13, 0.18, 0.25),
  });

  y -= 36;
  page.drawLine({ start: { x: 330, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.84, 0.88, 0.92) });
  y -= 24;
  page.drawText("Total paid", { x: 350, y, size: 12, font: bold, color: rgb(0.13, 0.18, 0.25) });
  page.drawText(formatMoney(input.amountMinor, input.currency), {
    x: 430,
    y,
    size: 12,
    font: bold,
    color: rgb(0.02, 0.42, 0.46),
  });

  page.drawText("This receipt is generated from EduSentrix payment records.", {
    x: 48,
    y: 110,
    size: 8,
    font: regular,
    color: rgb(0.42, 0.47, 0.55),
  });

  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function learnReceiptNumber(paymentIntentId: string) {
  return `LEARN-${paymentIntentId.slice(-8).toUpperCase()}`;
}
