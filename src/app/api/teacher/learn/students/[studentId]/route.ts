import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { getTeacherLearnStudentDetail } from "@/lib/learn/teacher-learn-scope";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await ctx.params;
    if (!Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student id." },
        { status: 400 }
      );
    }
    const teacher = await requireTeacher();
    await connectToDatabase();
    const data = await getTeacherLearnStudentDetail(
      teacher,
      new Types.ObjectId(studentId)
    );
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Student not found in your teaching scope." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/students/[studentId]:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load student Learn activity." },
      { status: 500 }
    );
  }
}
