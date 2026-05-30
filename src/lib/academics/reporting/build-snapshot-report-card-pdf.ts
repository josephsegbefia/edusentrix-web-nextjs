import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReportCardViewData } from "@/types/academics/report-card-view";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 40;

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
}): PdfWriter {
  const page = params.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return {
    pdfDoc: params.pdfDoc,
    page,
    y: PAGE_HEIGHT - PAGE_MARGIN,
    font: params.font,
    bold: params.bold,
  };
}

function ensureSpace(writer: PdfWriter, neededHeight: number) {
  if (writer.y - neededHeight <= PAGE_MARGIN) {
    writer.page = writer.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    writer.y = PAGE_HEIGHT - PAGE_MARGIN;
  }
}

function drawLine(writer: PdfWriter, text: string, options?: { bold?: boolean; size?: number }) {
  ensureSpace(writer, (options?.size ?? 10) + 6);
  writer.page.drawText(text, {
    x: PAGE_MARGIN,
    y: writer.y,
    size: options?.size ?? 10,
    font: options?.bold ? writer.bold : writer.font,
    color: rgb(0.12, 0.12, 0.12),
  });
  writer.y -= (options?.size ?? 10) + 6;
}

export async function buildSnapshotReportCardPdf(data: ReportCardViewData) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const writer = createWriter({ pdfDoc, font, bold });

  drawLine(writer, data.school.name, { bold: true, size: 16 });
  drawLine(writer, data.template.name, { size: 10 });
  drawLine(writer, `${data.period.term} ${data.period.yearLabel}`, { size: 10 });
  writer.y -= 8;

  drawLine(writer, "Student Information", { bold: true, size: 12 });
  drawLine(writer, `Name: ${data.student.name}`);
  drawLine(writer, `Class: ${data.classGroup?.label ?? data.classGroup?.name ?? "N/A"}`);
  drawLine(writer, `Admission No: ${data.student.admissionNo ?? "N/A"}`);
  if (data.verificationId) {
    drawLine(writer, `Verification ID: ${data.verificationId}`);
  }
  writer.y -= 6;

  if (data.attendance?.ready) {
    drawLine(writer, "Attendance Summary", { bold: true, size: 12 });
    drawLine(
      writer,
      `Present: ${data.attendance.daysPresent ?? 0} / ${data.attendance.totalSchoolDays ?? 0} days (${(data.attendance.attendancePercentage ?? 0).toFixed(1)}%)`
    );
    drawLine(
      writer,
      `Absent: ${data.attendance.daysAbsent ?? 0} • Late: ${data.attendance.daysLate ?? 0} • Excused: ${data.attendance.daysExcused ?? 0}`
    );
    writer.y -= 6;
  }

  drawLine(writer, "Subject Results", { bold: true, size: 12 });
  const componentLabels = data.scoreComponents.map((component) => component.label).join(" | ");
  drawLine(writer, `Components: ${componentLabels}`, { size: 9 });

  if (data.subjects.length === 0) {
    drawLine(writer, "No subject results available on this released report card.");
  } else {
    data.subjects.forEach((subject, index) => {
      const componentSummary = subject.componentScores
        .map((component) => `${component.label}: ${component.weightedScore.toFixed(1)}`)
        .join(" • ");
      drawLine(
        writer,
        `${index + 1}. ${subject.subjectName} • Total: ${subject.roundedFinalScore.toFixed(1)} • Grade: ${subject.gradeLabel} • ${componentSummary}`,
        { size: 9 }
      );
      if (subject.subjectRemark) {
        drawLine(writer, `   Remark: ${subject.subjectRemark}`, { size: 9 });
      }
    });
  }

  writer.y -= 6;
  if (data.summary) {
    drawLine(writer, "Term Summary", { bold: true, size: 12 });
    drawLine(
      writer,
      `Average: ${data.summary.averageFinalScore.toFixed(1)} • Subjects: ${data.summary.subjectCount} • Passed: ${data.summary.passedSubjectCount}`
    );
  }

  if (data.comments?.homeroomComment || data.comments?.headteacherComment) {
    writer.y -= 6;
    drawLine(writer, "Comments", { bold: true, size: 12 });
    if (data.comments.homeroomComment) {
      drawLine(writer, `Class teacher: ${data.comments.homeroomComment}`, { size: 9 });
    }
    if (data.comments.headteacherComment) {
      drawLine(writer, `Headteacher: ${data.comments.headteacherComment}`, { size: 9 });
    }
  }

  drawLine(writer, "Official released snapshot — scores and attendance are frozen.", {
    size: 8,
  });

  return pdfDoc.save();
}
