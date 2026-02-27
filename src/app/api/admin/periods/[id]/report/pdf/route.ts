// src/app/api/admin/periods/[id]/report/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { PeriodReport } from "@/models/PeriodReport";
import { ReportVerification } from "@/models/ReportVerification";
import { School } from "@/models/School";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { recordActivity } from "@/lib/audit/recordActivity";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 40;
const HEADER_HEIGHT = 90;
const BOTTOM_GUTTER = 28;

function toPdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u20b5]/g, "GHS")
    .replace(/[\u00a0]/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function splitWrappedLines(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [normalized];
}

async function fetchQrCodePng(url: string): Promise<Uint8Array | null> {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(qrUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function createVerificationId(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const token = crypto.randomBytes(6).toString("hex").toUpperCase();
    const id = `TR-${stamp}-${token}`;
    const exists = await ReportVerification.exists({ verificationId: id });
    if (!exists) return id;
  }
  throw new Error("Failed to allocate verification ID");
}

function isReportTypeEnumError(e: unknown) {
  return e instanceof Error && /reporttype.*enum/i.test(e.message);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid period ID" }, { status: 400 });
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const periodIdObj = new mongoose.Types.ObjectId(id);
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

    const [period, report] = await Promise.all([
      AcademicPeriod.findOne({ _id: periodIdObj, schoolId: schoolIdObj }).lean(),
      PeriodReport.findOne({
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
        reportType: "term",
      }).lean(),
    ]);

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    if (!report) {
      return NextResponse.json(
        { error: "No report generated for this period. Generate the report first." },
        { status: 400 }
      );
    }

    const schoolRaw = await School.findById(schoolIdObj).select("name").lean();
    const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
    const schoolName =
      school?.name && String(school.name).trim()
        ? String(school.name).trim()
        : "Your School";

    const periodLabel = `${period.term} ${period.yearLabel}`;
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);

    const verificationId = await createVerificationId();
    const reportLabel = `Academic Term Report - ${periodLabel}`;
    const verificationPayload = {
      verificationId,
      reportType: "term_report",
      status: "issued",
      schoolId: schoolIdObj,
      schoolName,
      issuedBy: userIdObj,
      reportLabel,
      range: {
        startDate,
        endDate,
        source: "period_report",
        periodLabel,
      },
      meta: {
        categories: ["academic", "term", "report"],
        version: 1,
      },
      issuedAt: new Date(),
    };

    try {
      await ReportVerification.create(verificationPayload);
    } catch (e) {
      if (!isReportTypeEnumError(e)) throw e;
      const now = new Date();
      await ReportVerification.collection.insertOne({
        ...verificationPayload,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "report.generated",
      entityType: "ReportVerification",
      entityId: schoolIdObj,
      description: "Generated term report PDF",
      metadata: { reportType: "term_report", verificationId, periodId: id },
    });

    const appUrl = getAppUrl();
    const verifyUrl = `${appUrl}/verify/report/${encodeURIComponent(verificationId)}`;
    const qrPng = await fetchQrCodePng(verifyUrl);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const generatedAt = new Intl.DateTimeFormat("en-GH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - PAGE_MARGIN;

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
      height: 4,
      color: accent,
    });
    page.drawText(toPdfText("EduSentrix"), {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 38,
      size: 16,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(toPdfText(schoolName), {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 52,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(toPdfText(reportLabel), {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 66,
      size: 10,
      font,
      color: rgb(0.9, 0.95, 1),
    });
    page.drawText(toPdfText(`Verification: ${verificationId}`), {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 80,
      size: 9,
      font: bold,
      color: accent,
    });
    page.drawText(toPdfText(`Generated: ${generatedAt}`), {
      x: PAGE_WIDTH - 180,
      y: PAGE_HEIGHT - 80,
      size: 8,
      font,
      color: rgb(0.88, 0.92, 1),
    });

    if (qrPng) {
      const qrImg = await pdfDoc.embedPng(qrPng);
      const qrSize = 64;
      page.drawImage(qrImg, {
        x: PAGE_WIDTH - PAGE_MARGIN - qrSize,
        y: PAGE_HEIGHT - HEADER_HEIGHT - 4,
        width: qrSize,
        height: qrSize,
      });
      page.drawText("Scan to verify", {
        x: PAGE_WIDTH - PAGE_MARGIN - 42,
        y: PAGE_HEIGHT - HEADER_HEIGHT - 12,
        size: 7,
        font,
        color: rgb(0.7, 0.75, 0.85),
      });
    }

    y = PAGE_HEIGHT - HEADER_HEIGHT - 30;

    const content = report.content as {
      summary?: string;
      sections?: Array<{ title: string; content: string; highlights?: string[] }>;
      suggestions?: Array<{ text: string }>;
    };

    const maxWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
    const lineHeight = 14;
    const minY = PAGE_MARGIN + BOTTOM_GUTTER;

    function checkNewPage() {
      if (y < minY) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - PAGE_MARGIN;
      }
    }

    if (content.summary) {
      const lines = splitWrappedLines(content.summary, maxWidth, font, 10);
      for (const line of lines) {
        checkNewPage();
        page.drawText(toPdfText(line), {
          x: PAGE_MARGIN,
          y,
          size: 10,
          font,
          color: rgb(0.15, 0.15, 0.2),
        });
        y -= lineHeight;
      }
      y -= 12;
    }

    for (const section of content.sections ?? []) {
      checkNewPage();
      page.drawText(toPdfText(section.title), {
        x: PAGE_MARGIN,
        y,
        size: 12,
        font: bold,
        color: rgb(0.05, 0.25, 0.45),
      });
      y -= 16;

      const sectLines = splitWrappedLines(section.content, maxWidth, font, 10);
      for (const line of sectLines) {
        checkNewPage();
        page.drawText(toPdfText(line), {
          x: PAGE_MARGIN,
          y,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.25),
        });
        y -= lineHeight;
      }

      for (const h of section.highlights ?? []) {
        checkNewPage();
        const hlLines = splitWrappedLines(`• ${h}`, maxWidth - 8, font, 9);
        for (const line of hlLines) {
          checkNewPage();
          page.drawText(toPdfText(line), {
            x: PAGE_MARGIN + 8,
            y,
            size: 9,
            font,
            color: rgb(0.3, 0.35, 0.4),
          });
          y -= lineHeight - 2;
        }
      }
      y -= 10;
    }

    if ((content.suggestions ?? []).length > 0) {
      checkNewPage();
      page.drawText(toPdfText("Suggestions for Improvement"), {
        x: PAGE_MARGIN,
        y,
        size: 11,
        font: bold,
        color: rgb(0.6, 0.45, 0.1),
      });
      y -= 14;

      for (const s of content.suggestions ?? []) {
        const lines = splitWrappedLines(`• ${s.text}`, maxWidth - 8, font, 9);
        for (const line of lines) {
          checkNewPage();
          page.drawText(toPdfText(line), {
            x: PAGE_MARGIN + 8,
            y,
            size: 9,
            font,
            color: rgb(0.25, 0.3, 0.35),
          });
          y -= lineHeight - 2;
        }
      }
    }

    const pages = pdfDoc.getPages();
    pages.forEach((p, idx) => {
      p.drawText(toPdfText(`EduSentrix • ${schoolName} • Page ${idx + 1} of ${pages.length}`), {
        x: PAGE_MARGIN,
        y: BOTTOM_GUTTER - 2,
        size: 8,
        font,
        color: rgb(0.4, 0.45, 0.5),
      });
      p.drawText(toPdfText(`ID: ${verificationId}`), {
        x: PAGE_WIDTH - PAGE_MARGIN - 120,
        y: BOTTOM_GUTTER - 2,
        size: 8,
        font,
        color: rgb(0.4, 0.45, 0.5),
      });
    });

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);
    const fileName = `term-report-${periodLabel.replace(/\s+/g, "-")}-${verificationId.slice(-8)}.pdf`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error generating term report PDF:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
