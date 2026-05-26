import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { getTeacherLearnOverview } from "@/lib/learn/teacher-learn-scope";

export async function GET() {
  try {
    const ctx = await requireTeacher();
    await connectToDatabase();
    const data = await getTeacherLearnOverview(ctx);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/overview:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load teacher Learn overview." },
      { status: 500 }
    );
  }
}
