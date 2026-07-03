import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

export type LearnReceiptPdfInput = {
  receiptNumber: string;
  title?: string;
  schoolName: string;
  schoolLogoUrl?: string | null;
  studentName: string;
  payerName?: string | null;
  amountMinor: number;
  balanceMinor?: number | null;
  currency: "GHS";
  status: string;
  reference?: string | null;
  issuedAt?: Date | null;
  description?: string;
  verificationId?: string | null;
  verificationUrl?: string | null;
};

const slate = rgb(0.06, 0.1, 0.16);
const slate2 = rgb(0.09, 0.14, 0.22);
const teal = rgb(0.02, 0.55, 0.52);
const cyan = rgb(0.16, 0.78, 0.86);
const emerald = rgb(0.02, 0.58, 0.32);
const muted = rgb(0.42, 0.47, 0.55);
const line = rgb(0.86, 0.9, 0.94);

function formatMoney(minor: number, currency: string) {
  if (currency === "GHS") {
    return `GHS ${(minor / 100).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function formatDate(date?: Date | null) {
  return date
    ? date.toLocaleDateString("en-GH", {
        dateStyle: "medium",
        timeZone: "Africa/Accra",
      })
    : "Not issued";
}

function formatDateTime(date?: Date | null) {
  return date
    ? date.toLocaleString("en-GH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Accra",
      })
    : "Not issued";
}

function safeText(value: string | null | undefined, fallback = "Not recorded") {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, 120);
}

function fitText(value: string, max = 46) {
  const text = safeText(value, "");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function drawText(page: PDFPage, text: string, x: number, y: number, options: {
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
  maxWidth?: number;
}) {
  const clean = safeText(text, "");
  if (!options.maxWidth) {
    page.drawText(clean, { x, y, size: options.size, font: options.font, color: options.color ?? slate });
    return;
  }

  let candidate = clean;
  while (candidate.length > 4 && options.font.widthOfTextAtSize(candidate, options.size) > options.maxWidth) {
    candidate = candidate.slice(0, -2);
  }
  page.drawText(candidate.length < clean.length ? `${candidate}...` : candidate, {
    x,
    y,
    size: options.size,
    font: options.font,
    color: options.color ?? slate,
  });
}

function drawField(page: PDFPage, label: string, value: string, x: number, y: number, width: number, fonts: { regular: PDFFont; bold: PDFFont }) {
  page.drawText(label.toUpperCase(), {
    x,
    y: y + 22,
    size: 7.5,
    font: fonts.bold,
    color: muted,
  });
  drawText(page, value, x, y, {
    size: 10.5,
    font: fonts.bold,
    color: slate,
    maxWidth: width,
  });
}

async function fetchLogo(url?: string | null) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (contentType.includes("png") || url.toLowerCase().includes(".png")) {
      return { bytes, type: "png" as const };
    }
    if (contentType.includes("jpeg") || contentType.includes("jpg") || /\.(jpe?g)(\?|$)/i.test(url)) {
      return { bytes, type: "jpg" as const };
    }
  } catch {
    return null;
  }
  return null;
}

async function embedQr(pdf: PDFDocument, value?: string | null) {
  if (!value) return null;
  try {
    const dataUrl = await QRCode.toDataURL(value, {
      margin: 0,
      width: 320,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    return pdf.embedPng(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}

async function embedEdusentrixLogo(pdf: PDFDocument) {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo", "edusentrix-logo-transparent.png");
    const bytes = await fs.readFile(logoPath);
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

export async function renderLearnReceiptPdf(input: LearnReceiptPdfInput): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  const height = page.getHeight();
  const fonts = { regular, bold };
  const edusentrixLogo = await embedEdusentrixLogo(pdf);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.97, 0.985, 0.995) });
  page.drawRectangle({ x: 0, y: height - 176, width, height: 176, color: slate });
  page.drawRectangle({ x: 0, y: height - 176, width, height: 8, color: cyan });
  page.drawCircle({ x: 506, y: 800, size: 108, color: rgb(0.04, 0.28, 0.31), opacity: 0.28 });
  page.drawCircle({ x: 52, y: 733, size: 84, color: rgb(0.03, 0.42, 0.39), opacity: 0.18 });

  const logo = await fetchLogo(input.schoolLogoUrl);
  if (logo) {
    try {
      const image = logo.type === "png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
      page.drawRectangle({ x: 46, y: 760, width: 58, height: 58, color: rgb(1, 1, 1), opacity: 0.96 });
      page.drawImage(image, { x: 52, y: 766, width: 46, height: 46 });
    } catch {
      page.drawRectangle({ x: 46, y: 760, width: 58, height: 58, color: rgb(1, 1, 1), opacity: 0.96 });
      page.drawText("S", { x: 67, y: 779, size: 22, font: bold, color: teal });
    }
  } else {
    page.drawRectangle({ x: 46, y: 760, width: 58, height: 58, color: rgb(1, 1, 1), opacity: 0.96 });
    page.drawText("S", { x: 67, y: 779, size: 22, font: bold, color: teal });
  }

  drawText(page, input.schoolName, 116, 796, { size: 18, font: bold, color: rgb(1, 1, 1), maxWidth: 290 });
  page.drawText("Official payment receipt", { x: 116, y: 775, size: 10.5, font: regular, color: rgb(0.78, 0.9, 0.94) });

  if (edusentrixLogo) {
    page.drawImage(edusentrixLogo, { x: 399, y: 776, width: 32, height: 32 });
  } else {
    page.drawRectangle({ x: 406, y: 781, width: 24, height: 24, color: rgb(1, 1, 1), opacity: 0.96 });
    page.drawRectangle({ x: 412, y: 787, width: 4, height: 12, color: teal });
    page.drawRectangle({ x: 418, y: 795, width: 7, height: 4, color: cyan });
    page.drawRectangle({ x: 418, y: 787, width: 7, height: 4, color: cyan });
  }
  page.drawText("EduSentrix", { x: 438, y: 798, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("verified finance record", { x: 438, y: 780, size: 8.5, font: regular, color: rgb(0.74, 0.9, 0.92) });

  drawText(page, input.title || "Payment Receipt", 46, 714, {
    size: 22,
    font: bold,
    color: rgb(1, 1, 1),
    maxWidth: 300,
  });
  page.drawText(`Receipt No. ${safeText(input.receiptNumber)}`, {
    x: 46,
    y: 690,
    size: 11,
    font: regular,
    color: rgb(0.76, 0.91, 0.94),
  });

  page.drawRectangle({ x: 372, y: 666, width: 177, height: 66, color: rgb(1, 1, 1), opacity: 0.98 });
  page.drawRectangle({ x: 372, y: 728, width: 177, height: 4, color: cyan });
  page.drawText("TOTAL PAID", { x: 390, y: 710, size: 8, font: bold, color: muted });
  page.drawText(formatMoney(input.amountMinor, input.currency), { x: 390, y: 687, size: 18, font: bold, color: emerald });
  page.drawText(`Status: ${safeText(input.status).replace(/_/g, " ").toUpperCase()}`, {
    x: 390,
    y: 674,
    size: 8.5,
    font: bold,
    color: teal,
  });

  page.drawRectangle({ x: 46, y: 454, width: 503, height: 146, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 46, y: 596, width: 503, height: 4, color: teal });
  drawField(page, "Student", safeText(input.studentName, "Student"), 70, 552, 190, fonts);
  drawField(page, "Payer", safeText(input.payerName, "Parent/guardian"), 306, 552, 190, fonts);
  drawField(page, "Issued", formatDateTime(input.issuedAt), 70, 500, 190, fonts);
  drawField(page, "Payment reference", safeText(input.reference), 306, 500, 190, fonts);

  page.drawRectangle({ x: 46, y: 308, width: 503, height: 104, color: rgb(1, 1, 1) });
  page.drawText("Payment details", { x: 70, y: 382, size: 13, font: bold, color: slate });
  page.drawLine({ start: { x: 70, y: 366 }, end: { x: 525, y: 366 }, thickness: 1, color: line });
  page.drawText(fitText(input.description || "Payment", 54), { x: 70, y: 340, size: 10.5, font: regular, color: slate });
  page.drawText(formatMoney(input.amountMinor, input.currency), { x: 428, y: 340, size: 10.5, font: bold, color: slate });
  page.drawLine({ start: { x: 356, y: 326 }, end: { x: 525, y: 326 }, thickness: 0.8, color: line });
  page.drawText("Balance after payment", { x: 356, y: 304, size: 9, font: regular, color: muted });
  page.drawText(formatMoney(Math.max(0, input.balanceMinor ?? 0), input.currency), {
    x: 454,
    y: 304,
    size: 10,
    font: bold,
    color: Math.max(0, input.balanceMinor ?? 0) > 0 ? rgb(0.78, 0.34, 0.05) : emerald,
  });

  const verificationId = input.verificationId || "Not registered";
  const verificationUrl = input.verificationUrl || "";
  const qr = await embedQr(pdf, verificationUrl);
  page.drawRectangle({ x: 46, y: 112, width: 503, height: 146, color: slate2 });
  page.drawText("Authenticity verification", { x: 70, y: 226, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText("This receipt is backed by EduSentrix verification records.", {
    x: 70,
    y: 207,
    size: 9.5,
    font: regular,
    color: rgb(0.78, 0.86, 0.92),
  });
  page.drawText(`Verification ID: ${safeText(verificationId)}`, {
    x: 70,
    y: 181,
    size: 9.5,
    font: bold,
    color: cyan,
  });
  drawText(page, verificationUrl ? `Verify at: ${verificationUrl}` : "Verify from the EduSentrix verification page.", 70, 160, {
    size: 8,
    font: regular,
    color: rgb(0.76, 0.84, 0.9),
    maxWidth: 318,
  });
  page.drawText(`Issued: ${formatDate(input.issuedAt)}`, { x: 70, y: 139, size: 8, font: regular, color: rgb(0.68, 0.76, 0.82) });

  if (qr) {
    page.drawRectangle({ x: 438, y: 136, width: 86, height: 86, color: rgb(1, 1, 1) });
    page.drawImage(qr, { x: 444, y: 142, width: 74, height: 74 });
  } else {
    page.drawRectangle({ x: 438, y: 136, width: 86, height: 86, color: rgb(1, 1, 1), opacity: 0.94 });
    page.drawText("VERIFY", { x: 455, y: 178, size: 12, font: bold, color: teal });
  }

  page.drawText("Generated by EduSentrix School OS. Manual edits invalidate this receipt.", {
    x: 46,
    y: 64,
    size: 8.5,
    font: regular,
    color: muted,
  });
  page.drawText("tryedusentrix.app", { x: 461, y: 64, size: 8.5, font: bold, color: teal });

  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function learnReceiptNumber(paymentIntentId: string) {
  return `LEARN-${paymentIntentId.slice(-8).toUpperCase()}`;
}
