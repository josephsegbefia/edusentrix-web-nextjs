import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { canTeacherCollaborateOnLesson } from "@/lib/lessons/collaboration";
import { assertLessonsModuleEnabled } from "@/lib/lessons/settings";
import { buildLessonPublishChecklist } from "@/lib/lessons/publish-checklist";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const checklist = await buildLessonPublishChecklist({
      schoolId: context.schoolId,
      lessonId,
      settings: moduleGate.settings,
    });
    if (!checklist.lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }
    const canCollaborate = await canTeacherCollaborateOnLesson(
      context.schoolId,
      context.teacherId,
      checklist.lesson
    );
    if (!canCollaborate) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: { canPublish: checklist.canPublish, items: checklist.items },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to check lesson" },
      { status: 500 }
    );
  }
}
