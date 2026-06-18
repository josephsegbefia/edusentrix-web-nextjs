import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { getExploreContentDetailForQa, updateTeacherExploreContent } from "@/lib/learn/learn-explore-qa";
import { getTeacherLearnClassIds } from "@/lib/learn/teacher-learn-scope";
import { guidedAdventureContentV2Schema } from "@/lib/learn/explore/explore-schemas";

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

const patchBodySchema = z.object({
  content: guidedAdventureContentV2Schema,
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ adventureId: string }> }
) {
  try {
    const teacher = await requireTeacher();
    await connectToDatabase();
    const { adventureId } = await ctx.params;

    const json = await request.json().catch(() => null);
    const parsed = patchBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid Explore content." },
        { status: 400 }
      );
    }

    const data = await updateTeacherExploreContent(
      teacher,
      adventureId,
      parsed.data.content
    );

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Explore adventure not found in your classes." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/explore-content/[adventureId]:PATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to save Explore content.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
