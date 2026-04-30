import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import {
  listPublishedLibraryNoticesForPatron,
  serializeLibraryNoticePatron,
} from "@/lib/library/library-notice.service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const schoolId = ctx.schoolId;
    const student = await Student.findOne({
      userId: ctx.userId,
      schoolId,
      status: "active",
    })
      .select("_id classGroupId gradeId")
      .lean();
    if (!student) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Student record not found" } },
        { status: 404 }
      );
    }
    const rawLimit = Number(new URL(req.url).searchParams.get("limit"));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30;
    const notices = await listPublishedLibraryNoticesForPatron(
      schoolId,
      {
        kind: "student",
        classGroupId: student.classGroupId as mongoose.Types.ObjectId,
        gradeId: student.gradeId as mongoose.Types.ObjectId,
      },
      { limit }
    );
    return NextResponse.json({
      success: true,
      data: { items: notices.map(serializeLibraryNoticePatron) },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
