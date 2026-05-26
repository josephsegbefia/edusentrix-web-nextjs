import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { getTeacherDailyQuestReview } from "@/lib/learn/daily-quest-review";

export async function GET(request: NextRequest) {
  try {
    const teacher = await requireTeacher();
    await connectToDatabase();

    const days = Number(request.nextUrl.searchParams.get("days") ?? 14);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    const data = await getTeacherDailyQuestReview(teacher, {
      classGroupId: request.nextUrl.searchParams.get("classGroupId"),
      days: Number.isFinite(days) ? days : 14,
      limit: Number.isFinite(limit) ? limit : 20,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/daily-quest/review:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Daily Quest review." },
      { status: 500 }
    );
  }
}
