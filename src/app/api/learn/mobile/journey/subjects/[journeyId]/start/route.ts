import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { startSubjectJourney } from "@/lib/learn/todays-journey/update-journey-step";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const { journeyId } = await params;
    const result = await startSubjectJourney(auth.context, decodeURIComponent(journeyId));

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage: result.message,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    console.error("[journey/subjects/start]", error);
    return mobileApiFailure({
      code: "JOURNEY_START_FAILED",
      message: error instanceof Error ? error.message : "Could not start journey.",
      friendlyMessage: "We could not start this journey right now.",
      status: 500,
    });
  }
}
