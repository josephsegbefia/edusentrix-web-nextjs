import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { serializeSchemeItemRow } from "@/lib/schemes/serializers";
import { teacherMayEditScheme } from "@/lib/schemes/teacher-scheme-access";

const RowSchema = z.object({
  weekNumber: z.number().min(1).max(53).nullable().optional(),
  title: z.string().trim().min(2).max(260),
  topic: z.string().trim().max(260).nullable().optional(),
  strand: z.string().trim().max(260).nullable().optional(),
  subStrand: z.string().trim().max(260).nullable().optional(),
  contentStandard: z.string().trim().max(600).nullable().optional(),
  indicator: z.string().trim().max(600).nullable().optional(),
  learningObjective: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  curriculumNodeIds: z.array(z.string()).optional(),
  suggestedLessonTemplateType: z.string().trim().max(120).nullable().optional(),
  suggestedDurationMinutes: z.number().min(10).max(360).nullable().optional(),
});

const BodySchema = z.object({
  items: z.array(RowSchema).min(1).max(60),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacherCtx = await requireTeacher();
    if (!can(teacherCtx.permissions, PERMISSIONS.schemeItemCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }
    const schemeId = new mongoose.Types.ObjectId(id);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scheme = await SchemeOfWork.findOne({ _id: schemeId, schoolId: teacherCtx.schoolId });
    if (!scheme) return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    if (!teacherMayEditScheme(scheme, teacherCtx)) {
      return Response.json({ success: false, error: "Not allowed to edit this scheme" }, { status: 403 });
    }
    if (scheme.status !== "draft" && scheme.status !== "needs_revision") {
      return Response.json(
        { success: false, error: "Only draft or revision-requested schemes can be edited" },
        { status: 409 }
      );
    }

    const last = (await SchemeItem.findOne({ schoolId: teacherCtx.schoolId, schemeId })
      .sort({ sequence: -1 })
      .select("sequence")
      .lean()) as Pick<ISchemeItem, "sequence"> | null;
    let seq = (last?.sequence ?? -1) + 1;

    const docs = [];
    for (const row of parsed.data.items) {
      const nodeIds = (row.curriculumNodeIds || []).flatMap((idValue) =>
        mongoose.Types.ObjectId.isValid(idValue) ? [new mongoose.Types.ObjectId(idValue)] : []
      );
      if (nodeIds.length !== (row.curriculumNodeIds || []).length) {
        return Response.json({ success: false, error: "Invalid curriculumNodeIds" }, { status: 400 });
      }
      docs.push({
        schoolId: teacherCtx.schoolId,
        schemeId,
        weekNumber: row.weekNumber ?? null,
        sequence: seq,
        title: row.title,
        topic: row.topic ?? row.title,
        strand: row.strand ?? null,
        subStrand: row.subStrand ?? null,
        contentStandard: row.contentStandard ?? null,
        indicator: row.indicator ?? null,
        learningObjective: row.learningObjective ?? null,
        notes: row.notes ?? null,
        curriculumNodeIds: nodeIds,
        suggestedLessonTemplateType: row.suggestedLessonTemplateType ?? null,
        suggestedDurationMinutes: row.suggestedDurationMinutes ?? null,
        status: "not_started" as const,
        createdByUserId: teacherCtx.userId,
        updatedByUserId: teacherCtx.userId,
      });
      seq += 1;
    }

    const created = await SchemeItem.insertMany(docs);
    const items = (await SchemeItem.find({
      _id: { $in: created.map((c) => c._id) },
      schoolId: teacherCtx.schoolId,
    })
      .sort({ sequence: 1 })
      .lean()) as ISchemeItem[];

    return Response.json({
      success: true,
      data: { items: items.map(serializeSchemeItemRow) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Batch create failed" },
      { status: 500 }
    );
  }
}
