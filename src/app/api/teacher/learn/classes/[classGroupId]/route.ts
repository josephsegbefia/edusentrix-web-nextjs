import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { getTeacherLearnClassDetail } from "@/lib/learn/teacher-learn-scope";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ classGroupId: string }> }
) {
  try {
    const { classGroupId } = await ctx.params;
    if (!Types.ObjectId.isValid(classGroupId)) {
      return NextResponse.json(
        { success: false, error: "Invalid class group id." },
        { status: 400 }
      );
    }
    const teacher = await requireTeacher();
    await connectToDatabase();
    const data = await getTeacherLearnClassDetail(
      teacher,
      new Types.ObjectId(classGroupId)
    );
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Class group not found in your teaching scope." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/classes/[classGroupId]:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load class Learn activity." },
      { status: 500 }
    );
  }
}
