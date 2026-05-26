import { NextRequest } from "next/server";

import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { getParentExploreSummaryForStudent } from "@/lib/learn/explore/explore-parent-summary";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

/**
 * Student-authenticated preview of the parent-safe summary for their own mission.
 * Parents should use GET /api/parent/learn/wards/:studentId/explore/:adventureId/summary
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ adventureId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { adventureId } = await ctx.params;

  const result = await getParentExploreSummaryForStudent({
    schoolId: auth.context.schoolId,
    studentId: auth.context.studentId,
    adventureId,
  });

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: result.friendlyMessage,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
