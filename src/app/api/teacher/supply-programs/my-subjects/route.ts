import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";

export async function GET() {
  try {
    const ctx = await requireTeacher({ mode: "api" });
    await connectToDatabase();

    const teacher = await Teacher.findOne({
      _id: ctx.teacherId,
      schoolId: ctx.schoolId,
    })
      .select("subjectIds")
      .lean();

    const ids = (teacher?.subjectIds || []) as mongoose.Types.ObjectId[];
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const subjects = await Subject.find({
      _id: { $in: ids },
      schoolId: ctx.schoolId,
      isActive: true,
    })
      .select("name code")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: subjects.map((s) => ({
        id: String(s._id),
        name: s.name,
        code: s.code || "",
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to load subjects" },
      { status: 500 }
    );
  }
}
