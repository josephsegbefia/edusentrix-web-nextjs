import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { buildOverdueRiskSnapshot } from "@/lib/fees/overdue-risk";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { recordActivity } from "@/lib/audit/recordActivity";
import { ReportVerification } from "@/models/ReportVerification";
import { School } from "@/models/School";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 40;
const BOTTOM_GUTTER = 26;
const HEADER_HEIGHT = 98;
const MAX_LIMIT = 600;

type TableRow = {
  studentName: string;
  classGroupName: string | null;
  guardianName: string;
  guardianEmail: string | null;
  guardianPhone: string | null;
  oldestDaysOverdue: number;
  overdueInvoiceCount: number;
  totalOutstandingMinor: number;
};

type TableColumn = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
};

function parseLimit(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_LIMIT);
}

function toPdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\u20b5/g, "GHS")
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function formatDateLabel(value: Date | string | null | undefined) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatMoneyMinor(value: number) {
  const amount = (value || 0) / 100;
  return `GHS ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fitText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  size: number
) {
  const clean = toPdfText(text || "");
  if (!clean) return "-";
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;

  const ellipsis = "...";
  let sliced = clean;
  while (sliced.length > 0) {
    sliced = sliced.slice(0, -1);
    if (font.widthOfTextAtSize(`${sliced}${ellipsis}`, size) <= maxWidth) {
      return `${sliced}${ellipsis}`;
    }
  }
  return ellipsis;
}

async function fetchQrCodePng(verificationUrl: string): Promise<Uint8Array | null> {
  const qrProviderUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(
    verificationUrl
  )}`;
  try {
    const response = await fetch(qrProviderUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

function drawHeader(params: {
  page: ReturnType<PDFDocument["addPage"]>;
  schoolName: string;
  reportTitle: string;
  verificationId: string;
  generatedAt: string;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
}) {
  const { page, schoolName, reportTitle, verificationId, generatedAt, font, bold } = params;
  const brand = rgb(0.08, 0.18, 0.38);
  const accent = rgb(0.89, 0.71, 0.21);

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_HEIGHT,
    color: brand,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: 5,
    color: accent,
  });
  page.drawCircle({
    x: PAGE_WIDTH - 45,
    y: PAGE_HEIGHT - 36,
    size: 34,
    color: rgb(0.14, 0.29, 0.56),
  });
  page.drawText(toPdfText(schoolName), {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 44,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(toPdfText(reportTitle), {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 64,
    size: 10.5,
    font,
    color: rgb(0.9, 0.95, 1),
  });
  page.drawText(toPdfText(`Verification ID: ${verificationId}`), {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 79,
    size: 9.5,
    font: bold,
    color: accent,
  });
  page.drawText(toPdfText(`Generated: ${generatedAt}`), {
    x: PAGE_WIDTH - 210,
    y: PAGE_HEIGHT - 79,
    size: 9,
    font,
    color: rgb(0.88, 0.92, 1),
  });

  const watermark = toPdfText("AUTHENTIC OVERDUE REPORT");
  page.drawText(watermark, {
    x: 120,
    y: PAGE_HEIGHT / 2,
    size: 38,
    font: bold,
    color: rgb(0.93, 0.94, 0.97),
    rotate: degrees(32),
  });
}

function drawFooter(params: {
  page: ReturnType<PDFDocument["addPage"]>;
  pageNumber: number;
  pageCount: number;
  verificationId: string;
  verificationUrl: string;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
}) {
  const { page, pageNumber, pageCount, verificationId, verificationUrl, font } = params;
  page.drawLine({
    start: { x: PAGE_MARGIN, y: BOTTOM_GUTTER + 8 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: BOTTOM_GUTTER + 8 },
    thickness: 0.8,
    color: rgb(0.82, 0.86, 0.92),
  });
  page.drawText(toPdfText(`ID: ${verificationId}`), {
    x: PAGE_MARGIN,
    y: BOTTOM_GUTTER - 2,
    size: 8,
    font,
    color: rgb(0.28, 0.33, 0.42),
  });
  page.drawText(toPdfText(`Verify: ${verificationUrl}`), {
    x: PAGE_MARGIN,
    y: BOTTOM_GUTTER - 12,
    size: 7.2,
    font,
    color: rgb(0.25, 0.34, 0.56),
  });
  page.drawText(`Page ${pageNumber} of ${pageCount}`, {
    x: PAGE_WIDTH - PAGE_MARGIN - 68,
    y: BOTTOM_GUTTER - 2,
    size: 8,
    font,
    color: rgb(0.35, 0.4, 0.48),
  });
}

async function createVerificationId() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const token = crypto.randomBytes(6).toString("hex").toUpperCase();
    const verificationId = `OR-${stamp}-${token}`;
    const existing = await ReportVerification.exists({ verificationId });
    if (!existing) return verificationId;
  }
  throw new Error("Failed to allocate verification ID");
}

function isReportTypeEnumValidationError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("reporttype") && message.includes("enum");
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    if (!schoolId || !userId) {
      return NextResponse.json(
        { error: "School ID or user ID not found" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"), 250);
    const snapshot = await buildOverdueRiskSnapshot({
      schoolId: schoolIdObj,
      limit,
      topLimit: 10,
    });

    if (snapshot.summary.overdueInvoiceCount === 0) {
      return NextResponse.json(
        { error: "No overdue invoices available for this report." },
        { status: 400 }
      );
    }

    const schoolRaw = await School.findById(schoolIdObj).select("name").lean();
    const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
    const schoolName =
      school?.name && String(school.name).trim().length > 0
        ? String(school.name).trim()
        : "Your School";

    const oldestDueDate = snapshot.rows.reduce<Date | null>((oldest, row) => {
      if (!row.oldestDueDate) return oldest;
      const candidate = new Date(row.oldestDueDate);
      if (Number.isNaN(candidate.getTime())) return oldest;
      if (!oldest || candidate < oldest) return candidate;
      return oldest;
    }, null);
    const rangeStart = oldestDueDate || new Date(snapshot.asOf);
    const rangeEnd = new Date(snapshot.asOf);

    const verificationId = await createVerificationId();
    const reportLabel = "Overdue Risk Report";
    const verificationPayload = {
      reportType: "overdue_report",
      status: "issued",
      schoolId: schoolIdObj,
      schoolName,
      issuedBy: userIdObj,
      reportLabel,
      range: {
        startDate: rangeStart,
        endDate: rangeEnd,
        source: "overdue_snapshot",
        periodLabel: null,
      },
      meta: {
        categories: ["finance", "overdue", "risk"],
        version: 1,
        rowCount: snapshot.totalRows,
        totalOutstandingMinor: snapshot.summary.totalOutstandingMinor,
        overdueInvoiceCount: snapshot.summary.overdueInvoiceCount,
      },
      issuedAt: new Date(),
    } as const;

    let verificationIdRef: mongoose.Types.ObjectId;
    try {
      const verification = await ReportVerification.create({
        verificationId,
        ...verificationPayload,
      });
      verificationIdRef = verification._id;
    } catch (error) {
      // In dev hot-reload, stale cached models may still have the older enum.
      // Fallback to a raw insert so report generation remains available.
      if (!isReportTypeEnumValidationError(error)) {
        throw error;
      }
      const now = new Date();
      const inserted = await ReportVerification.collection.insertOne({
        verificationId,
        ...verificationPayload,
        createdAt: now,
        updatedAt: now,
      });
      verificationIdRef = inserted.insertedId as mongoose.Types.ObjectId;
    }

    await recordActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "report.generated",
      entityType: "ReportVerification",
      entityId: verificationIdRef,
      description: "Generated overdue risk report",
      metadata: {
        reportType: "overdue_report",
        verificationId,
        rowCount: snapshot.totalRows,
        overdueInvoiceCount: snapshot.summary.overdueInvoiceCount,
        totalOutstandingMinor: snapshot.summary.totalOutstandingMinor,
      },
    });

    const appUrl = getAppUrl();
    const verificationPath = `/verify/report/${encodeURIComponent(verificationId)}`;
    const verificationUrl = `${appUrl}${verificationPath}`;
    const qrCodePng = await fetchQrCodePng(verificationUrl);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const generatedAt = new Intl.DateTimeFormat("en-GH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(snapshot.asOf));

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader({
      page,
      schoolName,
      reportTitle: reportLabel,
      verificationId,
      generatedAt,
      font,
      bold,
    });

    let y = PAGE_HEIGHT - HEADER_HEIGHT - 18;
    const metricCardWidth = 162;
    const metricCardHeight = 54;
    const metricGap = 14;
    const metricValues: Array<{ label: string; value: string; color: ReturnType<typeof rgb> }> = [
      {
        label: "Total Overdue",
        value: formatMoneyMinor(snapshot.summary.totalOutstandingMinor),
        color: rgb(0.64, 0.13, 0.18),
      },
      {
        label: "Overdue Bills",
        value: String(snapshot.summary.overdueInvoiceCount),
        color: rgb(0.14, 0.22, 0.35),
      },
      {
        label: "Students Affected",
        value: String(snapshot.summary.overdueStudentCount),
        color: rgb(0.14, 0.22, 0.35),
      },
    ];

    metricValues.forEach((metric, idx) => {
      const x = PAGE_MARGIN + idx * (metricCardWidth + metricGap);
      page.drawRectangle({
        x,
        y: y - metricCardHeight,
        width: metricCardWidth,
        height: metricCardHeight,
        color: rgb(0.97, 0.98, 1),
        borderColor: rgb(0.83, 0.87, 0.93),
        borderWidth: 1,
      });
      page.drawText(toPdfText(metric.label), {
        x: x + 10,
        y: y - 20,
        size: 9,
        font,
        color: rgb(0.35, 0.42, 0.52),
      });
      page.drawText(toPdfText(metric.value), {
        x: x + 10,
        y: y - 38,
        size: 11.5,
        font: bold,
        color: metric.color,
      });
    });

    if (qrCodePng) {
      const qrImage = await pdfDoc.embedPng(qrCodePng);
      const qrSize = 72;
      const qrX = PAGE_WIDTH - PAGE_MARGIN - qrSize;
      const qrY = y - metricCardHeight - 6;
      page.drawRectangle({
        x: qrX - 3,
        y: qrY - 3,
        width: qrSize + 6,
        height: qrSize + 6,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.83, 0.87, 0.93),
        borderWidth: 1,
      });
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
      page.drawText("Scan to verify", {
        x: qrX - 2,
        y: qrY - 14,
        size: 8,
        font,
        color: rgb(0.35, 0.42, 0.52),
      });
    }

    y -= metricCardHeight + 26;
    page.drawText(
      toPdfText(
        `Coverage: ${formatDateLabel(rangeStart)} to ${formatDateLabel(rangeEnd)} | Records: ${snapshot.totalRows}`
      ),
      {
        x: PAGE_MARGIN,
        y,
        size: 9,
        font,
        color: rgb(0.29, 0.35, 0.44),
      }
    );
    y -= 18;

    const columns: TableColumn[] = [
      { key: "student", label: "Student", width: 120 },
      { key: "class", label: "Class", width: 40 },
      { key: "guardian", label: "Guardian", width: 90 },
      { key: "contact", label: "Contact", width: 105 },
      { key: "days", label: "Days", width: 45, align: "center" },
      { key: "invoices", label: "Inv", width: 35, align: "center" },
      { key: "amount", label: "Outstanding", width: 80, align: "right" },
    ];

    const drawTableHeader = () => {
      page.drawRectangle({
        x: PAGE_MARGIN,
        y: y - 16,
        width: PAGE_WIDTH - PAGE_MARGIN * 2,
        height: 16,
        color: rgb(0.91, 0.94, 0.99),
      });
      let x = PAGE_MARGIN;
      columns.forEach((column) => {
        const text = toPdfText(column.label);
        let textX = x + 4;
        if (column.align === "right") {
          textX = x + column.width - bold.widthOfTextAtSize(text, 8) - 4;
        } else if (column.align === "center") {
          textX = x + (column.width - bold.widthOfTextAtSize(text, 8)) / 2;
        }
        page.drawText(text, {
          x: textX,
          y: y - 11.5,
          size: 8,
          font: bold,
          color: rgb(0.22, 0.29, 0.4),
        });
        x += column.width;
      });
      y -= 20;
    };

    drawTableHeader();

    const tableRows: TableRow[] = snapshot.rows.map((row) => ({
      studentName: row.studentName,
      classGroupName: row.classGroupName,
      guardianName: row.primaryGuardian?.name || "No guardian",
      guardianEmail: row.primaryGuardian?.email || null,
      guardianPhone: row.primaryGuardian?.phone || null,
      oldestDaysOverdue: row.oldestDaysOverdue,
      overdueInvoiceCount: row.overdueInvoiceCount,
      totalOutstandingMinor: row.totalOutstandingMinor,
    }));

    const rowHeight = 18;
    tableRows.forEach((row, idx) => {
      if (y - rowHeight <= PAGE_MARGIN + BOTTOM_GUTTER + 16) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeader({
          page,
          schoolName,
          reportTitle: reportLabel,
          verificationId,
          generatedAt,
          font,
          bold,
        });
        y = PAGE_HEIGHT - HEADER_HEIGHT - 24;
        drawTableHeader();
      }

      if (idx % 2 === 0) {
        page.drawRectangle({
          x: PAGE_MARGIN,
          y: y - rowHeight + 1,
          width: PAGE_WIDTH - PAGE_MARGIN * 2,
          height: rowHeight,
          color: rgb(0.985, 0.988, 0.995),
        });
      }

      const contact = [row.guardianEmail, row.guardianPhone].filter(Boolean).join(" | ");
      const values = [
        row.studentName,
        row.classGroupName || "-",
        row.guardianName,
        contact || "N/A",
        String(row.oldestDaysOverdue),
        String(row.overdueInvoiceCount),
        formatMoneyMinor(row.totalOutstandingMinor),
      ];

      let x = PAGE_MARGIN;
      values.forEach((value, colIdx) => {
        const column = columns[colIdx];
        const maxTextWidth = column.width - 8;
        const text = fitText(value, maxTextWidth, font, 8.2);
        let textX = x + 4;
        if (column.align === "right") {
          textX = x + column.width - font.widthOfTextAtSize(text, 8.2) - 4;
        } else if (column.align === "center") {
          textX = x + (column.width - font.widthOfTextAtSize(text, 8.2)) / 2;
        }
        page.drawText(text, {
          x: textX,
          y: y - 12,
          size: 8.2,
          font,
          color: rgb(0.18, 0.21, 0.28),
        });
        x += column.width;
      });

      y -= rowHeight;
    });

    const pages = pdfDoc.getPages();
    pages.forEach((pdfPage, index) => {
      drawFooter({
        page: pdfPage,
        pageNumber: index + 1,
        pageCount: pages.length,
        verificationId,
        verificationUrl,
        font,
      });
    });

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);
    const fileName = `overdue-risk-report-${new Date(snapshot.asOf)
      .toISOString()
      .slice(0, 10)}.pdf`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Report-Verification-Id": verificationId,
        "X-Report-Verification-Url": verificationUrl,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to generate overdue report PDF";
    console.error("Failed to generate overdue report PDF:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
