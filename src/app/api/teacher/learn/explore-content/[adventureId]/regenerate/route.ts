import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { adminRegenerateExploreAdventure } from "@/lib/learn/learn-explore-qa";
import { getTeacherLearnClassIds } from "@/lib/learn/teacher-learn-scope";
import { getLazyExploreDetailForAdminQa } from "@/lib/learn/learn-explore-admin-qa";

const bodySchema = z
  .object({
    mode: z.enum(["recommended", "go_deeper", "mistake_buster", "challenge"]).optional(),
  })
  .optional();

export async function POST(
  request: Request,
  ctx: { params: Promise<{ adventureId: string }> }
) {
  try {
    const teacher = await requireTeacher();
    await connectToDatabase();
    const { adventureId } = await ctx.params;
    const classGroupIds = await getTeacherLearnClassIds(teacher);

    const existing = await getLazyExploreDetailForAdminQa(teacher.schoolId, adventureId, {
      classGroupIds,
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Explore adventure not found in your classes." },
        { status: 404 }
      );
    }

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid regenerate request." },
        { status: 400 }
      );
    }

    const result = await adminRegenerateExploreAdventure({
      schoolId: teacher.schoolId,
      reviewerId: teacher.userId,
      adventureId,
      mode: parsed.data?.mode,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/explore-content/[adventureId]/regenerate:POST]", error);
    const message =
      error instanceof Error ? error.message : "Failed to regenerate Explore content.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
