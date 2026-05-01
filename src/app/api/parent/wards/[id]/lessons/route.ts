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
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id: wardId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(wardId)) {
      return NextResponse.json({ success: false, error: "Invalid student ID" }, { status: 400 });
    }

    await verifyGuardianAccess(context.userId, wardId);

    const settings = (await SchoolSettings.findOne({ schoolId: context.schoolId })
      .select("lessonsModule")
      .lean()) as { lessonsModule?: { parentSummaryVisibleToParents?: boolean } } | null;

    if (!settings?.lessonsModule?.parentSummaryVisibleToParents) {
      return NextResponse.json({
        success: true,
        data: { visible: false as const, lessons: [] },
      });
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

    const rows = (await Lesson.find({
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "published",
    })
      .sort({ publishedAt: -1, updatedAt: -1 })
      .limit(80)
      .select("_id title subjectId scheduledAt publishedAt parentSummaryHtml")
      .lean()) as Pick<
      ILesson,
      "_id" | "title" | "subjectId" | "scheduledAt" | "publishedAt" | "parentSummaryHtml"
    >[];

    const subjectIds = [
      ...new Set(rows.map((r) => r.subjectId).filter(Boolean)),
    ] as mongoose.Types.ObjectId[];
    const subjects = subjectIds.length
      ? ((await Subject.find({ _id: { $in: subjectIds } })
          .select("_id name")
          .lean()) as { _id: mongoose.Types.ObjectId; name: string }[])
      : [];
    const subjectNameById = new Map(subjects.map((s) => [String(s._id), s.name]));

    return NextResponse.json({
      success: true,
      data: {
        visible: true as const,
        lessons: rows.map((r) => ({
          id: String(r._id),
          title: r.title,
          subjectName: r.subjectId ? subjectNameById.get(String(r.subjectId)) ?? null : null,
          scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : null,
          publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
          hasParentSummary: Boolean(r.parentSummaryHtml && String(r.parentSummaryHtml).trim()),
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[parent/wards/.../lessons]", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
