import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileAssignmentDetail } from "@/lib/learn/mobile-assignments";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { assignmentId } = await params;
  const result = await buildMobileAssignmentDetail(auth.context, decodeURIComponent(assignmentId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "We could not find that assignment.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
