import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import {
  buildParentAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { buildStudentAcademicsDTO } from "@/lib/academics/buildStudentAcademicsDTO";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 40;

function sanitizeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function splitWrappedLines(params: {
  text: string;
  maxWidth: number;
  font: { widthOfTextAtSize: (text: string, size: number) => number };
  fontSize: number;
}) {
  const { text, maxWidth, font, fontSize } = params;
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

type PdfWriter = {
  pdfDoc: PDFDocument;
  page: Awaited<ReturnType<PDFDocument["addPage"]>>;
  y: number;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
};

function createWriter(params: {
  pdfDoc: PDFDocument;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
}) {
  const page = params.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return {
    pdfDoc: params.pdfDoc,
    page,
    y: PAGE_HEIGHT - PAGE_MARGIN,
    font: params.font,
    bold: params.bold,
  };
}

function addPage(writer: PdfWriter) {
  writer.page = writer.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  writer.y = PAGE_HEIGHT - PAGE_MARGIN;
}

function ensureSpace(writer: PdfWriter, neededHeight: number) {
  if (writer.y - neededHeight <= PAGE_MARGIN) {
    addPage(writer);
  }
}

function drawWrappedText(params: {
  writer: PdfWriter;
  text: string;
  fontSize?: number;
  useBold?: boolean;
  color?: ReturnType<typeof rgb>;
  indent?: number;
  lineHeight?: number;
}) {
  const {
    writer,
    text,
    fontSize = 10,
    useBold = false,
    color = rgb(0.15, 0.15, 0.15),
    indent = 0,
    lineHeight = fontSize + 4,
  } = params;

  const font = useBold ? writer.bold : writer.font;
  const maxWidth = PAGE_WIDTH - PAGE_MARGIN * 2 - indent;
  const lines = splitWrappedLines({
    text,
    maxWidth,
    font,
    fontSize,
  });

  ensureSpace(writer, lines.length * lineHeight);
  for (const line of lines) {
    writer.page.drawText(line, {
      x: PAGE_MARGIN + indent,
      y: writer.y,
      size: fontSize,
      font,
      color,
    });
    writer.y -= lineHeight;
  }
}

function drawSectionTitle(writer: PdfWriter, title: string) {
  ensureSpace(writer, 24);
  writer.page.drawText(title, {
    x: PAGE_MARGIN,
    y: writer.y,
    size: 12,
    font: writer.bold,
    color: rgb(0.05, 0.2, 0.35),
  });
  writer.y -= 8;
  writer.page.drawLine({
    start: { x: PAGE_MARGIN, y: writer.y },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: writer.y },
    thickness: 1,
    color: rgb(0.82, 0.86, 0.9),
  });
  writer.y -= 12;
}

async function buildReportPdf(params: {
  studentName: string;
  classGroupName: string | null;
  admissionNo: string | null;
  reportType: string;
  selectedTermLabel: string | null;
  summary: {
    overallAverage: number | null;
    classPosition: number | null;
    totalStudents: number | null;
    performanceTier: string | null;
    trend: "up" | "down" | "stable";
    trendDelta: number | null;
  };
  riskLevel?: string;
  subjects: Array<{
    subjectName: string;
    totalScore: number | null;
    gradeLetter: string | null;
    isPassed: boolean | null;
    teacherName: string | null;
  }>;
  comments: Array<{
    subjectName: string | null;
    teacherName: string | null;
    comment: string;
    createdAt: string;
    isPublic: boolean;
  }>;
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const writer = createWriter({ pdfDoc, font, bold });

  const generatedAt = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  drawWrappedText({
    writer,
    text: "EduSentrix Academic Report",
    fontSize: 18,
    useBold: true,
    color: rgb(0.04, 0.27, 0.47),
  });
  drawWrappedText({
    writer,
    text: `${params.reportType.replace(/_/g, " ")} • ${params.selectedTermLabel || "Current Term"}`,
    fontSize: 10,
    color: rgb(0.35, 0.35, 0.35),
  });
  drawWrappedText({
    writer,
    text: `Generated: ${generatedAt}`,
    fontSize: 9,
    color: rgb(0.45, 0.45, 0.45),
  });
  writer.y -= 8;

  drawSectionTitle(writer, "Student Information");
  drawWrappedText({
    writer,
    text: `Name: ${params.studentName}`,
    fontSize: 10,
  });
  drawWrappedText({
    writer,
    text: `Class: ${params.classGroupName || "Not assigned"}`,
    fontSize: 10,
  });
  drawWrappedText({
    writer,
    text: `Admission No: ${params.admissionNo || "N/A"}`,
    fontSize: 10,
  });
  writer.y -= 6;

  drawSectionTitle(writer, "Performance Summary");
  drawWrappedText({
    writer,
    text: `Overall Average: ${params.summary.overallAverage != null ? `${params.summary.overallAverage.toFixed(1)}%` : "N/A"}`,
  });
  drawWrappedText({
    writer,
    text:
      params.summary.classPosition != null && params.summary.totalStudents != null
        ? `Class Position: ${params.summary.classPosition} of ${params.summary.totalStudents}`
        : "Class Position: N/A",
  });
  drawWrappedText({
    writer,
    text: `Performance Tier: ${params.summary.performanceTier || "N/A"}`,
  });
  drawWrappedText({
    writer,
    text: `Trend: ${params.summary.trend}${params.summary.trendDelta != null ? ` (${params.summary.trendDelta > 0 ? "+" : ""}${params.summary.trendDelta.toFixed(1)}%)` : ""}`,
  });
  if (params.riskLevel) {
    drawWrappedText({
      writer,
      text: `Risk Level: ${params.riskLevel}`,
    });
  }
  writer.y -= 6;

  drawSectionTitle(writer, "Subject Scores");
  if (params.subjects.length === 0) {
    drawWrappedText({
      writer,
      text: "No subject scores available for this report period.",
      fontSize: 10,
      color: rgb(0.4, 0.4, 0.4),
    });
  } else {
    params.subjects.forEach((subject, index) => {
      const score = subject.totalScore != null ? `${subject.totalScore.toFixed(1)}%` : "N/A";
      const grade = subject.gradeLetter || "N/A";
      const status =
        subject.isPassed == null ? "N/A" : subject.isPassed ? "Passed" : "Needs Support";
      const teacher = subject.teacherName || "Not assigned";
      drawWrappedText({
        writer,
        text: `${index + 1}. ${subject.subjectName} • Score: ${score} • Grade: ${grade} • ${status} • Teacher: ${teacher}`,
        fontSize: 9,
      });
    });
  }
  writer.y -= 6;

  const publicComments = params.comments.filter((comment) => comment.isPublic).slice(0, 12);
  drawSectionTitle(writer, "Teacher Comments");
  if (publicComments.length === 0) {
    drawWrappedText({
      writer,
      text: "No public teacher comments available for this period.",
      fontSize: 10,
      color: rgb(0.4, 0.4, 0.4),
    });
  } else {
    publicComments.forEach((comment, index) => {
      const date = new Date(comment.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const context = comment.subjectName ? `${comment.subjectName}` : "General";
      drawWrappedText({
        writer,
        text: `${index + 1}. ${context} (${date})`,
        fontSize: 9,
        useBold: true,
        color: rgb(0.2, 0.2, 0.2),
      });
      drawWrappedText({
        writer,
        text: `${comment.teacherName || "Teacher"}: ${comment.comment}`,
        fontSize: 9,
        indent: 10,
      });
      writer.y -= 2;
    });
  }

  return pdfDoc.save();
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const wardId = searchParams.get("wardId");
    const periodId = searchParams.get("periodId");
    const reportType = searchParams.get("type") || "term_report";

    if (!wardId || !mongoose.Types.ObjectId.isValid(wardId)) {
      return NextResponse.json(
        { success: false, error: "Valid wardId is required" },
        { status: 400 }
      );
    }

    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json(
        { success: false, error: "Invalid periodId" },
        { status: 400 }
      );
    }

    await verifyGuardianAccess(context.userId, wardId);

    const student = (await Student.findOne({
      _id: new mongoose.Types.ObjectId(wardId),
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName middleName classGroupId admissionNo")
      .lean()) as {
      _id: mongoose.Types.ObjectId;
      firstName?: string;
      lastName?: string;
      middleName?: string;
      classGroupId?: mongoose.Types.ObjectId;
      admissionNo?: string;
    } | null;

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    let classGroupName: string | null = null;
    if (student.classGroupId) {
      const classGroup = (await ClassGroup.findById(student.classGroupId)
        .select("name")
        .lean()) as { name?: string } | null;
      classGroupName = classGroup?.name || null;
    }

    const academics = await buildStudentAcademicsDTO({
      schoolId: context.schoolId,
      studentId: wardId,
      academicPeriodId: periodId || undefined,
    });

    const hasReportData =
      academics.summary.overallAverage != null ||
      academics.subjects.length > 0 ||
      academics.comments.length > 0;

    if (!hasReportData) {
      return NextResponse.json(
        { success: false, error: "Report is not available for the selected period" },
        { status: 404 }
      );
    }

    const studentName = `${student.firstName || ""} ${student.middleName || ""} ${student.lastName || ""}`
      .replace(/\s+/g, " ")
      .trim();

    const pdfBytes = await buildReportPdf({
      studentName,
      classGroupName,
      admissionNo: student.admissionNo || null,
      reportType,
      selectedTermLabel: academics.selectedTermLabel,
      summary: {
        overallAverage: academics.summary.overallAverage,
        classPosition: academics.summary.classPosition,
        totalStudents: academics.summary.totalStudents,
        performanceTier: academics.summary.performanceTier,
        trend: academics.summary.trend,
        trendDelta: academics.summary.trendDelta,
      },
      riskLevel: academics.riskLevel,
      subjects: academics.subjects,
      comments: academics.comments,
    });

    const fileStudent = sanitizeFilePart(studentName || "student-report");
    const fileTerm = sanitizeFilePart(academics.selectedTermLabel || "current-term");
    const fileType = sanitizeFilePart(reportType || "term-report");
    const fileName = `${fileStudent}-${fileTerm}-${fileType}.pdf`;

    try {
      await writeRetryableAuditEvent({
        actionCode: "report.downloaded.secure",
        scopeType: "school",
        scopeId: String(context.schoolId),
        result: "succeeded",
        target: {
          targetEntityType: "Student",
          targetEntityId: student._id,
        },
        context: buildParentAuditContext(req, {
          userId: context.userId,
          schoolId: context.schoolId,
          idempotencyKey: resolveAuditIdempotencyKey(
            req,
            `report.secure:${wardId}:${periodId || "current"}:${reportType}`
          ),
        }),
        payload: {
          metadata: {
            reportType,
            periodId: periodId || null,
            wardId,
            termLabel: academics.selectedTermLabel || null,
          },
        },
        streamKey: `school:${String(context.schoolId)}:academics`,
      });
    } catch (auditErr) {
      console.error("report.downloaded.secure audit failed:", auditErr);
    }

    const pdfArrayBuffer = new ArrayBuffer(pdfBytes.length);
    new Uint8Array(pdfArrayBuffer).set(pdfBytes);

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to download parent report:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to download report",
      },
      { status: 500 }
    );
  }
}
