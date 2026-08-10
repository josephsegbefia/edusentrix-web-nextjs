import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import type { ReportCardViewData, ReportCardViewSubjectRow } from "@/types/academics/report-card-view";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const slate = rgb(0.06, 0.1, 0.16);
const slate2 = rgb(0.09, 0.14, 0.22);
const teal = rgb(0.02, 0.55, 0.52);
const cyan = rgb(0.16, 0.78, 0.86);
const emerald = rgb(0.02, 0.58, 0.32);
const amber = rgb(0.78, 0.34, 0.05);
const muted = rgb(0.42, 0.47, 0.55);
const line = rgb(0.86, 0.9, 0.94);
const pageBg = rgb(0.97, 0.985, 0.995);

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

function safeText(value: unknown, fallback = "Not recorded") {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, 180);
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Not issued";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not issued";
  return date.toLocaleDateString("en-GH", {
    dateStyle: "medium",
    timeZone: "Africa/Accra",
  });
}

function fitText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const clean = safeText(text, "");
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;

  let candidate = clean;
  while (candidate.length > 3 && font.widthOfTextAtSize(`${candidate}...`, size) > maxWidth) {
    candidate = candidate.slice(0, -1);
  }
  return `${candidate}...`;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: {
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
) {
  page.drawText(
    options.maxWidth ? fitText(options.font, text, options.size, options.maxWidth) : safeText(text, ""),
    {
      x,
      y,
      size: options.size,
      font: options.font,
      color: options.color ?? slate,
    }
  );
}

function drawField(page: PDFPage, label: string, value: string, x: number, y: number, width: number, fonts: Fonts) {
  page.drawText(label.toUpperCase(), {
    x,
    y: y + 19,
    size: 7,
    font: fonts.bold,
    color: muted,
  });
  drawText(page, value, x, y, {
    size: 9.5,
    font: fonts.bold,
    color: slate,
    maxWidth: width,
  });
}

function drawMetric(page: PDFPage, label: string, value: string, x: number, y: number, width: number, fonts: Fonts) {
  page.drawRectangle({ x, y, width, height: 54, color: rgb(1, 1, 1), borderColor: line, borderWidth: 0.6 });
  page.drawText(label.toUpperCase(), { x: x + 14, y: y + 33, size: 7, font: fonts.bold, color: muted });
  drawText(page, value, x + 14, y + 14, { size: 13, font: fonts.bold, color: teal, maxWidth: width - 28 });
}

async function fetchLogo(url?: string | null) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (contentType.includes("png") || url.toLowerCase().includes(".png")) return { bytes, type: "png" as const };
    if (contentType.includes("jpeg") || contentType.includes("jpg") || /\.(jpe?g)(\?|$)/i.test(url)) {
      return { bytes, type: "jpg" as const };
    }
  } catch {
    return null;
  }
  return null;
}

async function embedSchoolLogo(pdf: PDFDocument, logoUrl?: string | null) {
  const logo = await fetchLogo(logoUrl);
  if (!logo) return null;

  try {
    return logo.type === "png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
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

function drawLogoFallback(page: PDFPage, fonts: Fonts, schoolName: string, x: number, y: number) {
  page.drawRectangle({ x, y, width: 58, height: 58, color: rgb(1, 1, 1), opacity: 0.96 });
  page.drawText(safeText(schoolName, "S").charAt(0).toUpperCase(), {
    x: x + 21,
    y: y + 20,
    size: 22,
    font: fonts.bold,
    color: teal,
  });
}

function drawLogo(page: PDFPage, image: PDFImage | null, fonts: Fonts, schoolName: string, x: number, y: number) {
  if (!image) {
    drawLogoFallback(page, fonts, schoolName, x, y);
    return;
  }

  page.drawRectangle({ x, y, width: 58, height: 58, color: rgb(1, 1, 1), opacity: 0.96 });
  const scale = Math.min(46 / image.width, 46 / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: x + (58 - width) / 2,
    y: y + (58 - height) / 2,
    width,
    height,
  });
}

function drawHeader(page: PDFPage, data: ReportCardViewData, fonts: Fonts, schoolLogo: PDFImage | null, appLogo: PDFImage | null) {
  const width = page.getWidth();
  const height = page.getHeight();
  page.drawRectangle({ x: 0, y: 0, width, height, color: pageBg });
  page.drawRectangle({ x: 0, y: height - 176, width, height: 176, color: slate });
  page.drawRectangle({ x: 0, y: height - 176, width, height: 8, color: cyan });
  page.drawCircle({ x: 506, y: 800, size: 108, color: rgb(0.04, 0.28, 0.31), opacity: 0.28 });
  page.drawCircle({ x: 52, y: 733, size: 84, color: rgb(0.03, 0.42, 0.39), opacity: 0.18 });

  drawLogo(page, schoolLogo, fonts, data.school.name, 46, 760);
  drawText(page, data.school.name, 116, 796, { size: 18, font: fonts.bold, color: rgb(1, 1, 1), maxWidth: 280 });
  drawText(page, data.school.address || [data.school.city, data.school.region].filter(Boolean).join(", "), 116, 778, {
    size: 8.5,
    font: fonts.regular,
    color: rgb(0.78, 0.9, 0.94),
    maxWidth: 280,
  });
  drawText(page, data.school.motto || "Official academic record", 116, 763, {
    size: 8.5,
    font: fonts.regular,
    color: rgb(0.67, 0.82, 0.88),
    maxWidth: 280,
  });

  if (appLogo) {
    page.drawImage(appLogo, { x: 399, y: 776, width: 32, height: 32 });
  } else {
    page.drawRectangle({ x: 406, y: 781, width: 24, height: 24, color: rgb(1, 1, 1), opacity: 0.96 });
    page.drawRectangle({ x: 412, y: 787, width: 4, height: 12, color: teal });
    page.drawRectangle({ x: 418, y: 795, width: 7, height: 4, color: cyan });
    page.drawRectangle({ x: 418, y: 787, width: 7, height: 4, color: cyan });
  }
  page.drawText("EduSentrix", { x: 438, y: 798, size: 18, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText("verified academic record", { x: 438, y: 780, size: 8.5, font: fonts.regular, color: rgb(0.74, 0.9, 0.92) });

  drawText(page, "Student Final Report Card", 46, 714, {
    size: 22,
    font: fonts.bold,
    color: rgb(1, 1, 1),
    maxWidth: 310,
  });
  page.drawText(`${safeText(data.period.term)} ${safeText(data.period.yearLabel)}`, {
    x: 46,
    y: 690,
    size: 11,
    font: fonts.regular,
    color: rgb(0.76, 0.91, 0.94),
  });

  page.drawRectangle({ x: 372, y: 666, width: 177, height: 66, color: rgb(1, 1, 1), opacity: 0.98 });
  page.drawRectangle({ x: 372, y: 728, width: 177, height: 4, color: cyan });
  page.drawText("TERM AVERAGE", { x: 390, y: 710, size: 8, font: fonts.bold, color: muted });
  page.drawText(`${formatScore(data.summary?.averageFinalScore)}%`, { x: 390, y: 687, size: 18, font: fonts.bold, color: emerald });
  page.drawText(`Status: ${safeText(data.status || "released").replace(/_/g, " ").toUpperCase()}`, {
    x: 390,
    y: 674,
    size: 8.5,
    font: fonts.bold,
    color: teal,
  });
}

function drawStudentInfo(page: PDFPage, data: ReportCardViewData, fonts: Fonts) {
  page.drawRectangle({ x: 46, y: 582, width: 503, height: 66, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 46, y: 644, width: 503, height: 4, color: teal });
  drawField(page, "Student", data.student.name, 70, 606, 145, fonts);
  drawField(page, "Admission no.", data.student.admissionNo || "N/A", 230, 606, 88, fonts);
  drawField(page, "Class", data.classGroup?.label || data.classGroup?.name || data.grade?.name || "N/A", 335, 606, 90, fonts);
  drawField(page, "Issued", formatDate(data.releasedAt), 444, 606, 80, fonts);
}

function subjectStatusColor(subject: ReportCardViewSubjectRow) {
  return subject.isPassed ? emerald : amber;
}

function drawSubjectTable(page: PDFPage, data: ReportCardViewData, fonts: Fonts) {
  const x = 46;
  const top = 552;
  const tableWidth = 503;
  const rowHeight = 24;
  const columns = [
    { label: "Subject", x: 62, width: 156 },
    { label: "Components", x: 224, width: 150 },
    { label: "Score", x: 386, width: 44 },
    { label: "Grade", x: 441, width: 38 },
    { label: "Remark", x: 492, width: 42 },
  ];

  page.drawRectangle({ x, y: top - 28, width: tableWidth, height: 28, color: slate2 });
  page.drawText("Subject results", { x: 62, y: top - 18, size: 12, font: fonts.bold, color: rgb(1, 1, 1) });
  columns.forEach((column) => {
    page.drawText(column.label.toUpperCase(), {
      x: column.x,
      y: top - 43,
      size: 6.8,
      font: fonts.bold,
      color: muted,
    });
  });

  let y = top - 68;
  const subjects = data.subjects.slice(0, 12);
  subjects.forEach((subject, index) => {
    const fill = index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.945, 0.965, 0.985);
    page.drawRectangle({ x, y: y - 7, width: tableWidth, height: rowHeight, color: fill });
    drawText(page, subject.subjectName, columns[0].x, y, {
      size: 8.6,
      font: fonts.bold,
      color: slate,
      maxWidth: columns[0].width,
    });
    drawText(
      page,
      subject.componentScores.map((component) => `${component.label} ${formatScore(component.weightedScore)}`).join(" | "),
      columns[1].x,
      y,
      { size: 7.4, font: fonts.regular, color: muted, maxWidth: columns[1].width }
    );
    page.drawText(formatScore(subject.roundedFinalScore), {
      x: columns[2].x,
      y,
      size: 8.6,
      font: fonts.bold,
      color: slate,
    });
    page.drawText(safeText(subject.gradeLabel, "-"), {
      x: columns[3].x,
      y,
      size: 8.6,
      font: fonts.bold,
      color: subjectStatusColor(subject),
    });
    drawText(page, subject.subjectRemark || subject.descriptor || (subject.isPassed ? "Passed" : "Review"), columns[4].x, y, {
      size: 7.4,
      font: fonts.regular,
      color: muted,
      maxWidth: columns[4].width,
    });
    y -= rowHeight;
  });

  if (data.subjects.length === 0) {
    page.drawRectangle({ x, y: y - 7, width: tableWidth, height: 34, color: rgb(1, 1, 1) });
    page.drawText("No subject results available on this released report card.", {
      x: 62,
      y,
      size: 9,
      font: fonts.regular,
      color: muted,
    });
    y -= 42;
  }

  if (data.subjects.length > subjects.length) {
    page.drawText(`${data.subjects.length - subjects.length} additional subject(s) continue on the next page.`, {
      x: 62,
      y: y - 3,
      size: 7.5,
      font: fonts.regular,
      color: muted,
    });
  }
}

function drawSummary(page: PDFPage, data: ReportCardViewData, fonts: Fonts) {
  const summary = data.summary;
  drawMetric(page, "Subjects", String(summary?.subjectCount ?? data.subjects.length), 46, 136, 112, fonts);
  drawMetric(page, "Passed", String(summary?.passedSubjectCount ?? 0), 174, 136, 112, fonts);
  drawMetric(page, "Average", `${formatScore(summary?.averageFinalScore)}%`, 302, 136, 112, fonts);
  drawMetric(
    page,
    "Attendance",
    data.attendance?.ready ? `${formatScore(data.attendance.attendancePercentage)}%` : "Pending",
    430,
    136,
    119,
    fonts
  );
}

function drawCommentsAndVerification(
  page: PDFPage,
  data: ReportCardViewData,
  fonts: Fonts,
  qr: PDFImage | null,
  verificationUrl: string
) {
  page.drawRectangle({ x: 46, y: 26, width: 503, height: 92, color: slate2 });
  page.drawText("Comments", { x: 70, y: 92, size: 11, font: fonts.bold, color: rgb(1, 1, 1) });
  drawText(
    page,
    data.comments?.homeroomComment || "Class teacher comment was not captured on this released report card.",
    70,
    74,
    { size: 8, font: fonts.regular, color: rgb(0.78, 0.86, 0.92), maxWidth: 250 }
  );
  drawText(page, data.comments?.headteacherComment || "Headteacher comment was not captured.", 70, 58, {
    size: 8,
    font: fonts.regular,
    color: rgb(0.78, 0.86, 0.92),
    maxWidth: 250,
  });

  page.drawText("Authenticity verification", { x: 340, y: 92, size: 10, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText(`ID: ${safeText(data.verificationId || "Not registered")}`, {
    x: 340,
    y: 75,
    size: 7.6,
    font: fonts.bold,
    color: cyan,
  });
  drawText(page, verificationUrl ? `Verify: ${verificationUrl}` : "Verify from the EduSentrix verification page.", 340, 60, {
    size: 6.5,
    font: fonts.regular,
    color: rgb(0.76, 0.84, 0.9),
    maxWidth: 118,
  });
  if (qr) {
    page.drawRectangle({ x: 472, y: 48, width: 54, height: 54, color: rgb(1, 1, 1) });
    page.drawImage(qr, { x: 476, y: 52, width: 46, height: 46 });
  } else {
    page.drawRectangle({ x: 472, y: 48, width: 54, height: 54, color: rgb(1, 1, 1), opacity: 0.94 });
    page.drawText("VERIFY", { x: 480, y: 73, size: 8, font: fonts.bold, color: teal });
  }
}

function drawGradeKeyPage(pdf: PDFDocument, data: ReportCardViewData, fonts: Fonts) {
  if (!data.gradingPolicy?.showGradeKey || data.gradingPolicy.gradeBoundaries.length === 0) return;

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: pageBg });
  page.drawRectangle({ x: 46, y: 710, width: 503, height: 64, color: slate });
  page.drawRectangle({ x: 46, y: 770, width: 503, height: 4, color: cyan });
  page.drawText("Grading key", { x: 70, y: 746, size: 18, font: fonts.bold, color: rgb(1, 1, 1) });
  drawText(page, data.gradingPolicy.name, 70, 726, {
    size: 9,
    font: fonts.regular,
    color: rgb(0.78, 0.9, 0.94),
    maxWidth: 360,
  });

  let y = 670;
  data.gradingPolicy.gradeBoundaries.forEach((boundary, index) => {
    page.drawRectangle({
      x: 46,
      y: y - 9,
      width: 503,
      height: 34,
      color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.945, 0.965, 0.985),
    });
    page.drawText(boundary.gradeLabel, { x: 70, y, size: 10, font: fonts.bold, color: teal });
    page.drawText(`${formatScore(boundary.minPercentage)} - ${formatScore(boundary.maxPercentage)}%`, {
      x: 150,
      y,
      size: 9,
      font: fonts.bold,
      color: slate,
    });
    drawText(page, boundary.descriptor || "No descriptor", 280, y, {
      size: 9,
      font: fonts.regular,
      color: muted,
      maxWidth: 210,
    });
    y -= 36;
  });

  page.drawText("Generated by EduSentrix School OS. Manual edits invalidate this report card.", {
    x: 46,
    y: 46,
    size: 8.5,
    font: fonts.regular,
    color: muted,
  });
  page.drawText("tryedusentrix.app", { x: 461, y: 46, size: 8.5, font: fonts.bold, color: teal });
}

function drawSubjectContinuationPages(pdf: PDFDocument, data: ReportCardViewData, fonts: Fonts) {
  const remainingSubjects = data.subjects.slice(12);
  if (remainingSubjects.length === 0) return;

  const rowsPerPage = 24;
  for (let start = 0; start < remainingSubjects.length; start += rowsPerPage) {
    const pageSubjects = remainingSubjects.slice(start, start + rowsPerPage);
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: pageBg });
    page.drawRectangle({ x: 46, y: 710, width: 503, height: 64, color: slate });
    page.drawRectangle({ x: 46, y: 770, width: 503, height: 4, color: cyan });
    page.drawText("Subject Results Continued", {
      x: 70,
      y: 746,
      size: 18,
      font: fonts.bold,
      color: rgb(1, 1, 1),
    });
    drawText(page, `${data.student.name} | ${data.period.term} ${data.period.yearLabel}`, 70, 726, {
      size: 9,
      font: fonts.regular,
      color: rgb(0.78, 0.9, 0.94),
      maxWidth: 360,
    });

    page.drawRectangle({ x: 46, y: 660, width: 503, height: 28, color: slate2 });
    page.drawText("SUBJECT", { x: 62, y: 670, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
    page.drawText("COMPONENTS", { x: 224, y: 670, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
    page.drawText("SCORE", { x: 386, y: 670, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
    page.drawText("GRADE", { x: 441, y: 670, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
    page.drawText("REMARK", { x: 492, y: 670, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });

    let y = 632;
    pageSubjects.forEach((subject, index) => {
      const fill = index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.945, 0.965, 0.985);
      page.drawRectangle({ x: 46, y: y - 7, width: 503, height: 24, color: fill });
      drawText(page, subject.subjectName, 62, y, {
        size: 8.6,
        font: fonts.bold,
        color: slate,
        maxWidth: 156,
      });
      drawText(
        page,
        subject.componentScores.map((component) => `${component.label} ${formatScore(component.weightedScore)}`).join(" | "),
        224,
        y,
        { size: 7.4, font: fonts.regular, color: muted, maxWidth: 150 }
      );
      page.drawText(formatScore(subject.roundedFinalScore), {
        x: 386,
        y,
        size: 8.6,
        font: fonts.bold,
        color: slate,
      });
      page.drawText(safeText(subject.gradeLabel, "-"), {
        x: 441,
        y,
        size: 8.6,
        font: fonts.bold,
        color: subjectStatusColor(subject),
      });
      drawText(page, subject.subjectRemark || subject.descriptor || (subject.isPassed ? "Passed" : "Review"), 492, y, {
        size: 7.4,
        font: fonts.regular,
        color: muted,
        maxWidth: 42,
      });
      y -= 24;
    });

    page.drawText("Generated by EduSentrix School OS. Manual edits invalidate this report card.", {
      x: 46,
      y: 46,
      size: 8.5,
      font: fonts.regular,
      color: muted,
    });
    page.drawText("tryedusentrix.app", { x: 461, y: 46, size: 8.5, font: fonts.bold, color: teal });
  }
}

export async function buildSnapshotReportCardPdf(data: ReportCardViewData) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const [schoolLogo, appLogo] = await Promise.all([embedSchoolLogo(pdf, data.school.logo), embedEdusentrixLogo(pdf)]);
  const verificationUrl = data.verificationId
    ? `${getAppUrl().replace(/\/$/, "")}/verify/report/${encodeURIComponent(data.verificationId)}`
    : "";
  const qr = await embedQr(pdf, verificationUrl);

  drawHeader(page, data, fonts, schoolLogo, appLogo);
  drawStudentInfo(page, data, fonts);
  drawSubjectTable(page, data, fonts);
  drawSummary(page, data, fonts);
  drawCommentsAndVerification(page, data, fonts, qr, verificationUrl);

  page.drawText("Generated by EduSentrix School OS. Manual edits invalidate this report card.", {
    x: 46,
    y: 8,
    size: 7,
    font: fonts.regular,
    color: muted,
  });
  page.drawText("tryedusentrix.app", { x: 463, y: 8, size: 7, font: fonts.bold, color: teal });

  drawSubjectContinuationPages(pdf, data, fonts);
  drawGradeKeyPage(pdf, data, fonts);

  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}
