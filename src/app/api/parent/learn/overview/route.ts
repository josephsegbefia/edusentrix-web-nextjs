import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { getParentLearnOverview } from "@/lib/learn/parent-learn-overview";

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();

    const data = await getParentLearnOverview(ctx.schoolId, ctx.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/overview:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load EduSentrix Learn." },
      { status: 500 }
    );
  }
}
