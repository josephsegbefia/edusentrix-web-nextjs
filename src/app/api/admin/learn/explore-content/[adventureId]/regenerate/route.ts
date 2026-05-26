import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { adminRegenerateExploreAdventure } from "@/lib/learn/learn-explore-qa";

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
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { adventureId } = await ctx.params;

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid regenerate request." },
        { status: 400 }
      );
    }

    const result = await adminRegenerateExploreAdventure({
      schoolId: admin.schoolId,
      reviewerId: admin.userId,
      adventureId,
      mode: parsed.data?.mode,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/explore-content/[adventureId]/regenerate:POST]", error);
    const message =
      error instanceof Error ? error.message : "Failed to regenerate Explore content.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
