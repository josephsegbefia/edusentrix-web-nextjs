import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { startMobileAssignment } from "@/lib/learn/mobile-assignments";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { assignmentId } = await params;
  const result = await startMobileAssignment(auth.context, decodeURIComponent(assignmentId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
