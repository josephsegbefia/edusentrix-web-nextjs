import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileExamPrepPrimary } from "@/lib/learn/mobile-exam-prep";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const result = await buildMobileExamPrepPrimary(auth.context);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "NO_EXAM_PREP_AVAILABLE"
          ? "Your exam prep plan will appear when your school adds upcoming tests."
          : result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
