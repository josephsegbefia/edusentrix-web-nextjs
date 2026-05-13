import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { setupSubjectOfferingsFromCurriculum } from "@/lib/subject-offerings/setup";
import type { CurriculumCode } from "@/models/SubjectOffering";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();

    const body = await req.json();
    const selectedOfferingCodes = Array.isArray(body.selectedOfferingCodes)
      ? body.selectedOfferingCodes.filter((code: unknown) => typeof code === "string")
      : [];
    const gradeIds = Array.isArray(body.gradeIds)
      ? body.gradeIds.filter((id: unknown) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id))
      : [];
    const curriculumCode = String(body.curriculumCode || "ghana_nacca") as CurriculumCode;

    if (selectedOfferingCodes.length === 0) {
      return NextResponse.json({ success: false, error: "Select at least one offering" }, { status: 400 });
    }
    if (gradeIds.length === 0) {
      return NextResponse.json({ success: false, error: "Select at least one grade" }, { status: 400 });
    }

    const result = await setupSubjectOfferingsFromCurriculum({
      schoolId: String(schoolId),
      curriculumCode,
      selectedOfferingCodes,
      gradeIds,
      autoAssignToMatchingClassGroups: body.autoAssignToMatchingClassGroups !== false,
      schoolType: typeof body.schoolType === "string" ? body.schoolType : undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to set up subject offerings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
