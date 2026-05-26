import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import {
  loadMobileStudentBundle,
  serializeMobileEntitlement,
} from "@/lib/learn/mobile-student-profile";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request, { allowPasswordChangeOnly: true });
  if (!auth.ok) return auth.response;

  const bundle = await loadMobileStudentBundle({
    studentId: auth.context.studentId,
    schoolId: auth.context.schoolId,
    accountId: auth.context.accountId,
  });

  if (!bundle) {
    return mobileApiFailure({
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    });
  }

  return mobileApiSuccess(serializeMobileEntitlement(bundle));
}
