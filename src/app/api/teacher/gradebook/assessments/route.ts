import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { legacyGradebookDeprecatedResponse } from "@/lib/academics/legacy-gradebook-deprecation";

/** @deprecated Assessment types come from the active assessment plan and grading policy. */
export async function GET() {
  try {
    const context = await requireTeacher();
    if (!can(context.permissions, PERMISSIONS.gradebookView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return legacyGradebookDeprecatedResponse({ action: "list assessment types" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Legacy gradebook assessments meta rejected:", error);
    return Response.json(
      { success: false, error: "Legacy gradebook is retired" },
      { status: 410 }
    );
  }
}
