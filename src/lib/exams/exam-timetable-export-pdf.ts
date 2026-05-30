import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ExamExportMode, ExamExportPdfType, ExamTimetableExportRowDTO } from "@/types/academics/exam-scheduling-engine";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;

export async function buildExamTimetablePdfDocument(input: {
  sessionName: string;
  exportMode: ExamExportMode;
  exportType: ExamExportPdfType;
  rows: ExamTimetableExportRowDTO[];
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const title =
    input.exportType === "full"
      ? "Full Exam Timetable"
      : input.exportType === "class"
        ? "Class Exam Timetable"
        : input.exportType === "invigilation"
          ? "Teacher Invigilation Schedule"
          : "Venue Exam Schedule";

  page.drawText(title, { x: MARGIN, y, size: 16, font: bold, color: rgb(0.08, 0.12, 0.2) });
  y -= 22;
  page.drawText(input.sessionName, { x: MARGIN, y, size: 11, font, color: rgb(0.2, 0.25, 0.35) });
  y -= 16;
  page.drawText(`Export mode: ${input.exportMode}`, { x: MARGIN, y, size: 9, font, color: rgb(0.35, 0.4, 0.5) });
  y -= 24;

  const columns =
    input.exportType === "venue"
      ? ["Date", "Time", "Venue", "Class", "Subject", "Invigilator"]
      : input.exportType === "invigilation"
        ? ["Date", "Time", "Class", "Subject", "Venue", "Role"]
        : input.exportType === "class"
          ? ["Date", "Time", "Subject", "Venue", "Instructions"]
          : ["Date", "Time", "Class", "Subject", "Venue", "Invigilator"];

  const drawRow = (cells: string[], isHeader = false) => {
    if (y < MARGIN + 40) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    const rowFont = isHeader ? bold : font;
    const size = isHeader ? 9 : 8.5;
    const text = cells.join("  |  ");
    const clipped = text.length > 120 ? `${text.slice(0, 117)}...` : text;
    page.drawText(clipped, {
      x: MARGIN,
      y,
      size,
      font: rowFont,
      color: isHeader ? rgb(0.1, 0.45, 0.55) : rgb(0.15, 0.18, 0.24),
    });
    y -= isHeader ? 16 : 14;
  };

  drawRow(columns, true);

  for (const row of input.rows) {
    if (input.exportType === "class") {
      drawRow([row.date, `${row.startTime}-${row.endTime}`, row.subject, row.venue, row.instructions]);
      continue;
    }
    drawRow([
      row.date,
      `${row.startTime}-${row.endTime}`,
      row.classGroups,
      row.subject,
      row.venue,
      row.invigilators,
    ]);
  }

  if (input.rows.length === 0) {
    drawRow(["No rows available for this export."], false);
  }

  const bytes = await pdfDoc.save();
  const suffix = `${input.exportType}-${input.exportMode}`;
  return {
    fileName: `${input.sessionName.replace(/\s+/g, "-")}-${suffix}.pdf`,
    bytes: Buffer.from(bytes),
  };
}
