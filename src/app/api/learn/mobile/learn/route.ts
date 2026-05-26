import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileLearn } from "@/lib/learn/mobile-learn";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const result = await buildMobileLearn(auth.context);

    if (!result.ok) {
      const friendlyMessage =
        result.code === "NO_COVERED_LESSONS"
          ? "Your learning path will appear after your teacher adds covered lessons."
          : result.message;

      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data, undefined, result.meta);
  } catch (error) {
    console.error("[learn/mobile/learn:GET]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Learn overview failed.",
      friendlyMessage: "We could not load your learning plan. Pull to refresh and try again.",
      status: 500,
    });
  }
}
