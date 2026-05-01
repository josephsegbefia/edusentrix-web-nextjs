import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { serializeSchemeItemRow } from "@/lib/schemes/serializers";

const CreateItemSchema = z.object({
  weekNumber: z.number().min(1).max(53).nullable().optional(),
  sequence: z.number().min(0).optional(),
  title: z.string().trim().min(2).max(260),
  learningObjective: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
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
    const schemeExists = await SchemeOfWork.exists({ _id: schemeId, schoolId: ctx.schoolId });
    if (!schemeExists) {
      return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    }
    const items = (await SchemeItem.find({ schoolId: ctx.schoolId, schemeId })
      .sort({ weekNumber: 1, sequence: 1, createdAt: 1 })
      .lean()) as ISchemeItem[];
    return Response.json({ success: true, data: { items: items.map(serializeSchemeItemRow) } });
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
    if (scheme.status !== "draft") {
      return Response.json(
        { success: false, error: "Only draft schemes can be edited" },
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
      sequence: parsed.data.sequence ?? 0,
      title: parsed.data.title,
      learningObjective: parsed.data.learningObjective ?? null,
      notes: parsed.data.notes ?? null,
      curriculumNodeIds: nodeIds,
      suggestedLessonTemplateType: parsed.data.suggestedLessonTemplateType ?? null,
      suggestedDurationMinutes: parsed.data.suggestedDurationMinutes ?? null,
      status: "draft",
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
