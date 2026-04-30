import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import {
  listPublishedLibraryNoticesForPatron,
  serializeLibraryNoticePatron,
} from "@/lib/library/library-notice.service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const wardIds = await getParentWardIds(ctx.userId);
    if (wardIds.length === 0) {
      return NextResponse.json({ success: true, data: { items: [] } });
    }
    const students = await Student.find({
      _id: { $in: wardIds },
      schoolId: ctx.schoolId,
      status: "active",
    })
      .select("classGroupId gradeId")
      .lean();
    const wardClassGroupIds = students.map((s) => s.classGroupId as mongoose.Types.ObjectId);
    const wardGradeIds = students.map((s) => s.gradeId as mongoose.Types.ObjectId);
    const rawLimit = Number(new URL(req.url).searchParams.get("limit"));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30;
    const notices = await listPublishedLibraryNoticesForPatron(
      ctx.schoolId,
      {
        kind: "parent",
        wardClassGroupIds,
        wardGradeIds,
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
