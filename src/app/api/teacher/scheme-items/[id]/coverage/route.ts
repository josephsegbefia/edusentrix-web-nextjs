import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { SchoolSettings } from "@/models/SchoolSettings";
import { serializeSchemeItemRow } from "@/lib/schemes/serializers";
import { teacherMayUpdateSchemeCoverage } from "@/lib/schemes/teacher-scheme-access";

const PatchCoverageSchema = z.object({
  status: z.enum([
    "not_started",
    "in_progress",
    "covered",
    "skipped",
    "moved",
    "needs_review",
  ]),
  coverageNote: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeItemUpdateCoverage)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();

    const settings = await SchoolSettings.findOne({ schoolId: ctx.schoolId })
      .select("academicPlanning")
      .lean();
    if (!(settings?.academicPlanning?.enableSchemeOfWork ?? false)) {
      return Response.json(
        { success: false, error: "Scheme of work is not enabled for this school" },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid item id" }, { status: 400 });
    }

    const parsed = PatchCoverageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = (await SchemeItem.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: ctx.schoolId,
    })) as ISchemeItem | null;
    if (!item) {
      return Response.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    const scheme = (await SchemeOfWork.findById(item.schemeId).lean()) as ISchemeOfWork | null;
    if (!scheme || String(scheme.schoolId) !== String(ctx.schoolId)) {
      return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    }

    if (!teacherMayUpdateSchemeCoverage(scheme, ctx)) {
      return Response.json(
        { success: false, error: "You cannot update coverage for this scheme" },
        { status: 403 }
      );
    }

    item.coverageStatus = parsed.data.status;
    if (parsed.data.coverageNote !== undefined) {
      item.coverageNote = parsed.data.coverageNote;
    }
    item.coverageUpdatedByUserId = ctx.userId;
    item.coverageUpdatedAt = new Date();
    item.updatedByUserId = ctx.userId;
    await item.save();

    return Response.json({ success: true, data: { item: serializeSchemeItemRow(item.toObject()) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update coverage" },
      { status: 500 }
    );
  }
}
