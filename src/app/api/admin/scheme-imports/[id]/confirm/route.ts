import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeImportJob, type ISchemeImportJob } from "@/models/SchemeImportJob";
import { SchemeItem } from "@/models/SchemeItem";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { assertSchemeImportEnabled } from "@/lib/schemes/scheme-import-gate";
import { deriveCurriculumStructureFromSchemeImport } from "@/lib/schemes/scheme-import-curriculum-derive";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";
import {
  buildSchemeItemTitle,
  schemeImportRowFieldsForItem,
} from "@/lib/schemes/scheme-import-confirm-shared";
import { serializeSchemeRow } from "@/lib/schemes/serializers";

const ConfirmBodySchema = z.object({
  schemeTitle: z.string().trim().min(3).max(220),
  academicPeriodId: z.string().trim().min(1),
  gradeId: z.string().trim().min(1),
  classGroupId: z.string().trim().nullable().optional(),
  subjectId: z.string().trim().min(1),
});

function parseId(id: string | null | undefined) {
  if (!id || id === "") return null;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function parseWeekEnding(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (parts) {
    const day = Number(parts[1]);
    const month = Number(parts[2]) - 1;
    const rawYear = Number(parts[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(Date.UTC(year, month, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month &&
      date.getUTCDate() === day
    ) {
      return date;
    }
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function buildNotes(row: ISchemeImportJob["parsedRows"][number]): string | null {
  const parts = [
    row.notes?.trim(),
    row.weekEnding ? `Week ending: ${row.weekEnding}` : null,
    row.rawText ? `Source row: ${row.rawText}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

function sourceTypeForJob(job: ISchemeImportJob): ISchemeOfWork["sourceType"] {
  if (job.sourceKind === "pdf_ai" || job.sourceKind === "pdf_gemini") return "pdf_import";
  const ext = job.fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv_import";
  if (ext === "xls" || ext === "xlsx") return "excel_import";
  return "manual";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSchoolAdminOrDelegatedAnyPermission([
      PERMISSIONS.schemeImportConfirm,
      PERMISSIONS.schemeOfWorkCreate,
      PERMISSIONS.schemeOfWorkReview,
    ]);

    const gate = await assertSchemeImportEnabled(ctx.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }

    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const job = await SchemeImportJob.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: ctx.schoolId,
    });
    if (!job) {
      return Response.json({ success: false, error: "Job not found" }, { status: 404 });
    }
    if (job.status !== "parsed") {
      return Response.json(
        { success: false, error: "This import was already processed" },
        { status: 409 }
      );
    }

    const parsed = ConfirmBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const academicPeriodId = parseId(parsed.data.academicPeriodId);
    const gradeId = parseId(parsed.data.gradeId);
    const classGroupId = parseId(parsed.data.classGroupId ?? undefined);
    const subjectId = parseId(parsed.data.subjectId);
    if (!academicPeriodId) return Response.json({ success: false, error: "Invalid academicPeriodId" }, { status: 400 });
    if (!gradeId) return Response.json({ success: false, error: "Invalid gradeId" }, { status: 400 });
    if (parsed.data.classGroupId && !classGroupId) {
      return Response.json({ success: false, error: "Invalid classGroupId" }, { status: 400 });
    }
    if (!subjectId) return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });

    const importable = job.parsedRows.filter((r) => {
      if (r.skipped || r.errors.length > 0) return false;
      return buildSchemeItemTitle(r).trim().length >= 2;
    });
    if (importable.length === 0) {
      return Response.json(
        { success: false, error: "No valid rows to import - fix or skip invalid rows" },
        { status: 400 }
      );
    }

    const existingScheme = await SchemeOfWork.findOne({
      schoolId: ctx.schoolId,
      academicPeriodId,
      gradeId,
      subjectId,
      classGroupId: null,
      status: { $in: ["draft", "submitted", "needs_revision", "approved", "active"] },
    })
      .select("_id title status")
      .lean();
    if (existingScheme) {
      return Response.json(
        {
          success: false,
          error: `A scheme already exists for this grade, subject, and period: "${existingScheme.title}". Open it or archive it before importing another.`,
          data: {
            existingScheme: {
              id: String(existingScheme._id),
              title: existingScheme.title,
              status: existingScheme.status,
            },
          },
        },
        { status: 409 }
      );
    }

    const derivedCurriculum = await deriveCurriculumStructureFromSchemeImport({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      subjectId,
      gradeId,
      rows: job.parsedRows,
    });

    const now = new Date();
    const scheme = await SchemeOfWork.create({
      schoolId: ctx.schoolId,
      title: parsed.data.schemeTitle,
      academicPeriodId,
      curriculumId: derivedCurriculum.curriculumId,
      curriculumSubjectId: derivedCurriculum.curriculumSubjectId,
      gradeId,
      classGroupId: null,
      subjectId,
      ownerTeacherId: null,
      status: "approved",
      sourceType: sourceTypeForJob(job.toObject()),
      sourceFileUrl: job.fileUrl ?? null,
      sourceFileKey: job.fileKey ?? null,
      approvedAt: now,
      approvedByUserId: ctx.userId,
      createdByUserId: ctx.userId,
      updatedByUserId: ctx.userId,
    });

    let sequence = 0;
    for (const row of job.parsedRows) {
      if (row.skipped || row.errors.length > 0) continue;
      const fields = schemeImportRowFieldsForItem(row);
      if (fields.title.length < 2) continue;
      const indicators = (row.indicators || []).map((i) => i.trim()).filter(Boolean);
      const resources = (row.resources || []).map((r) => r.trim()).filter(Boolean);
      await SchemeItem.create({
        schoolId: ctx.schoolId,
        schemeId: scheme._id,
        weekNumber: row.weekNumber ?? null,
        sequence,
        title: fields.title,
        strand: fields.strand,
        subStrand: fields.subStrand,
        contentStandard: fields.contentStandard,
        indicator: indicators.length ? indicators.join("\n") : null,
        teachingResources: resources,
        learningObjective: row.learningObjective?.trim() || null,
        notes: buildNotes(row),
        rowType: row.rowType || "teaching",
        sourceRowIndex: row.rowIndex,
        parseConfidence: row.confidence ?? null,
        weekEndingLabel: row.weekEnding?.trim() || null,
        plannedEndDate: parseWeekEnding(row.weekEnding),
        curriculumNodeIds: derivedCurriculum.rowNodeIds.get(row.rowIndex) ?? [],
        status: "draft",
        createdByUserId: ctx.userId,
        updatedByUserId: ctx.userId,
      });
      sequence += 1;
    }

    if (sequence === 0) {
      await SchemeOfWork.deleteOne({ _id: scheme._id });
      return Response.json({ success: false, error: "No rows could be imported" }, { status: 400 });
    }

    job.status = "confirmed";
    job.resultSchemeId = scheme._id;
    await job.save();

    const schemeDoc = (await SchemeOfWork.findById(scheme._id).lean()) as ISchemeOfWork | null;
    return Response.json({
      success: true,
      data: {
        job: serializeSchemeImportJob(job.toObject()),
        scheme: schemeDoc ? serializeSchemeRow(schemeDoc) : null,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Confirm failed" },
      { status: 500 }
    );
  }
}
