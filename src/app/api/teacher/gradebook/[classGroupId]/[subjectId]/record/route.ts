import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { legacyGradebookDeprecatedResponse } from "@/lib/academics/legacy-gradebook-deprecation";

/** @deprecated Use assessment item + score APIs under /api/teacher/marks/ */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ classGroupId: string; subjectId: string }> }
) {
  try {
    const context = await requireTeacher();
    if (!can(context.permissions, PERMISSIONS.gradebookRecord)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { classGroupId, subjectId } = await ctx.params;
    return legacyGradebookDeprecatedResponse({
      classGroupId,
      subjectId,
      action: "record marks",
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Legacy gradebook record rejected:", error);
    return Response.json(
      { success: false, error: "Legacy gradebook is retired" },
      { status: 410 }
    );
  }
}
