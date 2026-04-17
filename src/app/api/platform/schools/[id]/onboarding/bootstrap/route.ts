import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, type ISchool } from "@/models/School";
import { getSubjectNamesForCurriculum } from "@/constants/curriculum-subject-templates";
import { getOnboardingTargetSchoolAdmin } from "@/lib/onboarding/target-school-admin";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
  }

  await connectToDatabase();

  const schoolId = new mongoose.Types.ObjectId(id);
  const school = (await School.findById(schoolId).lean()) as ISchool | null;
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const target = await getOnboardingTargetSchoolAdmin(schoolId);
  if (!target) {
    return NextResponse.json(
      {
        error:
          "No school admin user is linked to this school. Create or invite a school admin first.",
      },
      { status: 409 }
    );
  }

  const schoolTypeRaw = school.type;
  const isSecondary = schoolTypeRaw === "SHS";
  const curriculumCode = school.curriculumCode || "ghana_nacca";
  const subjectSuggestions = getSubjectNamesForCurriculum(
    curriculumCode,
    isSecondary ? "SHS" : undefined
  );
  const schoolTypeForClient = isSecondary ? "Secondary" : "Basic";

  return NextResponse.json({
    assistedByPlatform: true,
    targetUserId: String(target._id),
    user: {
      email: target.email,
      firstName: target.firstName ?? "",
      lastName: target.lastName ?? "",
      phone: target.phone ?? "",
      dateOfBirth: target.dateOfBirth
        ? new Date(target.dateOfBirth).toISOString()
        : "",
      address: target.address ?? "",
      avatarUrl: target.avatarUrl ?? "",
      pendingOnboarding: target.pendingOnboarding !== false,
    },
    school: {
      id: String(school._id),
      name: school.name,
      type: schoolTypeForClient,
      curriculumCode,
      address: school.address ?? "",
      city: school.city ?? "",
      region: school.region ?? "",
      bank: school.bank ?? {},
      paymentSetup: {
        status: school.billing?.paymentSetup?.status ?? "not_started",
        ownerName: school.billing?.paymentSetup?.ownerName ?? "",
        ownerEmail: school.billing?.paymentSetup?.ownerEmail ?? "",
      },
      status: school.status,
    },
    subjectSuggestions,
  });
}
