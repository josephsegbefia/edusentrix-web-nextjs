import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";
import { TeacherResource } from "@/models/TeacherResource";

const UpdateResourceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  url: z.string().min(1).max(1000).optional(),
  type: z.enum(["link", "pdf", "video", "image", "doc", "slides", "other"]).optional(),
  tags: z.array(z.string().max(40)).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const resourceId = toObjectIdOrNull(params.id);
    if (!resourceId) {
      return Response.json({ success: false, error: "Invalid resource ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = UpdateResourceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const unsetData: Record<string, unknown> = {};

    if (parsed.data.title) updateData.title = parsed.data.title;
    if (parsed.data.url) updateData.url = parsed.data.url;
    if (parsed.data.type) updateData.type = parsed.data.type;
    if (parsed.data.tags) updateData.tags = parsed.data.tags;

    if ("description" in parsed.data) {
      if (parsed.data.description) {
        updateData.description = parsed.data.description;
      } else {
        unsetData.description = "";
      }
    }

    const updatePayload: Record<string, unknown> = { $set: updateData };
    if (Object.keys(unsetData).length > 0) {
      updatePayload.$unset = unsetData;
    }

    const result = await TeacherResource.updateOne(
      { _id: resourceId, schoolId: context.schoolId, teacherId: context.teacherId },
      updatePayload
    );

    if (!result.matchedCount) {
      return Response.json({ success: false, error: "Resource not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update resource:", e);
    const message = e instanceof Error ? e.message : "Failed to update resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const resourceId = toObjectIdOrNull(params.id);
    if (!resourceId) {
      return Response.json({ success: false, error: "Invalid resource ID" }, { status: 400 });
    }

    const result = await TeacherResource.deleteOne({
      _id: resourceId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    });

    if (!result.deletedCount) {
      return Response.json({ success: false, error: "Resource not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete resource:", e);
    const message = e instanceof Error ? e.message : "Failed to delete resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
