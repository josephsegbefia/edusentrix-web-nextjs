import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileLessonNotebookDetail } from "@/lib/learn/mobile-lesson-sessions";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { sessionId } = await params;
  const result = await buildMobileLessonNotebookDetail(auth.context, sessionId);
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
