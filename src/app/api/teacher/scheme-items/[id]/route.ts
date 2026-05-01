import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeItem } from "@/models/SchemeItem";
import { SchemeOfWork } from "@/models/SchemeOfWork";
import { serializeSchemeItemRow } from "@/lib/schemes/serializers";

const PatchItemSchema = z.object({
  weekNumber: z.number().min(1).max(53).nullable().optional(),
  sequence: z.number().min(0).optional(),
  title: z.string().trim().min(2).max(260).optional(),
  learningObjective: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  curriculumNodeIds: z.array(z.string()).optional(),
  suggestedLessonTemplateType: z.string().trim().max(120).nullable().optional(),
  suggestedDurationMinutes: z.number().min(10).max(360).nullable().optional(),
  status: z.enum(["draft", "ready", "dropped"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeItemUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid item id" }, { status: 400 });
    }

    const parsed = PatchItemSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await SchemeItem.findById(new mongoose.Types.ObjectId(id));
    if (!item || String(item.schoolId) !== String(ctx.schoolId)) {
      return Response.json({ success: false, error: "Item not found" }, { status: 404 });
    }
    const scheme = await SchemeOfWork.findById(item.schemeId).select("_id schoolId status");
    if (!scheme || String(scheme.schoolId) !== String(ctx.schoolId)) {
      return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    }
    if (scheme.status !== "draft") {
      return Response.json(
        { success: false, error: "Only draft schemes can be edited" },
        { status: 409 }
      );
    }

    if (parsed.data.weekNumber !== undefined) item.weekNumber = parsed.data.weekNumber;
    if (parsed.data.sequence !== undefined) item.sequence = parsed.data.sequence;
    if (parsed.data.title !== undefined) item.title = parsed.data.title;
    if (parsed.data.learningObjective !== undefined)
      item.learningObjective = parsed.data.learningObjective;
    if (parsed.data.notes !== undefined) item.notes = parsed.data.notes;
    if (parsed.data.suggestedLessonTemplateType !== undefined)
      item.suggestedLessonTemplateType = parsed.data.suggestedLessonTemplateType;
    if (parsed.data.suggestedDurationMinutes !== undefined)
      item.suggestedDurationMinutes = parsed.data.suggestedDurationMinutes;
    if (parsed.data.status !== undefined) item.status = parsed.data.status;
    if (parsed.data.curriculumNodeIds !== undefined) {
      const nodeIds = parsed.data.curriculumNodeIds.flatMap((value) =>
        mongoose.Types.ObjectId.isValid(value) ? [new mongoose.Types.ObjectId(value)] : []
      );
      if (nodeIds.length !== parsed.data.curriculumNodeIds.length) {
        return Response.json({ success: false, error: "Invalid curriculumNodeIds" }, { status: 400 });
      }
      item.curriculumNodeIds = nodeIds;
    }
    item.updatedByUserId = ctx.userId;
    await item.save();

    return Response.json({ success: true, data: { item: serializeSchemeItemRow(item.toObject()) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update item" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeItemDelete)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid item id" }, { status: 400 });
    }
    const item = await SchemeItem.findById(new mongoose.Types.ObjectId(id));
    if (!item || String(item.schoolId) !== String(ctx.schoolId)) {
      return Response.json({ success: false, error: "Item not found" }, { status: 404 });
    }
    const scheme = await SchemeOfWork.findById(item.schemeId).select("schoolId status");
    if (!scheme || String(scheme.schoolId) !== String(ctx.schoolId)) {
      return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    }
    if (scheme.status !== "draft") {
      return Response.json(
        { success: false, error: "Only draft schemes can be edited" },
        { status: 409 }
      );
    }

    await item.deleteOne();
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete item" },
      { status: 500 }
    );
  }
}
