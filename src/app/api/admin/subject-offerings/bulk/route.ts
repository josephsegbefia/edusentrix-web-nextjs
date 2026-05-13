import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { setupSubjectOfferingsFromCurriculum } from "@/lib/subject-offerings/setup";
import type { CurriculumCode } from "@/models/SubjectOffering";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();
    const body = await req.json();

    const result = await setupSubjectOfferingsFromCurriculum({
      schoolId: String(schoolId),
      curriculumCode: String(body.curriculumCode || "ghana_nacca") as CurriculumCode,
      selectedOfferingCodes: Array.isArray(body.selectedOfferingCodes) ? body.selectedOfferingCodes : [],
      gradeIds: Array.isArray(body.gradeIds) ? body.gradeIds : [],
      autoAssignToMatchingClassGroups: body.autoAssignToMatchingClassGroups !== false,
      schoolType: typeof body.schoolType === "string" ? body.schoolType : undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to bulk create subject offerings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
