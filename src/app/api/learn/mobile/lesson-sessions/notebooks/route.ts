import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileLessonNotebooksList } from "@/lib/learn/mobile-lesson-sessions";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const result = await buildMobileLessonNotebooksList(auth.context);
  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
