import { NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, type ISchool } from "@/models/School";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { getCurriculumProfile, type CurriculumCode } from "@/constants/curriculum-profiles";
import { getReportTemplatePreset } from "@/constants/curriculum-report-templates";
import { buildCambridgeCurriculumSnapshotCsv } from "@/lib/curriculum/build-curriculum-snapshot-csv";
import { isCambridgeLighthouseExportFeatureEnabled } from "@/lib/curriculum/cambridge-lighthouse";

export const runtime = "nodejs";

/**
 * GET — CSV snapshot of Cambridge curriculum profile + school academic periods.
 * Gated: school.curriculumCode === "cambridge" AND FEATURE_CAMBRIDGE_LIGHTHOUSE_EXPORT=true.
 * Does not modify data; safe for existing curriculum flows.
 */
export async function GET() {
  try {
    if (!isCambridgeLighthouseExportFeatureEnabled()) {
      return NextResponse.json(
        { success: false, error: "Curriculum snapshot export is not enabled." },
        { status: 403 }
      );
    }

    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "reports.export",
    ]);
    await connectToDatabase();

    const school = (await School.findById(schoolId)
      .select("name curriculumCode")
      .lean()) as Pick<ISchool, "name" | "curriculumCode"> | null;

    if (!school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }

    const code = (school.curriculumCode || "ghana_nacca") as CurriculumCode;
    if (code !== "cambridge") {
      return NextResponse.json(
        {
          success: false,
          error: "Curriculum snapshot export is only available for Cambridge schools.",
        },
        { status: 403 }
      );
    }

    const profile = getCurriculumProfile("cambridge");
    const preset = getReportTemplatePreset("cambridge");

    const periods = await AcademicPeriod.find({ schoolId })
      .select("yearLabel term startDate endDate isCurrent")
      .sort({ startDate: 1 })
      .lean();

    const periodRows = periods.map((p) => ({
      id: String(p._id),
      yearLabel: String(p.yearLabel || ""),
      term: String(p.term || ""),
      startDate: new Date(p.startDate).toISOString(),
      endDate: new Date(p.endDate).toISOString(),
      isCurrent: Boolean(p.isCurrent),
    }));

    const csv = buildCambridgeCurriculumSnapshotCsv({
      schoolName: school.name || "School",
      schoolId: String(schoolId),
      exportGeneratedAtIso: new Date().toISOString(),
      profile,
      reportCardPresetName: preset.name,
      periods: periodRows,
    });

    const safeName = (school.name || "school")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 48);
    const fileName = `cambridge-curriculum-snapshot-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("curriculum-snapshot export failed:", e);
    return NextResponse.json(
      { success: false, error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
