import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson } from "@/models/Lesson";
import { canTeacherCollaborateOnLesson } from "@/lib/lessons/collaboration";
import { assertLessonsModuleEnabled } from "@/lib/lessons/settings";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";
import { recordLessonAudit } from "@/lib/lessons/lesson-audit";

const VocabularySchema = z.object({
  term: z.string().trim().min(1).max(160),
  definition: z.string().trim().min(1).max(1000),
});

const StudentContentSchema = z.object({
  summaryHtml: z.string().max(48_000).optional().nullable(),
  keyPoints: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  vocabulary: z.array(VocabularySchema).max(30).optional(),
  studentInstructions: z.string().trim().max(12_000).optional().nullable(),
  practicePrompt: z.string().trim().max(12_000).optional().nullable(),
  estimatedReadingMinutes: z.number().int().min(0).max(600).optional().nullable(),
  aiGenerated: z.boolean().optional(),
  teacherReviewed: z.boolean().optional(),
  aiTool: z.string().trim().max(120).optional().nullable(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function serializeStudentContent(lesson: Pick<ILesson, "studentContent">) {
  const content = lesson.studentContent;
  return {
    summaryHtml: content?.summaryHtml ?? "",
    keyPoints: content?.keyPoints ?? [],
    vocabulary: content?.vocabulary ?? [],
    studentInstructions: content?.studentInstructions ?? "",
    practicePrompt: content?.practicePrompt ?? "",
    estimatedReadingMinutes: content?.estimatedReadingMinutes ?? null,
    aiGenerated: content?.aiGenerated ?? false,
    teacherReviewed: content?.teacherReviewed ?? false,
    aiTool: content?.aiTool ?? null,
    aiGeneratedAt: content?.aiGeneratedAt ? new Date(content.aiGeneratedAt).toISOString() : null,
    lastEditedAt: content?.lastEditedAt ? new Date(content.lastEditedAt).toISOString() : null,
  };
}

async function loadLesson(schoolId: mongoose.Types.ObjectId, lessonId: mongoose.Types.ObjectId) {
  return Lesson.findOne({ _id: lessonId, schoolId })
    .select("_id schoolId teacherId classGroupId subjectId academicPeriodId collaboratorTeacherIds studentContent")
    .lean() as Promise<ILesson | null>;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    if (!can(context.permissions, PERMISSIONS.lessonStudentContentRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    const lesson = await loadLesson(context.schoolId, lessonId);
    if (!lesson) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    const canCollaborate = await canTeacherCollaborateOnLesson(context.schoolId, context.teacherId, lesson);
    if (!canCollaborate) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });

    return Response.json({ success: true, data: { studentContent: serializeStudentContent(lesson) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load student content" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    if (!can(context.permissions, PERMISSIONS.lessonStudentContentManage)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    const lesson = await loadLesson(context.schoolId, lessonId);
    if (!lesson) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    const canCollaborate = await canTeacherCollaborateOnLesson(context.schoolId, context.teacherId, lesson);
    if (!canCollaborate) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });

    const parsed = StudentContentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed" }, { status: 400 });
    }

    const now = new Date();
    const existing = lesson.studentContent ?? { keyPoints: [], vocabulary: [] };
    const studentContent = {
      ...existing,
      ...parsed.data,
      summaryHtml:
        parsed.data.summaryHtml !== undefined
          ? sanitizeLessonHtml(parsed.data.summaryHtml)
          : existing.summaryHtml,
      studentInstructions: parsed.data.studentInstructions?.trim() || undefined,
      practicePrompt: parsed.data.practicePrompt?.trim() || undefined,
      estimatedReadingMinutes: parsed.data.estimatedReadingMinutes ?? undefined,
      aiTool: parsed.data.aiTool?.trim() || undefined,
      lastEditedBy: context.userId,
      lastEditedAt: now,
      ...(parsed.data.aiGenerated ? { aiGeneratedAt: now, aiAppliedBy: context.userId } : {}),
    };

    await Lesson.updateOne({ _id: lessonId, schoolId: context.schoolId }, { $set: { studentContent } });
    void recordLessonAudit({
      schoolId: context.schoolId,
      lessonId,
      actorId: context.userId,
      action: "student_content_updated",
      metadata: { teacherReviewed: Boolean(studentContent.teacherReviewed), aiGenerated: Boolean(studentContent.aiGenerated) },
      httpRequest: req,
      actorRole: context.isAdmin ? "school_admin" : "teacher",
    });

    return Response.json({ success: true, data: { studentContent: serializeStudentContent({ studentContent }) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save student content" },
      { status: 500 }
    );
  }
}
