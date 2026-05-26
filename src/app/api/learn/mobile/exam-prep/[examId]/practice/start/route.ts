import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { startMobileExamPractice } from "@/lib/learn/mobile-exam-prep";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const auth = await requireLearnMobileStudent(_request);
  if (!auth.ok) return auth.response;

  const { examId } = await params;
  const result = await startMobileExamPractice(auth.context, decodeURIComponent(examId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "Timed practice is not ready yet.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
