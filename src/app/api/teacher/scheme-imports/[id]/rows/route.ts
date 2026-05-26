import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeImportJob, type ISchemeImportJob } from "@/models/SchemeImportJob";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";
import { normalizeParsedImportRows } from "@/lib/schemes/scheme-import-rows";

const RowSchema = z.object({
  rowIndex: z.number().int().min(1),
  weekNumber: z.union([z.number().min(1).max(53), z.null()]).optional(),
  weekEnding: z.string().trim().max(120).nullable().optional(),
  title: z.string().trim().min(2).max(300),
  strand: z.string().trim().max(300).nullable().optional(),
  subStrand: z.string().trim().max(300).nullable().optional(),
  contentStandard: z.string().trim().max(600).nullable().optional(),
  indicators: z.array(z.string().trim().max(600)).max(20).optional(),
  learningOutcomes: z.array(z.string().trim().max(1000)).max(20).optional(),
  teachingLearningActivities: z.string().trim().max(8000).nullable().optional(),
  resources: z.array(z.string().trim().max(500)).max(20).optional(),
  assessment: z.array(z.string().trim().max(1000)).max(20).optional(),
  learningObjective: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  rowType: z
    .enum(["teaching", "revision", "examination", "holiday", "other"])
    .optional(),
  skipped: z.boolean().optional(),
  confidence: z.union([z.number().min(0).max(1), z.null()]).optional(),
  rawText: z.string().trim().max(4000).nullable().optional(),
});

const PatchBodySchema = z.object({
  rows: z.array(RowSchema).max(500),
});

function canAccessImportJob(
  ctx: Awaited<ReturnType<typeof requireTeacher>>,
  job: ISchemeImportJob
): boolean {
  if (String(job.schoolId) !== String(ctx.schoolId)) return false;
  if (ctx.isAdmin) return true;
  return String(job.createdByUserId) === String(ctx.userId);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeImportUpload)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
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
        { success: false, error: "This import can no longer be edited" },
        { status: 409 }
      );
    }

    const parsed = PatchBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const normalized = normalizeParsedImportRows(
      parsed.data.rows.map((r) => ({
        rowIndex: r.rowIndex,
        weekNumber: r.weekNumber ?? null,
        weekEnding: r.weekEnding ?? null,
        title: r.title,
        strand: r.strand ?? null,
        subStrand: r.subStrand ?? null,
        contentStandard: r.contentStandard ?? null,
        indicators: r.indicators ?? [],
        learningOutcomes: r.learningOutcomes ?? [],
        teachingLearningActivities: r.teachingLearningActivities ?? null,
        resources: r.resources ?? [],
        assessment: r.assessment ?? [],
        learningObjective: r.learningObjective ?? null,
        notes: r.notes ?? null,
        rowType: r.rowType ?? "teaching",
        skipped: r.skipped ?? false,
        confidence: r.confidence === undefined ? null : r.confidence,
        rawText: r.rawText ?? null,
        errors: [] as string[],
      }))
    );

    job.parsedRows = normalized;
    await job.save();

    return Response.json({
      success: true,
      data: { job: serializeSchemeImportJob(job.toObject()) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save rows" },
      { status: 500 }
    );
  }
}
