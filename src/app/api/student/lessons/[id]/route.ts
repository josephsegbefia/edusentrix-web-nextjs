import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import {
  buildPublishedSnapshotFromLessonNote,
  lessonSnapshotToStudentDisplayNote,
} from "@/lib/lessons/published-snapshot";
import type { ILessonPublishedSnapshot } from "@/models/Lesson";
import { StudentLessonProgress } from "@/models/StudentLessonProgress";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

async function resolvePublishedSnapshot(
  lesson: ILesson,
  schoolId: mongoose.Types.ObjectId
): Promise<ILessonPublishedSnapshot | null> {
  const snap = lesson.publishedSnapshot;
  if (snap && typeof snap === "object" && "topic" in snap && "templateType" in snap) {
    return snap as ILessonPublishedSnapshot;
  }

  const note = (await LessonNote.findOne({
    _id: lesson.lessonNoteId,
    schoolId,
  }).lean()) as ILessonNote | null;

  if (!note || String(note.classGroupId) !== String(lesson.classGroupId)) {
    return null;
  }

  return buildPublishedSnapshotFromLessonNote(note);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const { id } = await params;

    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean()) as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "published",
    })
      .select("_id")
      .lean()) as { _id: mongoose.Types.ObjectId } | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const now = new Date();
    await StudentLessonProgress.updateOne(
      {
        schoolId: context.schoolId,
        studentId: student._id,
        lessonId,
      },
      {
        $set: { lastActivityAt: now, completionStatus: "viewed" },
        $setOnInsert: {
          schoolId: context.schoolId,
          studentId: student._id,
          lessonId,
          viewedAt: now,
        },
        $inc: { viewCount: 1 },
      },
      { upsert: true }
    );

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to record student lesson view:", e);
    const message = e instanceof Error ? e.message : "Failed to record view";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const { id } = await params;

    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean()) as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "published",
    }).lean()) as ILesson | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const snapshot = await resolvePublishedSnapshot(lesson, context.schoolId);
    if (!snapshot) {
      return Response.json(
        { success: false, error: "Lesson content is not available" },
        { status: 404 }
      );
    }

    const [classGroup, subjectDoc, progressDoc] = await Promise.all([
      ClassGroup.findById(lesson.classGroupId).select("name gradeId").lean() as Promise<{
        name: string;
        gradeId?: mongoose.Types.ObjectId;
      } | null>,
      lesson.subjectId
        ? (Subject.findById(lesson.subjectId).select("name").lean() as Promise<{
            name: string;
          } | null>)
        : Promise.resolve(null),
      StudentLessonProgress.findOne({
        schoolId: context.schoolId,
        studentId: student._id,
        lessonId: lesson._id,
      })
        .select("completionStatus completedAt viewedAt")
        .lean(),
    ]);

    let className = classGroup?.name || "";
    if (classGroup?.gradeId) {
      const grade = await Grade.findById(classGroup.gradeId).select("name").lean() as {
        name: string;
      } | null;
      if (grade?.name) {
        className = `${grade.name} ${className}`.trim();
      }
    }

    const displayNote = lessonSnapshotToStudentDisplayNote(
      lesson,
      snapshot,
      className || "—",
      subjectDoc?.name || null
    );

    return Response.json({
      success: true,
      data: {
        lesson: {
          id: String(lesson._id),
          title: lesson.title,
          publishedAt: lesson.publishedAt ? new Date(lesson.publishedAt).toISOString() : null,
          scheduledAt: lesson.scheduledAt ? new Date(lesson.scheduledAt).toISOString() : null,
        },
        displayNote,
        progress: progressDoc
          ? {
              completionStatus: progressDoc.completionStatus as "not_started" | "viewed" | "completed",
              completedAt: progressDoc.completedAt
                ? new Date(progressDoc.completedAt).toISOString()
                : null,
              viewedAt: progressDoc.viewedAt
                ? new Date(progressDoc.viewedAt).toISOString()
                : null,
            }
          : null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load student lesson:", e);
    const message = e instanceof Error ? e.message : "Failed to load lesson";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
