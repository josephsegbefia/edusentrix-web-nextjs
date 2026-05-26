import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { applyTeacherExploreAdminReview } from "@/lib/learn/learn-explore-qa";
import { getTeacherLearnClassIds } from "@/lib/learn/teacher-learn-scope";
import { getLazyExploreDetailForAdminQa } from "@/lib/learn/learn-explore-admin-qa";

const bodySchema = z.object({
  action: z.enum(["approve", "mark_reviewed", "hide", "request_changes"]),
  notes: z.string().trim().max(500).optional(),
});

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

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid review action." },
        { status: 400 }
      );
    }

    const data = await applyTeacherExploreAdminReview({
      schoolId: teacher.schoolId,
      reviewerId: teacher.userId,
      adventureId,
      action: parsed.data.action,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[teacher/learn/explore-content/[adventureId]/review:POST]", error);
    const message =
      error instanceof Error ? error.message : "Failed to update Explore review.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
