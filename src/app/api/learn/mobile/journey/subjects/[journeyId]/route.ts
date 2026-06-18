import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { loadSubjectJourneyDetail } from "@/lib/learn/todays-journey/load-subject-journey";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const { journeyId } = await params;
    const result = await loadSubjectJourneyDetail(auth.context, decodeURIComponent(journeyId));

    if (!result.ok) {
      const friendlyMessage =
        result.code === "JOURNEY_NOT_FOUND"
          ? "We could not find that subject journey."
          : result.message;

      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    console.error("[journey/subjects/detail]", error);
    return mobileApiFailure({
      code: "JOURNEY_DETAIL_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Subject journey unavailable.",
      friendlyMessage: "We could not open this subject journey right now.",
      status: 500,
    });
  }
}
