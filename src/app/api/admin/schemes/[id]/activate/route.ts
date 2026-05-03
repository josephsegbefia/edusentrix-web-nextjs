import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { activateSchemeForSchool } from "@/lib/schemes/scheme-review-service";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdminOrDelegatedAnyPermission([PERMISSIONS.schemeOfWorkActivate]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }

    const result = await activateSchemeForSchool({
      schoolId: actor.schoolId,
      userId: actor.userId,
      schemeId: id,
    });
    if ("error" in result && result.error) return result.error;
    return Response.json({ success: true, data: { noop: "noop" in result ? result.noop : false } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to activate scheme" },
      { status: 500 }
    );
  }
}
