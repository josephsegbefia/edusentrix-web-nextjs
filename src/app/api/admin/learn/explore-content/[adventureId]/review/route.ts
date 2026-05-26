import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { applySchoolExploreAdminReview } from "@/lib/learn/learn-explore-qa";

const bodySchema = z.object({
  action: z.enum(["approve", "mark_reviewed", "hide", "request_changes"]),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ adventureId: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { adventureId } = await ctx.params;

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid review action." },
        { status: 400 }
      );
    }

    const data = await applySchoolExploreAdminReview({
      schoolId: admin.schoolId,
      reviewerId: admin.userId,
      adventureId,
      action: parsed.data.action,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/explore-content/[adventureId]/review:POST]", error);
    const message =
      error instanceof Error ? error.message : "Failed to update Explore review.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
