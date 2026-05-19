import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeImportJob, type ISchemeImportJob } from "@/models/SchemeImportJob";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeItem } from "@/models/SchemeItem";
import { ClassGroup } from "@/models/ClassGroup";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { assertSchemeImportEnabled } from "@/lib/schemes/scheme-import-gate";
import { deriveCurriculumStructureFromSchemeImport } from "@/lib/schemes/scheme-import-curriculum-derive";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";
import {
  buildSchemeItemTitle,
  schemeImportRowFieldsForItem,
} from "@/lib/schemes/scheme-import-confirm-shared";
import { serializeSchemeRow } from "@/lib/schemes/serializers";
import { resolveSubjectOfferingForSchool } from "@/lib/subject-offerings/resolve-subject-offering";

const ConfirmBodySchema = z.object({
  schemeTitle: z.string().trim().min(3).max(220),
  academicPeriodId: z.string().trim().min(1),
  gradeId: z.string().trim().min(1),
  classGroupId: z.string().trim().nullable().optional(),
  subjectOfferingId: z.string().trim().optional().nullable(),
  subjectId: z.string().trim().optional().nullable(),
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
  if (
    job.sourceKind === "pdf_ai" ||
    job.sourceKind === "pdf_gemini" ||
    job.sourceKind === "pdf_manual"
  ) {
    return "pdf_import";
  }
  const ext = job.fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv_import";
  if (ext === "xls" || ext === "xlsx") return "excel_import";
  return "manual";
}

function canAccessImportJob(
  ctx: Awaited<ReturnType<typeof requireTeacher>>,
  job: ISchemeImportJob
): boolean {
  if (String(job.schoolId) !== String(ctx.schoolId)) return false;
  if (ctx.isAdmin) return true;
  return String(job.createdByUserId) === String(ctx.userId);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!ctx.isAdmin) {
      return Response.json(
        { success: false, error: "Only school admins can confirm scheme imports." },
        { status: 403 }
      );
    }
    if (!can(ctx.permissions, PERMISSIONS.schemeImportConfirm)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const gate = await assertSchemeImportEnabled(ctx.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }

    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const job = await SchemeImportJob.findById(new mongoose.Types.ObjectId(id));
    if (!job || !canAccessImportJob(ctx, job.toObject())) {
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

    const gradeId = parseId(parsed.data.gradeId ?? undefined);
    const academicPeriodId = parseId(parsed.data.academicPeriodId);
    const classGroupId = parseId(parsed.data.classGroupId ?? undefined);
    const subjectOfferingId = parseId(parsed.data.subjectOfferingId ?? undefined);
    let subjectId = parseId(parsed.data.subjectId ?? undefined);
    if (!academicPeriodId) {
      return Response.json({ success: false, error: "Invalid academicPeriodId" }, { status: 400 });
    }
    if (!gradeId) {
      return Response.json({ success: false, error: "Invalid gradeId" }, { status: 400 });
    }
    if (parsed.data.classGroupId && !classGroupId) {
      return Response.json({ success: false, error: "Invalid classGroupId" }, { status: 400 });
    }
    if (parsed.data.subjectOfferingId && !subjectOfferingId) {
      return Response.json({ success: false, error: "Invalid subjectOfferingId" }, { status: 400 });
    }
    let effectiveSubjectOfferingId = subjectOfferingId;
    if (subjectOfferingId) {
      const offeringResolution = await resolveSubjectOfferingForSchool({
        schoolId: ctx.schoolId,
        subjectOfferingId,
        gradeId,
        classGroupId,
        requireClassAssignment: Boolean(classGroupId),
      });
      if (!offeringResolution.ok) {
        return Response.json(
          { success: false, error: offeringResolution.error },
          { status: offeringResolution.status }
        );
      }
      subjectId = offeringResolution.offering.subjectId;
      effectiveSubjectOfferingId = offeringResolution.offering._id;
    }
    if (!subjectId) {
      return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
    }

    if (!ctx.isAdmin) {
      const gradeClassGroups = await ClassGroup.find({
        schoolId: ctx.schoolId,
        gradeId,
      })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId }[]>();
      if (gradeClassGroups.length === 0) {
        return Response.json(
          { success: false, error: "No class groups exist for this grade" },
          { status: 400 }
        );
      }
      const assignment = await TeacherAssignment.exists({
        schoolId: ctx.schoolId,
        teacherId: ctx.teacherId,
        academicPeriodId,
        ...(effectiveSubjectOfferingId ? { subjectOfferingId: effectiveSubjectOfferingId } : { subjectId }),
        classGroupId: { $in: gradeClassGroups.map((group) => group._id) },
        status: "active",
      });
      if (!assignment) {
        return Response.json(
          { success: false, error: "You can only import schemes for grades and subjects assigned to you" },
          { status: 403 }
        );
      }
    }

    const importable = job.parsedRows.filter((r) => {
      if (r.skipped || r.errors.length > 0) return false;
      return buildSchemeItemTitle(r).trim().length >= 2;
    });
    if (importable.length === 0) {
      return Response.json(
        { success: false, error: "No valid rows to import — fix or skip invalid rows" },
        { status: 400 }
      );
    }

    const existingScheme = await SchemeOfWork.findOne({
      schoolId: ctx.schoolId,
      academicPeriodId,
      gradeId,
      subjectId,
      ...(effectiveSubjectOfferingId ? { subjectOfferingId: effectiveSubjectOfferingId } : {}),
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

    const scheme = await SchemeOfWork.create({
      schoolId: ctx.schoolId,
      title: parsed.data.schemeTitle,
      academicPeriodId,
      curriculumId: derivedCurriculum.curriculumId,
      curriculumSubjectId: derivedCurriculum.curriculumSubjectId,
      gradeId,
      classGroupId: null,
      subjectId,
      ...(effectiveSubjectOfferingId ? { subjectOfferingId: effectiveSubjectOfferingId } : {}),
      ownerTeacherId: ctx.teacherId,
      status: "draft",
      sourceType: sourceTypeForJob(job.toObject()),
      sourceFileUrl: job.fileUrl ?? null,
      sourceFileKey: job.fileKey ?? null,
      createdByUserId: ctx.userId,
      updatedByUserId: ctx.userId,
    });

    let sequence = 0;
    for (const row of job.parsedRows) {
      if (row.skipped || row.errors.length > 0) continue;
      const fields = schemeImportRowFieldsForItem(row);
      if (fields.title.length < 2) continue;
      const plannedEndDate = parseWeekEnding(row.weekEnding);
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
        plannedEndDate,
        curriculumNodeIds: derivedCurriculum.rowNodeIds.get(row.rowIndex) ?? [],
        status: "draft",
        createdByUserId: ctx.userId,
        updatedByUserId: ctx.userId,
      });
      sequence += 1;
    }

    if (sequence === 0) {
      await SchemeOfWork.deleteOne({ _id: scheme._id });
      return Response.json(
        { success: false, error: "No rows could be imported" },
        { status: 400 }
      );
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
