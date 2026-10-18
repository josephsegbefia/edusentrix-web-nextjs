import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { IAssessmentDefinitionVersion } from "@/models/AssessmentDefinitionVersion";
import type { IAssessmentDeliveryVersion } from "@/models/AssessmentDeliveryVersion";
import type { IAssessmentPaperPacket, IAssessmentPaperPacketPage } from "@/models/AssessmentPaperPacket";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 52;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 96;
const FOOTER_HEIGHT = 52;

export type PaperPacketPdfSource = {
  schoolName: string;
  subjectName: string;
  gradeName: string;
  classGroupNames: string[];
  examTypeName: string;
  definition: IAssessmentDefinitionVersion;
  delivery: IAssessmentDeliveryVersion;
  packet: Pick<IAssessmentPaperPacket, "packetId" | "fallbackCode" | "pageManifest">;
};

type DrawContext = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
};

const COLORS = {
  ink: rgb(0.08, 0.1, 0.14),
  muted: rgb(0.32, 0.37, 0.44),
  line: rgb(0.76, 0.79, 0.84),
  accent: rgb(0.02, 0.45, 0.48),
};

function plainText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function newPage(ctx: DrawContext) {
  ctx.page = ctx.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN_TOP;
}

function ensureSpace(ctx: DrawContext, height: number) {
  if (ctx.y - height >= MARGIN_BOTTOM) return;
  newPage(ctx);
}

function drawText(
  ctx: DrawContext,
  value: string,
  options: { size?: number; font?: PDFFont; indent?: number; gap?: number; color?: ReturnType<typeof rgb> } = {}
) {
  const size = options.size ?? 10;
  const font = options.font ?? ctx.font;
  const indent = options.indent ?? 0;
  const gap = options.gap ?? 3.5;
  const lines = wrapText(value, font, size, PAGE_WIDTH - MARGIN_X * 2 - indent);
  ensureSpace(ctx, lines.length * (size + gap) + 4);
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN_X + indent,
      y: ctx.y,
      size,
      font,
      color: options.color ?? COLORS.ink,
    });
    ctx.y -= size + gap;
  }
}

function drawRule(ctx: DrawContext) {
  ensureSpace(ctx, 12);
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN_X, y: ctx.y },
    thickness: 0.7,
    color: COLORS.line,
  });
  ctx.y -= 16;
}

function drawWritingLines(ctx: DrawContext, count: number) {
  const lines = Math.max(2, Math.min(8, count));
  ensureSpace(ctx, lines * 16 + 5);
  for (let index = 0; index < lines; index += 1) {
    ctx.page.drawLine({
      start: { x: MARGIN_X + 18, y: ctx.y },
      end: { x: PAGE_WIDTH - MARGIN_X, y: ctx.y },
      thickness: 0.35,
      color: COLORS.line,
    });
    ctx.y -= 16;
  }
  ctx.y -= 5;
}

function drawHeader(ctx: DrawContext, source: PaperPacketPdfSource) {
  drawText(ctx, source.schoolName, { size: 15, font: ctx.bold, gap: 4 });
  drawText(ctx, source.delivery.title || source.definition.title, { size: 13, font: ctx.bold, gap: 4 });
  drawText(ctx, `${source.examTypeName}  ·  ${source.subjectName}  ·  ${source.gradeName}`, {
    size: 9.5,
    color: COLORS.muted,
  });
  if (source.classGroupNames.length > 0) {
    drawText(ctx, `Class: ${source.classGroupNames.join(", ")}`, { size: 9, color: COLORS.muted });
  }
  drawText(
    ctx,
    `Duration: ${source.delivery.timing.durationMinutes} minutes    |    Maximum marks: ${source.definition.scoring.maximumMarks}`,
    { size: 9, color: COLORS.muted }
  );
  drawRule(ctx);
  const instructions = plainText(source.definition.candidateInstructions || source.definition.instructions);
  if (instructions) {
    drawText(ctx, "Instructions", { size: 11, font: ctx.bold, gap: 3 });
    drawText(ctx, instructions, { size: 9.5, gap: 3 });
    ctx.y -= 5;
  }
}

function drawSection(ctx: DrawContext, title: string, instructions: string | null, marks: number) {
  ensureSpace(ctx, 42);
  drawText(ctx, `${title}  (${marks} marks)`, { size: 12, font: ctx.bold, gap: 3, color: COLORS.accent });
  if (instructions) drawText(ctx, plainText(instructions), { size: 9.5, color: COLORS.muted });
  ctx.y -= 4;
}

function drawQuestion(
  ctx: DrawContext,
  question: IAssessmentDefinitionVersion["sections"][number]["questions"][number],
  number: number
) {
  const prompt = plainText(question.plainTextPrompt || question.prompt);
  drawText(ctx, `${number}. (${question.marks} mark${question.marks === 1 ? "" : "s"}) ${prompt}`, {
    size: 10.2,
    font: ctx.bold,
    gap: 3.5,
  });

  for (const option of question.options ?? []) {
    drawText(ctx, `${option.label}. ${plainText(option.text)}`, { size: 9.7, indent: 18, gap: 3 });
  }
  for (const subQuestion of question.subQuestions ?? []) {
    drawText(
      ctx,
      `${subQuestion.label}. (${subQuestion.marks} marks) ${plainText(subQuestion.prompt)}`,
      { size: 9.7, indent: 18, gap: 3 }
    );
  }
  if ((question.options ?? []).length === 0) {
    drawWritingLines(ctx, Math.max(3, Math.ceil(question.marks / 2)));
  } else {
    ctx.y -= 7;
  }
}

async function embedQr(pdf: PDFDocument, payload: string) {
  const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 128 });
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return pdf.embedPng(Buffer.from(base64, "base64"));
}

async function drawFooter(
  ctx: DrawContext,
  source: PaperPacketPdfSource,
  pageNumber: number,
  pageCount: number
) {
  const marker = source.packet.pageManifest[pageNumber - 1];
  const pageLabel = `Page ${pageNumber} of ${pageCount}`;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: 78 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 78 },
    thickness: 0.6,
    color: COLORS.line,
  });
  ctx.page.drawText(`Packet ${source.packet.packetId}`, { x: MARGIN_X, y: 63, size: 7.5, font: ctx.bold, color: COLORS.muted });
  ctx.page.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN_X - 65, y: 63, size: 7.5, font: ctx.font, color: COLORS.muted });
  if (!marker) {
    ctx.page.drawText("Paper packet marker pending", { x: MARGIN_X, y: 48, size: 7, font: ctx.font, color: COLORS.muted });
    return;
  }
  const image = await embedQr(ctx.pdf, marker.qrPayload);
  ctx.page.drawImage(image, { x: MARGIN_X, y: 10, width: 42, height: 42 });
  ctx.page.drawText(`Page code: ${marker.fallbackCode}`, { x: MARGIN_X + 50, y: 40, size: 7.5, font: ctx.bold, color: COLORS.ink });
  ctx.page.drawText("QR is a routing marker; server records determine authenticity.", {
    x: MARGIN_X + 50,
    y: 27,
    size: 6.5,
    font: ctx.font,
    color: COLORS.muted,
  });
}

async function renderPdf(source: PaperPacketPdfSource, markerCount: number) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: DrawContext = { pdf, page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]), font, bold, y: PAGE_HEIGHT - MARGIN_TOP };
  drawHeader(ctx, source);

  let questionNumber = 1;
  const sections = [...source.definition.sections].sort((left, right) => left.order - right.order);
  for (const section of sections) {
    drawSection(ctx, plainText(section.title), section.instructions, section.marks);
    for (const question of [...section.questions].sort((left, right) => left.order - right.order)) {
      drawQuestion(ctx, question, questionNumber);
      questionNumber += 1;
    }
  }

  const pages = pdf.getPages();
  for (let index = 0; index < pages.length; index += 1) {
    ctx.page = pages[index];
    await drawFooter(ctx, source, index + 1, pages.length);
  }
  if (markerCount > 0 && pages.length !== markerCount) {
    throw new Error(`Paper packet page count changed during final rendering: expected ${markerCount}, got ${pages.length}`);
  }
  return { bytes: await pdf.save(), pageCount: pages.length };
}

export async function buildPaperPacketPdf(source: PaperPacketPdfSource) {
  const firstPass = await renderPdf({ ...source, packet: { ...source.packet, pageManifest: [] } }, 0);
  if (source.packet.pageManifest.length !== firstPass.pageCount) {
    throw new Error(`Paper packet page manifest does not match PDF pages: expected ${source.packet.pageManifest.length}, got ${firstPass.pageCount}`);
  }
  return renderPdf(source, firstPass.pageCount);
}

export async function calculatePaperPacketPageCount(source: Omit<PaperPacketPdfSource, "packet">) {
  const result = await renderPdf(
    { ...source, packet: { packetId: "PENDING", fallbackCode: "PENDING", pageManifest: [] } },
    0
  );
  return result.pageCount;
}

export async function buildPaperDeliveryPreviewPdf(source: Omit<PaperPacketPdfSource, "packet">) {
  const pageCount = await calculatePaperPacketPageCount(source);
  const pageManifest: IAssessmentPaperPacketPage[] = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const pageId = `PREVIEW-P${String(pageNumber).padStart(2, "0")}`;
    return {
      pageId,
      pageNumber,
      expectedPageCount: pageCount,
      fallbackCode: `PREVIEW-P${String(pageNumber).padStart(2, "0")}`,
      qrPayload: JSON.stringify({ v: 1, t: "paper-preview", id: pageId }),
    };
  });
  return buildPaperPacketPdf({
    ...source,
    packet: { packetId: "PREVIEW-NOT-ISSUED", fallbackCode: "PREVIEW-NOT-ISSUED", pageManifest },
  });
}
