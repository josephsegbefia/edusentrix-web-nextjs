import { connectToDatabase } from "@/db/connectToDatabase";
import { can } from "@/lib/auth/can";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import {
  deleteSectionAction,
  patchSectionAction,
} from "@/lib/examinations/builder-route-actions";
import { parseBuilderId } from "@/lib/examinations/builder-service";
import { PERMISSIONS } from "@/lib/rbac";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.examsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { sectionId } = await params;
    const parsedSectionId = parseBuilderId(sectionId);
    if (!parsedSectionId) {
      return Response.json({ success: false, error: "Invalid section id" }, { status: 400 });
    }
    const result = await patchSectionAction(
      req,
      { schoolId: ctx.schoolId, userId: ctx.userId, teacherContext: ctx },
      parsedSectionId
    );
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update section" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.examsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { sectionId } = await params;
    const parsedSectionId = parseBuilderId(sectionId);
    if (!parsedSectionId) {
      return Response.json({ success: false, error: "Invalid section id" }, { status: 400 });
    }
    const result = await deleteSectionAction(
      { schoolId: ctx.schoolId, userId: ctx.userId, teacherContext: ctx },
      parsedSectionId
    );
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete section" },
      { status: 500 }
    );
  }
}
