import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeImportJob, type ISchemeImportJob } from "@/models/SchemeImportJob";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeItem } from "@/models/SchemeItem";
import { assertSchemeImportEnabled } from "@/lib/schemes/scheme-import-gate";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";
import { serializeSchemeRow } from "@/lib/schemes/serializers";

const ConfirmBodySchema = z.object({
  schemeTitle: z.string().trim().min(3).max(220),
  gradeId: z.string().trim().nullable().optional(),
  subjectId: z.string().trim().nullable().optional(),
});

function parseId(id: string | null | undefined) {
  if (!id || id === "") return null;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
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
    const subjectId = parseId(parsed.data.subjectId ?? undefined);
    if (parsed.data.gradeId && !gradeId) {
      return Response.json({ success: false, error: "Invalid gradeId" }, { status: 400 });
    }
    if (parsed.data.subjectId && !subjectId) {
      return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
    }

    const importable = job.parsedRows.filter(
      (r) => !r.skipped && r.errors.length === 0 && r.title.trim().length >= 2
    );
    if (importable.length === 0) {
      return Response.json(
        { success: false, error: "No valid rows to import — fix or skip invalid rows" },
        { status: 400 }
      );
    }

    const scheme = await SchemeOfWork.create({
      schoolId: ctx.schoolId,
      title: parsed.data.schemeTitle,
      gradeId,
      subjectId,
      ownerTeacherId: ctx.teacherId,
      status: "draft",
      createdByUserId: ctx.userId,
      updatedByUserId: ctx.userId,
    });

    let sequence = 0;
    for (const row of job.parsedRows) {
      if (row.skipped || row.errors.length > 0) continue;
      const title = row.title.trim();
      if (title.length < 2) continue;
      await SchemeItem.create({
        schoolId: ctx.schoolId,
        schemeId: scheme._id,
        weekNumber: row.weekNumber ?? null,
        sequence,
        title,
        learningObjective: row.learningObjective?.trim() || null,
        notes: row.notes?.trim() || null,
        curriculumNodeIds: [],
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
