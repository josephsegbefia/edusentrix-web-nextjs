import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { LessonNote } from "@/models/LessonNote";
import { serializeSchemeItemRow } from "@/lib/schemes/serializers";
import { teacherMayEditScheme } from "@/lib/schemes/teacher-scheme-access";
import { teacherCanReadAssignedScheme } from "@/lib/schemes/teacher-assigned-schemes";

const CreateItemSchema = z.object({
  weekNumber: z.number().min(1).max(53).nullable().optional(),
  lessonOrder: z.number().min(1).nullable().optional(),
  sequence: z.number().min(0).optional(),
  title: z.string().trim().min(2).max(260),
  topic: z.string().trim().max(260).nullable().optional(),
  subtopic: z.string().trim().max(260).nullable().optional(),
  strand: z.string().trim().max(260).nullable().optional(),
  subStrand: z.string().trim().max(260).nullable().optional(),
  contentStandard: z.string().trim().max(600).nullable().optional(),
  indicator: z.string().trim().max(600).nullable().optional(),
  learningObjectives: z.array(z.string().trim().max(1000)).optional(),
  learningObjective: z.string().trim().max(5000).nullable().optional(),
  coreCompetencies: z.array(z.string().trim().max(500)).optional(),
  teachingResources: z.array(z.string().trim().max(500)).optional(),
  assessmentIdeas: z.array(z.string().trim().max(1000)).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  plannedStartDate: z.string().datetime().nullable().optional(),
  plannedEndDate: z.string().datetime().nullable().optional(),
  curriculumNodeIds: z.array(z.string()).optional(),
  suggestedLessonTemplateType: z.string().trim().max(120).nullable().optional(),
  suggestedDurationMinutes: z.number().min(10).max(360).nullable().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeOfWorkRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }
    const schemeId = new mongoose.Types.ObjectId(id);
    const scheme = await SchemeOfWork.findOne({ _id: schemeId, schoolId: ctx.schoolId }).lean();
    if (!scheme) {
      return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    }
    if (
      !ctx.isAdmin &&
      !(await teacherCanReadAssignedScheme(scheme, {
        schoolId: ctx.schoolId,
        teacherId: ctx.teacherId,
      }))
    ) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const items = (await SchemeItem.find({ schoolId: ctx.schoolId, schemeId })
      .sort({ weekNumber: 1, sequence: 1, createdAt: 1 })
      .lean()) as ISchemeItem[];
    const noteCounts = items.length
      ? await LessonNote.aggregate([
          {
            $match: {
              schoolId: ctx.schoolId,
              schemeId,
              schemeItemIds: { $in: items.map((item) => item._id) },
            },
          },
          { $unwind: "$schemeItemIds" },
          {
            $group: {
              _id: "$schemeItemIds",
              count: { $sum: 1 },
            },
          },
        ])
      : [];
    const noteCountMap = new Map(noteCounts.map((row: { _id: mongoose.Types.ObjectId; count: number }) => [String(row._id), row.count]));
    return Response.json({
      success: true,
      data: {
        items: items.map((item) => ({
          ...serializeSchemeItemRow(item),
          lessonNoteCount: noteCountMap.get(String(item._id)) ?? 0,
        })),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch items" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!ctx.isAdmin) {
      return Response.json(
        { success: false, error: "Only school admins can edit schemes of learning." },
        { status: 403 }
      );
    }
    if (!can(ctx.permissions, PERMISSIONS.schemeItemCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }
    const schemeId = new mongoose.Types.ObjectId(id);
    const parsed = CreateItemSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scheme = await SchemeOfWork.findOne({ _id: schemeId, schoolId: ctx.schoolId });
    if (!scheme) return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    if (!teacherMayEditScheme(scheme, ctx)) {
      return Response.json({ success: false, error: "Not allowed to edit this scheme" }, { status: 403 });
    }
    if (scheme.status !== "draft" && scheme.status !== "needs_revision") {
      return Response.json(
        { success: false, error: "Only draft or revision-requested schemes can be edited" },
        { status: 409 }
      );
    }

    const nodeIds = (parsed.data.curriculumNodeIds || []).flatMap((idValue) =>
      mongoose.Types.ObjectId.isValid(idValue) ? [new mongoose.Types.ObjectId(idValue)] : []
    );
    if (nodeIds.length !== (parsed.data.curriculumNodeIds || []).length) {
      return Response.json({ success: false, error: "Invalid curriculumNodeIds" }, { status: 400 });
    }

    const created = await SchemeItem.create({
      schoolId: ctx.schoolId,
      schemeId,
      weekNumber: parsed.data.weekNumber ?? null,
      lessonOrder: parsed.data.lessonOrder ?? null,
      sequence: parsed.data.sequence ?? 0,
      title: parsed.data.title,
      topic: parsed.data.topic ?? parsed.data.title,
      subtopic: parsed.data.subtopic ?? null,
      strand: parsed.data.strand ?? null,
      subStrand: parsed.data.subStrand ?? null,
      contentStandard: parsed.data.contentStandard ?? null,
      indicator: parsed.data.indicator ?? null,
      learningObjectives: parsed.data.learningObjectives ?? [],
      learningObjective: parsed.data.learningObjective ?? null,
      coreCompetencies: parsed.data.coreCompetencies ?? [],
      teachingResources: parsed.data.teachingResources ?? [],
      assessmentIdeas: parsed.data.assessmentIdeas ?? [],
      notes: parsed.data.notes ?? null,
      plannedStartDate: parsed.data.plannedStartDate ? new Date(parsed.data.plannedStartDate) : null,
      plannedEndDate: parsed.data.plannedEndDate ? new Date(parsed.data.plannedEndDate) : null,
      curriculumNodeIds: nodeIds,
      suggestedLessonTemplateType: parsed.data.suggestedLessonTemplateType ?? null,
      suggestedDurationMinutes: parsed.data.suggestedDurationMinutes ?? null,
      status: "not_started",
      createdByUserId: ctx.userId,
      updatedByUserId: ctx.userId,
    });

    return Response.json({ success: true, data: { item: serializeSchemeItemRow(created.toObject()) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create item" },
      { status: 500 }
    );
  }
}
