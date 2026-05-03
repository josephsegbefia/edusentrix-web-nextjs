import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonAuditLog } from "@/models/LessonAuditLog";
import { Lesson, type ILesson } from "@/models/Lesson";
import mongoose from "mongoose";
import type { AdminLessonAuditRow } from "@/types/lesson-audit";
import { actorLabelsForUserIds } from "@/lib/lessons/audit-actor-labels";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.lessonAuditView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id")
      .lean()) as Pick<ILesson, "_id"> | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const limitParam = new URL(req.url).searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 50) : 25;

    const slice = await LessonAuditLog.find({
      schoolId: context.schoolId,
      lessonId,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const actorLabelMap = await actorLabelsForUserIds(
      slice.map((r) => new mongoose.Types.ObjectId(String(r.actorId)))
    );

    const entries: AdminLessonAuditRow[] = slice.map((r) => ({
      id: String(r._id),
      lessonId: String(r.lessonId),
      actorId: String(r.actorId),
      actorLabel: actorLabelMap.get(String(r.actorId)),
      action: r.action,
      metadata:
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {},
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
    }));

    return Response.json({ success: true, data: { entries } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Teacher lesson audit GET failed:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
