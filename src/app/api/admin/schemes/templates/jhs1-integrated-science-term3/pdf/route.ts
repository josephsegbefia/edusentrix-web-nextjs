import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { School } from "@/models/School";
import { generateJhs1IntegratedScienceTerm3SchemePdf } from "@/lib/schemes/generate-scheme-of-learning-pdf";

/**
 * GET /api/admin/schemes/templates/jhs1-integrated-science-term3/pdf
 * Download JHS 1 Integrated Science Term 3 scheme aligned to the school's current academic period.
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

    const pdf = await generateJhs1IntegratedScienceTerm3SchemePdf({
      schoolName: school?.name || "School",
      academicPeriodLabel: `${period.yearLabel} ${period.term}`,
      period: { startDate: period.startDate, endDate: period.endDate },
    });

    return new NextResponse(pdf.bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to generate JHS1 science scheme PDF:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate scheme PDF",
      },
      { status: 500 }
    );
  }
}
