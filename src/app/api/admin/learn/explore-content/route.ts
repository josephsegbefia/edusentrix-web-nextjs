import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { listSchoolExploreContentForQa } from "@/lib/learn/learn-explore-qa";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const data = await listSchoolExploreContentForQa(ctx.schoolId, {
      classGroupId: searchParams.get("classGroupId") || undefined,
      studentId: searchParams.get("studentId") || undefined,
      limit: Number(searchParams.get("limit") || "40"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/explore-content:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Explore content for review." },
      { status: 500 }
    );
  }
}
