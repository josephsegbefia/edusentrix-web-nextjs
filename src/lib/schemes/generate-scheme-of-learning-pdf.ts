import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { addDaysUtc, dateOnlyUtc } from "@/lib/lessons/week-dates";
import {
  resolveSchemeWeekCalendarRange,
  type AcademicPeriodWeekInput,
} from "@/lib/schemes/resolve-scheme-week";
import {
  JHS1_INTEGRATED_SCIENCE_TERM3_TEMPLATE,
  type SchemeTemplateRow,
} from "@/lib/schemes/templates/jhs1-integrated-science-term3";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const FOOTER_HEIGHT = 28;

type AlignedSchemeRow = SchemeTemplateRow & {
  weekEndingLabel: string;
};

type PdfContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
};

function formatGhanaPdfDate(date: Date) {
  const d = dateOnlyUtc(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function fridayWeekEnding(weekStart: Date, periodEnd: Date) {
  const friday = addDaysUtc(weekStart, 4);
  const end = dateOnlyUtc(periodEnd);
  return friday.getTime() > end.getTime() ? end : friday;
}

export function alignSchemeRowsToAcademicPeriod(
  rows: SchemeTemplateRow[],
  period: AcademicPeriodWeekInput
): AlignedSchemeRow[] {
  const periodEnd = dateOnlyUtc(period.endDate);
  return rows.map((row) => {
    const { weekStart } = resolveSchemeWeekCalendarRange(period, row.weekNumber);
    const ending = fridayWeekEnding(weekStart, periodEnd);
    return {
      ...row,
      weekEndingLabel: formatGhanaPdfDate(ending),
    };
  });
}

function wrapText(text: string, maxChars: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function ensureSpace(ctx: PdfContext, needed: number) {
  if (ctx.y - needed >= MARGIN + FOOTER_HEIGHT) return;
  ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
}

export async function generateJhs1IntegratedScienceTerm3SchemePdf(input: {
  schoolName: string;
  academicPeriodLabel: string;
  period: AcademicPeriodWeekInput;
}) {
  const alignedRows = alignSchemeRowsToAcademicPeriod(
    JHS1_INTEGRATED_SCIENCE_TERM3_TEMPLATE.rows,
    input.period
  );

  const periodStartLabel = formatGhanaPdfDate(input.period.startDate);
  const periodEndLabel = formatGhanaPdfDate(input.period.endDate);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ctx: PdfContext = {
    pdfDoc,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font,
    bold,
    y: PAGE_HEIGHT - MARGIN,
  };

  ctx.page.drawText("EaD Comprehensive Lesson Plans", {
    x: MARGIN,
    y: ctx.y,
    size: 14,
    font: bold,
    color: rgb(0.08, 0.12, 0.2),
  });
  ctx.y -= 20;

  ctx.page.drawText(JHS1_INTEGRATED_SCIENCE_TERM3_TEMPLATE.title, {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });
  ctx.y -= 18;

  ctx.page.drawText(
    `SUBJECT: ${JHS1_INTEGRATED_SCIENCE_TERM3_TEMPLATE.subject}   LEVEL: ${JHS1_INTEGRATED_SCIENCE_TERM3_TEMPLATE.level}`,
    { x: MARGIN, y: ctx.y, size: 9, font: bold, color: rgb(0.15, 0.2, 0.3) }
  );
  ctx.y -= 14;

  ctx.page.drawText(
    `SCHOOL: ${input.schoolName}   ACADEMIC PERIOD: ${input.academicPeriodLabel}`,
    { x: MARGIN, y: ctx.y, size: 9, font, color: rgb(0.2, 0.25, 0.35) }
  );
  ctx.y -= 14;

  ctx.page.drawText(`TERM DATES: ${periodStartLabel} TO ${periodEndLabel}`, {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font,
    color: rgb(0.2, 0.25, 0.35),
  });
  ctx.y -= 22;

  const columns = [
    { key: "week", label: "Week", width: 28, maxChars: 4 },
    { key: "ending", label: "Week ending", width: 62, maxChars: 10 },
    { key: "strand", label: "Strand", width: 82, maxChars: 18 },
    { key: "subStrand", label: "Sub-strand", width: 88, maxChars: 20 },
    { key: "contentStandard", label: "Content standard", width: 54, maxChars: 12 },
    { key: "indicators", label: "Indicators / Learning outcomes", width: 88, maxChars: 22 },
    { key: "teachingActivities", label: "Teaching & Learning Activities", width: 96, maxChars: 24 },
    { key: "resources", label: "Resources", width: 96, maxChars: 24 },
    { key: "assessment", label: "Assessment", width: 72, maxChars: 18 },
  ] as const;

  let x = MARGIN;
  for (const column of columns) {
    ctx.page.drawText(column.label, {
      x,
      y: ctx.y,
      size: 7.5,
      font: bold,
      color: rgb(0.1, 0.45, 0.55),
    });
    x += column.width;
  }
  ctx.y -= 12;

  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y + 4 },
    thickness: 0.75,
    color: rgb(0.75, 0.78, 0.82),
  });
  ctx.y -= 8;

  const lineHeight = 10;

  for (const row of alignedRows) {
    const cellLines = columns.map((column) => {
      const value =
        column.key === "week"
          ? String(row.weekNumber)
          : column.key === "ending"
            ? row.weekEndingLabel
            : column.key === "strand"
              ? row.strand
              : column.key === "subStrand"
                ? row.subStrand
                : column.key === "contentStandard"
                  ? row.contentStandard
                  : column.key === "indicators"
                    ? row.indicators.replace(/\n/g, " ")
                    : column.key === "teachingActivities"
                      ? row.teachingActivities
                      : column.key === "assessment"
                        ? row.assessment
                        : row.resources;
      return wrapText(value, column.maxChars);
    });

    const rowLineCount = Math.max(...cellLines.map((lines) => lines.length), 1);
    const rowHeight = rowLineCount * lineHeight + 8;
    ensureSpace(ctx, rowHeight);

    let colX = MARGIN;
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const lines = cellLines[columnIndex];
      let lineY = ctx.y;
      for (const line of lines) {
        ctx.page.drawText(line, {
          x: colX,
          y: lineY,
          size: 7,
          font,
          color: rgb(0.12, 0.16, 0.22),
        });
        lineY -= lineHeight;
      }
      colX += columns[columnIndex].width;
    }

    ctx.y -= rowHeight;
  }

  ctx.y -= 10;
  ensureSpace(ctx, 36);
  const note =
    "Note: Week endings are aligned to the school's current academic period (Monday-start teaching weeks, Friday week-ending labels). Schools may adjust strands, indicators, dates and resources to match their approved NaCCA/GES scheme.";
  for (const line of wrapText(note, 130)) {
    ctx.page.drawText(line, {
      x: MARGIN,
      y: ctx.y,
      size: 7,
      font,
      color: rgb(0.35, 0.4, 0.48),
    });
    ctx.y -= 10;
  }

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  pages.forEach((page, index) => {
    page.drawText(`Generated by EduSentrix`, {
      x: MARGIN,
      y: 18,
      size: 8,
      font,
      color: rgb(0.4, 0.45, 0.5),
    });
    page.drawText(`Page ${index + 1} of ${totalPages}`, {
      x: PAGE_WIDTH - MARGIN - 70,
      y: 18,
      size: 8,
      font,
      color: rgb(0.4, 0.45, 0.5),
    });
  });

  const bytes = await pdfDoc.save();
  const fileName = `JHS1_Integrated_Science_${input.academicPeriodLabel.replace(/[^\w]+/g, "_")}_Scheme.pdf`;

  return {
    fileName,
    bytes: Buffer.from(bytes),
    alignedRows,
    periodStartLabel,
    periodEndLabel,
  };
}

function csvEscape(value: string) {
  const text = value.replace(/\r?\n/g, " ").trim();
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function generateSchemeImportCsvFromAlignedRows(rows: AlignedSchemeRow[]) {
  const headers = [
    "Week",
    "Week ending",
    "Strand",
    "Sub-strand",
    "Content standard",
    "Indicators / Learning outcomes",
    "Teaching & Learning Activities",
    "Resources",
    "Assessment",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        String(row.weekNumber),
        row.weekEndingLabel,
        row.strand,
        row.subStrand,
        row.contentStandard,
        row.indicators.replace(/\n/g, "; "),
        row.teachingActivities,
        row.resources,
        row.assessment,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return lines.join("\n");
}
