import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonResource, type ILessonResource } from "@/models/LessonResource";
import { recordLessonAudit } from "@/lib/lessons/lesson-audit";
import { normalizeSafeExternalUrl } from "@/lib/lessons/content-safety";

const PatchBodySchema = z.object({
  title: z.string().trim().min(1).max(220).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  url: z.string().trim().url().max(2000).optional(),
  visibility: z.enum(["teacher_only", "students", "parents_only", "students_and_parents"]).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.lessonResourcesManage)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { resourceId } = await params;
    const rid = toObjectIdOrNull(resourceId);
    if (!rid) {
      return Response.json({ success: false, error: "Invalid resource ID" }, { status: 400 });
    }

    const existing = (await LessonResource.findOne({
      _id: rid,
      schoolId: context.schoolId,
    }).lean()) as ILessonResource | null;

    if (!existing) {
      return Response.json({ success: false, error: "Resource not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: existing.lessonId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id")
      .lean()) as Pick<ILesson, "_id"> | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = PatchBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.description !== undefined) {
      update.description = parsed.data.description?.trim() || undefined;
    }
    if (parsed.data.visibility !== undefined) update.visibility = parsed.data.visibility;
    if (parsed.data.url !== undefined) {
      if (existing.kind !== "link") {
        return Response.json({ success: false, error: "URL can only be set on link resources" }, { status: 400 });
      }
      const safeUrl = normalizeSafeExternalUrl(parsed.data.url);
      if (!safeUrl) {
        return Response.json({ success: false, error: "Resource URL must be a safe https URL" }, { status: 400 });
      }
      update.url = safeUrl;
    }

    if (Object.keys(update).length === 0) {
      return Response.json({ success: true });
    }

    await LessonResource.updateOne({ _id: rid }, { $set: update });
    void recordLessonAudit({
      schoolId: context.schoolId,
      lessonId: existing.lessonId,
      actorId: context.userId,
      action: "resource_updated",
      metadata: { resourceId: String(rid), fields: Object.keys(update) },
      httpRequest: req,
      actorRole: context.isAdmin ? "school_admin" : "teacher",
    });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update lesson resource:", e);
    const message = e instanceof Error ? e.message : "Failed to update resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.lessonResourcesManage)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { resourceId } = await params;
    const rid = toObjectIdOrNull(resourceId);
    if (!rid) {
      return Response.json({ success: false, error: "Invalid resource ID" }, { status: 400 });
    }

    const existing = (await LessonResource.findOne({
      _id: rid,
      schoolId: context.schoolId,
    }).lean()) as ILessonResource | null;

    if (!existing) {
      return Response.json({ success: false, error: "Resource not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: existing.lessonId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id")
      .lean()) as Pick<ILesson, "_id"> | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await LessonResource.deleteOne({ _id: rid });

    void recordLessonAudit({
      schoolId: context.schoolId,
      lessonId: existing.lessonId,
      actorId: context.userId,
      action: "resource_deleted",
      metadata: { resourceId: String(rid) },
      httpRequest: req,
      actorRole: context.isAdmin ? "school_admin" : "teacher",
    });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete lesson resource:", e);
    const message = e instanceof Error ? e.message : "Failed to delete resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
