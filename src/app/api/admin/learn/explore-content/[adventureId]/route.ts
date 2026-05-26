import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { getExploreContentDetailForQa } from "@/lib/learn/learn-explore-qa";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ adventureId: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { adventureId } = await ctx.params;

    const data = await getExploreContentDetailForQa(admin.schoolId, adventureId);
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Explore adventure not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/explore-content/[adventureId]:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Explore adventure." },
      { status: 500 }
    );
  }
}
