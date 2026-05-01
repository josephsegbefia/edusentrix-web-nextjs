import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { Lesson, type ILesson } from "@/models/Lesson";
import { Subject } from "@/models/Subject";
import { SchoolSettings } from "@/models/SchoolSettings";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id: wardId, lessonId: lessonIdRaw } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(wardId) || !mongoose.Types.ObjectId.isValid(lessonIdRaw)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    await verifyGuardianAccess(context.userId, wardId);

    const settings = (await SchoolSettings.findOne({ schoolId: context.schoolId })
      .select("lessonsModule")
      .lean()) as { lessonsModule?: { parentSummaryVisibleToParents?: boolean } } | null;

    if (!settings?.lessonsModule?.parentSummaryVisibleToParents) {
      return NextResponse.json({ success: false, error: "Not available" }, { status: 403 });
    }

    const student = (await Student.findOne({
      _id: new mongoose.Types.ObjectId(wardId),
      schoolId: context.schoolId,
    })
      .select("_id classGroupId")
      .lean()) as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const lessonId = new mongoose.Types.ObjectId(lessonIdRaw);
    const lesson = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "published",
    })
      .select("_id title subjectId scheduledAt publishedAt parentSummaryHtml")
      .lean()) as Pick<
      ILesson,
      "_id" | "title" | "subjectId" | "scheduledAt" | "publishedAt" | "parentSummaryHtml"
    > | null;

    if (!lesson) {
      return NextResponse.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const html = lesson.parentSummaryHtml?.trim() || "";
    if (!html) {
      return NextResponse.json({
        success: true,
        data: {
          lesson: {
            id: String(lesson._id),
            title: lesson.title,
            subjectName: null as string | null,
            scheduledAt: lesson.scheduledAt ? new Date(lesson.scheduledAt).toISOString() : null,
            publishedAt: lesson.publishedAt ? new Date(lesson.publishedAt).toISOString() : null,
          },
          parentSummaryHtml: null,
        },
      });
    }

    let subjectName: string | null = null;
    if (lesson.subjectId) {
      const sub = (await Subject.findById(lesson.subjectId).select("name").lean()) as {
        name: string;
      } | null;
      subjectName = sub?.name ?? null;
    }

    return NextResponse.json({
      success: true,
      data: {
        lesson: {
          id: String(lesson._id),
          title: lesson.title,
          subjectName,
          scheduledAt: lesson.scheduledAt ? new Date(lesson.scheduledAt).toISOString() : null,
          publishedAt: lesson.publishedAt ? new Date(lesson.publishedAt).toISOString() : null,
        },
        parentSummaryHtml: html,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[parent/wards/.../lessons/lessonId]", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
