import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { School } from "@/models/School";
import {
  alignSchemeRowsToAcademicPeriod,
  generateSchemeImportCsvFromAlignedRows,
} from "@/lib/schemes/generate-scheme-of-learning-pdf";
import { JHS1_INTEGRATED_SCIENCE_TERM3_TEMPLATE } from "@/lib/schemes/templates/jhs1-integrated-science-term3";

/**
 * GET /api/admin/schemes/templates/jhs1-integrated-science-term3/csv
 * Download import-ready CSV for the JHS 1 Integrated Science Term 3 template.
 */
export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      PERMISSIONS.schemeOfWorkRead,
      PERMISSIONS.schemeImportUpload,
    ]);
    await connectToDatabase();

    const [school, period] = await Promise.all([
      School.findById(schoolId).select("name").lean<{ name?: string } | null>(),
      AcademicPeriod.findOne({ schoolId, isCurrent: true })
        .select("yearLabel term startDate endDate")
        .lean<{
          yearLabel: string;
          term: string;
          startDate: Date;
          endDate: Date;
        } | null>(),
    ]);

    if (!period) {
      return NextResponse.json(
        { success: false, error: "No current academic period is configured for this school." },
        { status: 400 }
      );
    }

    const alignedRows = alignSchemeRowsToAcademicPeriod(
      JHS1_INTEGRATED_SCIENCE_TERM3_TEMPLATE.rows,
      { startDate: period.startDate, endDate: period.endDate }
    );
    const csv = generateSchemeImportCsvFromAlignedRows(alignedRows);
    const academicPeriodLabel = `${period.yearLabel} ${period.term}`;
    const fileName = `JHS1_Integrated_Science_${academicPeriodLabel.replace(/[^\w]+/g, "_")}_Scheme.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to generate JHS1 science scheme CSV:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate scheme CSV",
      },
      { status: 500 }
    );
  }
}
