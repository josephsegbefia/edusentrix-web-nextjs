import mongoose from "mongoose";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Assessment } from "@/models/Assessment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { GradingScale } from "@/models/GradingScale";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const CA_TYPES = new Set(["ca", "quiz", "assignment", "midterm", "project"]);
const EXAM_TYPES = new Set(["exam", "mock"]);

type AssessmentColumn = {
  id: string;
  label: string;
  maxScore: number;
  type: string;
  category: string;
};

type RowData = {
  admissionNo: string;
  name: string;
  scores: Array<number | null>;
  totals: {
    caTotal: number;
    examTotal: number;
    finalScore: number;
    grade: string;
  };
};

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function buildAssessmentKey(input: {
  assessmentType: string;
  title: string;
  maxScore: number;
  weight: number;
}) {
  return `${input.assessmentType}::${input.title}::${input.maxScore}::${input.weight}`;
}

function getGradeMapping(
  mappings: Array<{ minPercentage: number; maxPercentage: number; letter: string; point: number }>,
  percentage: number
) {
  return mappings.find(
    (mapping) => percentage >= mapping.minPercentage && percentage <= mapping.maxPercentage
  );
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(headers: string[], rows: Array<Array<string | number | null>>) {
  const lines = [
    headers.map((cell) => escapeCsv(String(cell))).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsv(String(cell ?? ""))).join(",")),
  ];
  return lines.join("\n");
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0.0";
  return Number(value).toFixed(1);
}

function truncateText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  size: number
) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 0 && font.widthOfTextAtSize(`${trimmed}...`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.length ? `${trimmed}...` : "";
}

function drawCellText(options: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  width: number;
  align?: "left" | "center" | "right";
  font: PDFFont;
  size: number;
}) {
  const { page, text, x, y, width, align = "left", font, size } = options;
  const textWidth = font.widthOfTextAtSize(text, size);
  let textX = x + 2;
  if (align === "center") {
    textX = x + (width - textWidth) / 2;
  } else if (align === "right") {
    textX = x + width - textWidth - 2;
  }
  page.drawText(text, { x: textX, y, size, font });
}

async function buildPdf(options: {
  classLabel: string;
  subjectLabel: string;
  periodLabel?: string | null;
  columns: AssessmentColumn[];
  rows: RowData[];
}) {
  const { classLabel, subjectLabel, periodLabel, columns, rows } = options;
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 36;
  const titleSize = 16;
  const subtitleSize = 11;
  const metaSize = 9;
  const headerSize = 8;
  const rowSize = 8;
  const rowHeight = 18;
  const headerHeight = 26;

  const admissionWidth = 80;
  const studentWidth = 160;
  const totalWidths = [55, 55, 55, 45];
  const totalsWidth = totalWidths.reduce((sum, w) => sum + w, 0);
  const assessmentWidth = 60;

  const availableWidth = pageWidth - margin * 2 - admissionWidth - studentWidth - totalsWidth;
  const perPage = columns.length > 0
    ? Math.max(1, Math.floor(availableWidth / assessmentWidth))
    : 1;

  const groups = columns.length > 0
    ? Array.from({ length: Math.ceil(columns.length / perPage) }, (_, idx) => {
        const start = idx * perPage;
        const groupCols = columns.slice(start, start + perPage);
        return {
          start,
          end: start + groupCols.length - 1,
          columns: groupCols,
        };
      })
    : [{ start: 0, end: -1, columns: [] as AssessmentColumn[] }];

  const dateLabel = new Date().toISOString().split("T")[0];

  const createPageHeader = (group: { start: number; end: number; columns: AssessmentColumn[] }) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    page.drawText("Gradebook Export", { x: margin, y, size: titleSize, font: bold });
    y -= titleSize + 4;

    const subtitle = `${classLabel} · ${subjectLabel}`;
    page.drawText(truncateText(subtitle, pageWidth - margin * 2, bold, subtitleSize), {
      x: margin,
      y,
      size: subtitleSize,
      font: bold,
    });
    y -= subtitleSize + 6;

    const metaParts = [`Generated ${dateLabel}`];
    if (periodLabel) metaParts.push(periodLabel);
    if (columns.length > 0) {
      metaParts.push(`Assessments ${group.start + 1}-${group.end + 1} of ${columns.length}`);
    }
    page.drawText(metaParts.join(" · "), { x: margin, y, size: metaSize, font });
    y -= metaSize + 10;

    const columnDefs = [
      { key: "admission", label: "Admission No", width: admissionWidth, align: "left" as const },
      { key: "student", label: "Student", width: studentWidth, align: "left" as const },
      ...group.columns.map((column) => ({
        key: column.id,
        label: column.label,
        meta: `Max ${column.maxScore}`,
        width: assessmentWidth,
        align: "center" as const,
      })),
      { key: "caTotal", label: "CA Total", width: totalWidths[0], align: "right" as const },
      { key: "examTotal", label: "Exam Total", width: totalWidths[1], align: "right" as const },
      { key: "finalScore", label: "Final", width: totalWidths[2], align: "right" as const },
      { key: "grade", label: "Grade", width: totalWidths[3], align: "center" as const },
    ];

    const tableWidth = columnDefs.reduce((sum, col) => sum + col.width, 0);
    const headerTop = y;

    page.drawLine({
      start: { x: margin, y: headerTop },
      end: { x: margin + tableWidth, y: headerTop },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    });

    let x = margin;
    columnDefs.forEach((col) => {
      const label = truncateText(col.label, col.width - 4, bold, headerSize);
      drawCellText({
        page,
        text: label,
        x,
        y: headerTop - 12,
        width: col.width,
        align: col.align,
        font: bold,
        size: headerSize,
      });
      if ((col as { meta?: string }).meta) {
        drawCellText({
          page,
          text: truncateText((col as { meta: string }).meta, col.width - 4, font, headerSize - 1),
          x,
          y: headerTop - 22,
          width: col.width,
          align: col.align,
          font,
          size: headerSize - 1,
        });
      }
      x += col.width;
    });

    const headerBottom = headerTop - headerHeight;
    page.drawLine({
      start: { x: margin, y: headerBottom },
      end: { x: margin + tableWidth, y: headerBottom },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    });

    return { page, y: headerBottom, columnDefs, tableWidth };
  };

  if (rows.length === 0) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawText("Gradebook Export", { x: margin, y: pageHeight - margin, size: titleSize, font: bold });
    page.drawText("No students found for this class group.", {
      x: margin,
      y: pageHeight - margin - 40,
      size: subtitleSize,
      font,
    });
    return pdfDoc.save();
  }

  groups.forEach((group) => {
    let { page, y, columnDefs, tableWidth } = createPageHeader(group);

    rows.forEach((row) => {
      if (y - rowHeight < margin) {
        ({ page, y, columnDefs, tableWidth } = createPageHeader(group));
      }

      const textY = y - 12;
      let x = margin;

      const scoreSlice = row.scores.slice(group.start, group.start + group.columns.length);
      const values: Array<string> = [
        row.admissionNo,
        row.name,
        ...scoreSlice.map((score) => (score === null ? "" : formatNumber(score))),
        formatNumber(row.totals.caTotal),
        formatNumber(row.totals.examTotal),
        formatNumber(row.totals.finalScore),
        row.totals.grade,
      ];

      columnDefs.forEach((col, idx) => {
        const rawValue = values[idx] ?? "";
        const text = truncateText(rawValue, col.width - 4, font, rowSize);
        drawCellText({
          page,
          text,
          x,
          y: textY,
          width: col.width,
          align: col.align,
          font,
          size: rowSize,
        });
        x += col.width;
      });

      const rowBottom = y - rowHeight;
      page.drawLine({
        start: { x: margin, y: rowBottom },
        end: { x: margin + tableWidth, y: rowBottom },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });

      y = rowBottom;
    });
  });

  return pdfDoc.save();
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ classGroupId: string; subjectId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookExport)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    if (!['csv', 'pdf'].includes(format)) {
      return Response.json(
        { success: false, error: "Unsupported export format" },
        { status: 400 }
      );
    }

    const { classGroupId, subjectId } = await ctx.params;
    const classGroupObjId = toObjectIdOrNull(classGroupId);
    const subjectObjId = toObjectIdOrNull(subjectId);

    if (!classGroupObjId || !subjectObjId) {
      return Response.json(
        { success: false, error: "Invalid class group or subject" },
        { status: 400 }
      );
    }

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id name termNumber")
      .lean();

    if (!period) {
      return Response.json(
        { success: false, error: "No active academic period" },
        { status: 400 }
      );
    }

    const [classGroup, subject] = await Promise.all([
      ClassGroup.findOne({ _id: classGroupObjId, schoolId: context.schoolId })
        .select("_id name gradeId")
        .lean(),
      Subject.findOne({ _id: subjectObjId, schoolId: context.schoolId })
        .select("_id name")
        .lean(),
    ]);

    if (!classGroup || !subject) {
      return Response.json(
        { success: false, error: "Class group or subject not found" },
        { status: 404 }
      );
    }

    if (!context.isAdmin) {
      const assignment = await TeacherAssignment.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        subjectId: subjectObjId,
        academicPeriodId: period._id,
        status: "active",
      })
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const grade = classGroup.gradeId
      ? await Grade.findById(classGroup.gradeId).select("name").lean()
      : null;

    const classLabel = grade
      ? `${grade.name} ${classGroup.name}`.trim()
      : classGroup.name;

    const students = await Student.find({
      schoolId: context.schoolId,
      classGroupId: classGroupObjId,
      status: "active",
    })
      .select("_id firstName lastName middleName admissionNo")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const studentIds = students.map((student) => student._id);

    const assessmentQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      academicPeriodId: period._id,
      subjectId: subjectObjId,
      studentId: { $in: studentIds },
    };

    if (!context.isAdmin) {
      assessmentQuery.teacherId = context.teacherId;
    }

    const assessments = await Assessment.find(assessmentQuery)
      .select("studentId assessmentType title maxScore score weight gradedAt")
      .lean();

    const gradingScale = await GradingScale.findOne({
      schoolId: context.schoolId,
      isDefault: true,
    })
      .select("caWeight examWeight gradeMappings")
      .lean();

    const caWeight = gradingScale?.caWeight ?? 0.3;
    const examWeight = gradingScale?.examWeight ?? 0.7;
    const mappings = gradingScale?.gradeMappings || [];

    const definitionMap = new Map<
      string,
      { id: string; title: string; maxScore: number; type: string; weight: number }
    >();

    const byStudent = new Map<string, Map<string, typeof assessments[number]>>();

    for (const assessment of assessments) {
      const weight = assessment.weight ?? 1;
      const key = buildAssessmentKey({
        assessmentType: assessment.assessmentType,
        title: assessment.title,
        maxScore: assessment.maxScore,
        weight,
      });

      if (!definitionMap.has(key)) {
        definitionMap.set(key, {
          id: key,
          title: assessment.title,
          maxScore: assessment.maxScore,
          type: assessment.assessmentType,
          weight,
        });
      }

      const studentKey = String(assessment.studentId);
      if (!byStudent.has(studentKey)) {
        byStudent.set(studentKey, new Map());
      }
      byStudent.get(studentKey)?.set(key, assessment);
    }

    const definitions = Array.from(definitionMap.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    const categories = [
      {
        name: "CA",
        weight: caWeight,
        assessments: definitions.filter((def) => CA_TYPES.has(def.type)),
      },
      {
        name: "Exam",
        weight: examWeight,
        assessments: definitions.filter((def) => EXAM_TYPES.has(def.type)),
      },
    ].filter((category) => category.assessments.length > 0);

    const assessmentColumns: AssessmentColumn[] = categories.flatMap((category) =>
      category.assessments.map((assessment) => ({
        id: assessment.id,
        label: `${category.name}: ${assessment.title}`,
        maxScore: assessment.maxScore,
        type: assessment.type,
        category: category.name,
      }))
    );

    const rowData: RowData[] = students.map((student) => {
      const studentMap = byStudent.get(String(student._id));

      let caTotal = 0;
      let caMax = 0;
      let examTotal = 0;
      let examMax = 0;

      const scores = assessmentColumns.map((assessment) => {
        const record = studentMap?.get(assessment.id);
        const score = record?.score ?? null;

        if (score !== null) {
          if (CA_TYPES.has(assessment.type)) {
            caTotal += score;
            caMax += assessment.maxScore;
          } else if (EXAM_TYPES.has(assessment.type)) {
            examTotal += score;
            examMax += assessment.maxScore;
          }
        } else {
          if (CA_TYPES.has(assessment.type)) caMax += assessment.maxScore;
          if (EXAM_TYPES.has(assessment.type)) examMax += assessment.maxScore;
        }

        return score === null ? null : score;
      });

      const caPercentage = caMax > 0 ? (caTotal / caMax) * 100 : 0;
      const examPercentage = examMax > 0 ? (examTotal / examMax) * 100 : 0;
      const finalScore = caPercentage * caWeight + examPercentage * examWeight;
      const mapping = getGradeMapping(mappings, finalScore);

      const name = `${student.firstName} ${student.lastName}`.trim();

      return {
        admissionNo: student.admissionNo || "",
        name,
        scores,
        totals: {
          caTotal: Number(caTotal.toFixed(2)),
          examTotal: Number(examTotal.toFixed(2)),
          finalScore: Number(finalScore.toFixed(2)),
          grade: mapping?.letter || "",
        },
      };
    });

    const filenameBase = `gradebook-${classLabel}-${subject.name}-${new Date().toISOString().split("T")[0]}`;

    if (format === "csv") {
      const headers = [
        "Admission No",
        "Student",
        ...assessmentColumns.map((assessment) => `${assessment.label} (${assessment.maxScore})`),
        "CA Total",
        "Exam Total",
        "Final Score",
        "Grade",
      ];

      const rows = rowData.map((row) => [
        row.admissionNo,
        row.name,
        ...row.scores.map((score) => (score === null ? "" : score)),
        row.totals.caTotal,
        row.totals.examTotal,
        row.totals.finalScore,
        row.totals.grade,
      ]);

      const csv = buildCsv(headers, rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=\"${filenameBase.replace(/\s+/g, "-")}.csv\"`,
        },
      });
    }

    const periodLabel = period ? `${period.yearLabel} ${period.term}` : null;

    const pdfBytes = await buildPdf({
      classLabel,
      subjectLabel: subject.name,
      periodLabel,
      columns: assessmentColumns,
      rows: rowData,
    });

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filenameBase.replace(/\s+/g, "-")}.pdf\"`,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to export gradebook:", e);
    const message = e instanceof Error ? e.message : "Failed to export gradebook";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
