import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { getExploreContentDetailForQa } from "@/lib/learn/learn-explore-qa";
import { getTeacherLearnClassIds } from "@/lib/learn/teacher-learn-scope";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ adventureId: string }> }
) {
  try {
    const teacher = await requireTeacher();
    await connectToDatabase();
    const { adventureId } = await ctx.params;
    const classGroupIds = await getTeacherLearnClassIds(teacher);

    const data = await getExploreContentDetailForQa(teacher.schoolId, adventureId, {
      classGroupIds,
    });

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Explore adventure not found in your classes." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/explore-content/[adventureId]:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Explore adventure." },
      { status: 500 }
    );
  }
}
