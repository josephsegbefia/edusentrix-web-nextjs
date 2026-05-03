import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { archiveSchemeForSchool } from "@/lib/schemes/scheme-review-service";

const BodySchema = z.object({
  note: z.string().trim().max(5000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdminOrDelegatedAnyPermission([PERMISSIONS.schemeOfWorkArchive]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ success: false, error: "Validation failed" }, { status: 400 });

    const result = await archiveSchemeForSchool({
      schoolId: actor.schoolId,
      userId: actor.userId,
      schemeId: id,
      note: parsed.data.note,
    });
    if ("error" in result && result.error) return result.error;
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to archive scheme" },
      { status: 500 }
    );
  }
}
