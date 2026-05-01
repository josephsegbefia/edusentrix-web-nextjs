import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { SchoolSettings } from "@/models/SchoolSettings";
import { serializeSchemeRow } from "@/lib/schemes/serializers";
import { summarizeSchemeItemCoverage } from "@/lib/schemes/coverage-aggregate";
import { teacherMayViewScheme } from "@/lib/schemes/teacher-scheme-access";

export async function GET(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeOfWorkRead)) {
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

    const { searchParams } = new URL(req.url);
    const schemeIdParam = searchParams.get("schemeId");

    if (schemeIdParam) {
      if (!mongoose.Types.ObjectId.isValid(schemeIdParam)) {
        return Response.json({ success: false, error: "Invalid schemeId" }, { status: 400 });
      }
      const schemeOid = new mongoose.Types.ObjectId(schemeIdParam);
      const scheme = (await SchemeOfWork.findOne({
        _id: schemeOid,
        schoolId: ctx.schoolId,
      }).lean()) as ISchemeOfWork | null;

      if (!scheme) {
        return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
      }
      if (!teacherMayViewScheme(scheme, ctx.teacherId)) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }

      const items = (await SchemeItem.find({ schoolId: ctx.schoolId, schemeId: schemeOid }).lean()) as
        | ISchemeItem[]
        | [];

      return Response.json({
        success: true,
        data: {
          scheme: serializeSchemeRow(scheme),
          summary: summarizeSchemeItemCoverage(items),
        },
      });
    }

    const schemes = (await SchemeOfWork.find({
      schoolId: ctx.schoolId,
      status: { $in: ["approved", "active"] },
    })
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean()) as ISchemeOfWork[];

    const rows = await Promise.all(
      schemes.map(async (scheme) => {
        const items = (await SchemeItem.find({
          schoolId: ctx.schoolId,
          schemeId: scheme._id,
        }).lean()) as ISchemeItem[];
        return {
          scheme: serializeSchemeRow(scheme),
          summary: summarizeSchemeItemCoverage(items),
        };
      })
    );

    return Response.json({ success: true, data: { schemes: rows } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load coverage" },
      { status: 500 }
    );
  }
}
