import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { listLazyExploreRecords } from "@/lib/learn/explore/explore-mobile.service";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  if (!USE_LAZY_EXPLORE) {
    return mobileApiSuccess({
      studentId: String(auth.context.studentId),
      records: [],
    });
  }

  const result = await listLazyExploreRecords(auth.context);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "NO_STUDENT_PROFILE"
          ? "Your Explore records will appear after your profile is ready."
          : result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
