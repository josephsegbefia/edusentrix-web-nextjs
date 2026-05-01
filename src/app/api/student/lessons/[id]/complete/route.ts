import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { Lesson } from "@/models/Lesson";
import { StudentLessonProgress } from "@/models/StudentLessonProgress";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * Student marks a published class lesson as studied (self-reported completion).
 */
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
        $set: {
          lastActivityAt: now,
          completionStatus: "completed",
          completedAt: now,
        },
        $setOnInsert: {
          schoolId: context.schoolId,
          studentId: student._id,
          lessonId,
          viewedAt: now,
          viewCount: 1,
        },
      },
      { upsert: true }
    );

    return Response.json({
      success: true,
      data: { completedAt: now.toISOString(), completionStatus: "completed" as const },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to record student lesson completion:", e);
    const message = e instanceof Error ? e.message : "Failed to record completion";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
