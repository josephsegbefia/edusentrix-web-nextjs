import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { reviewSchemeDecision } from "@/lib/schemes/scheme-review-service";

const ReviewSchema = z.object({
  decision: z.enum(["approved", "needs_revision", "rejected"]),
  note: z.string().trim().max(5000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdminOrDelegatedAnyPermission([
      PERMISSIONS.schemeOfWorkReview,
      PERMISSIONS.schemeOfWorkApprove,
    ]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }

    const parsed = ReviewSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed" }, { status: 400 });
    }

    const result = await reviewSchemeDecision({
      schoolId: actor.schoolId,
      userId: actor.userId,
      schemeId: id,
      decision: parsed.data.decision,
      note: parsed.data.note,
      actorRole: actor.isSchoolAdmin ? "school_admin" : "delegate",
    });
    if ("error" in result && result.error) return result.error;
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to review scheme" },
      { status: 500 }
    );
  }
}
