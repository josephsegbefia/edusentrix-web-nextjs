import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { deleteSchemeForSchool, getAdminSchemeDetail } from "@/lib/schemes/scheme-review-service";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdminOrDelegatedAnyPermission([
      PERMISSIONS.schemeOfWorkRead,
      PERMISSIONS.schemeOfWorkReview,
    ]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }
    const result = await getAdminSchemeDetail({
      schoolId: actor.schoolId,
      schemeId: id,
    });
    if ("error" in result && result.error) return result.error;
    return Response.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load scheme" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdminOrDelegatedAnyPermission([PERMISSIONS.schemeOfWorkDelete]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }
    const body = (await req.json().catch(() => ({}))) as { unlinkLessonNotes?: boolean };
    const result = await deleteSchemeForSchool({
      schoolId: actor.schoolId,
      userId: actor.userId,
      schemeId: id,
      unlinkLessonNotes: body.unlinkLessonNotes === true,
    });
    if ("error" in result && result.error) return result.error;
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete scheme" },
      { status: 500 }
    );
  }
}
