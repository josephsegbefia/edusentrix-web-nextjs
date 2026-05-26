import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileExamPrepDetail } from "@/lib/learn/mobile-exam-prep";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { examId } = await params;
  const result = await buildMobileExamPrepDetail(auth.context, decodeURIComponent(examId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "We could not find this exam prep plan.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
