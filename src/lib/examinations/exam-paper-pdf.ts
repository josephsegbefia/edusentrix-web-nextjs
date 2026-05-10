import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Types } from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamPaperSection } from "@/models/ExamPaperSection";
import { ExamType } from "@/models/ExamType";
import { ExamQuestion } from "@/models/ExamQuestion";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const MARGIN_TOP = 58;
const MARGIN_BOTTOM = 54;

type DrawContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function ensureSpace(ctx: DrawContext, requiredHeight: number) {
  if (ctx.y - requiredHeight >= MARGIN_BOTTOM) return;
  ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN_TOP;
}

function drawWrappedText(
  ctx: DrawContext,
  text: string,
  options: { size?: number; font?: PDFFont; indent?: number; gap?: number } = {}
) {
  const size = options.size ?? 10.5;
  const font = options.font ?? ctx.font;
  const indent = options.indent ?? 0;
  const gap = options.gap ?? 4;
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2 - indent;
  const lines = wrapText(text, font, size, maxWidth);
  ensureSpace(ctx, lines.length * (size + gap) + 4);
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN_X + indent,
      y: ctx.y,
      size,
      font,
      color: rgb(0.08, 0.09, 0.11),
    });
    ctx.y -= size + gap;
  }
}

function drawRule(ctx: DrawContext) {
  ensureSpace(ctx, 12);
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN_X, y: ctx.y },
    thickness: 0.6,
    color: rgb(0.72, 0.76, 0.82),
  });
  ctx.y -= 18;
}

export async function buildExamPaperQuestionPdf(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
}) {
  const paper = await ExamPaper.findOne({
    _id: input.examPaperId,
    schoolId: input.schoolId,
  }).lean();
  if (!paper) return null;

  const [examType, grade, subject, classGroups, sections, questions] =
    await Promise.all([
      ExamType.findOne({ _id: paper.examTypeId, schoolId: input.schoolId }).lean(),
      Grade.findOne({ _id: paper.gradeId, schoolId: input.schoolId }).lean(),
      Subject.findOne({ _id: paper.subjectId, schoolId: input.schoolId }).lean(),
      ClassGroup.find({ _id: { $in: paper.classGroupIds }, schoolId: input.schoolId })
        .sort({ name: 1 })
        .lean(),
      ExamPaperSection.find({ examPaperId: paper._id, schoolId: input.schoolId })
        .sort({ order: 1, createdAt: 1 })
        .lean(),
      ExamQuestion.find({ examPaperId: paper._id, schoolId: input.schoolId })
        .sort({ sectionId: 1, order: 1, createdAt: 1 })
        .lean(),
    ]);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ctx: DrawContext = {
    pdfDoc,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font,
    bold,
    y: PAGE_HEIGHT - MARGIN_TOP,
  };

  drawWrappedText(ctx, paper.title, { size: 17, font: bold, gap: 6 });
  drawWrappedText(ctx, examType?.name || "Exam Paper", { size: 11.5, font: bold });

  const classLabel =
    paper.scope === "grade_wide"
      ? `${grade?.name || "Grade"} (${classGroups.map((group) => group.name).join(", ")})`
      : `${grade?.name || "Grade"} ${classGroups[0]?.name || ""}`.trim();
  const meta = [
    `Subject: ${subject?.name || "Subject"}`,
    `Class: ${classLabel}`,
    paper.durationMinutes ? `Duration: ${paper.durationMinutes} minutes` : null,
    `Total Marks: ${paper.totalMarks ?? 0}`,
  ].filter(Boolean);
  drawWrappedText(ctx, meta.join("    |    "), { size: 9.5 });
  drawRule(ctx);

  if (paper.candidateInstructions || paper.instructions) {
    drawWrappedText(ctx, "Instructions", { size: 11.5, font: bold });
    drawWrappedText(ctx, paper.candidateInstructions || paper.instructions || "", {
      size: 10,
    });
    ctx.y -= 6;
  }

  const questionsBySection = new Map<string, typeof questions>();
  for (const question of questions) {
    const key = question.sectionId ? String(question.sectionId) : "unsectioned";
    const existing = questionsBySection.get(key) ?? [];
    existing.push(question);
    questionsBySection.set(key, existing);
  }

  let questionNumber = 1;
  const orderedSectionKeys = [
    ...sections.map((section) => String(section._id)),
    "unsectioned",
  ];

  for (const sectionKey of orderedSectionKeys) {
    const sectionQuestions = questionsBySection.get(sectionKey) ?? [];
    if (sectionQuestions.length === 0) continue;
    const section = sections.find((row) => String(row._id) === sectionKey);
    if (section) {
      ensureSpace(ctx, 38);
      drawWrappedText(ctx, `${section.title} (${section.marks} marks)`, {
        size: 12,
        font: bold,
      });
      if (section.instructions) {
        drawWrappedText(ctx, section.instructions, { size: 9.5 });
      }
      ctx.y -= 4;
    }

    for (const question of sectionQuestions) {
      const label = `${questionNumber}. (${question.marks} mark${question.marks === 1 ? "" : "s"})`;
      drawWrappedText(ctx, `${label} ${question.prompt}`, { size: 10.5 });

      for (const option of question.options || []) {
        drawWrappedText(ctx, `${option.label}. ${option.text}`, {
          size: 10,
          indent: 18,
        });
      }

      for (const subQuestion of question.subQuestions || []) {
        drawWrappedText(
          ctx,
          `${subQuestion.label}. ${subQuestion.prompt} (${subQuestion.marks} marks)`,
          { size: 10, indent: 18 }
        );
      }

      for (const attachment of question.attachments || []) {
        const caption = attachment.caption || attachment.fileName || attachment.url;
        drawWrappedText(ctx, `[${attachment.type}: ${caption}]`, {
          size: 9,
          indent: 18,
        });
      }

      ctx.y -= 8;
      questionNumber += 1;
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    page.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN_X - 72,
      y: 28,
      size: 8,
      font,
      color: rgb(0.35, 0.38, 0.43),
    });
  });

  return {
    bytes: await pdfDoc.save(),
    fileName: `${paper.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "exam-paper"}.pdf`,
  };
}
