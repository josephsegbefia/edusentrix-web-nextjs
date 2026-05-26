import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { listTeacherExploreContentForQa } from "@/lib/learn/learn-explore-qa";

export async function GET(request: NextRequest) {
  try {
    const teacher = await requireTeacher();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const data = await listTeacherExploreContentForQa(teacher, {
      classGroupId: searchParams.get("classGroupId") || undefined,
      studentId: searchParams.get("studentId") || undefined,
      limit: Number(searchParams.get("limit") || "40"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/explore-content:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Explore content for review." },
      { status: 500 }
    );
  }
}
