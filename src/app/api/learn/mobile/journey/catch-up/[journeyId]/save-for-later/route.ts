import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { saveJourneyForLater } from "@/lib/learn/todays-journey/catch-up";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const { journeyId } = await params;
    const result = await saveJourneyForLater(auth.context, decodeURIComponent(journeyId));

    if (!result.ok) {
      const friendlyMessage =
        result.code === "JOURNEY_NOT_FOUND"
          ? "We could not find that saved journey."
          : result.code === "JOURNEY_NOT_SAVEABLE"
            ? "This journey is already finished."
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
    console.error("[journey/catch-up/save-for-later]", error);
    return mobileApiFailure({
      code: "SAVE_FOR_LATER_FAILED",
      message: error instanceof Error ? error.message : "Could not save journey.",
      friendlyMessage: "We could not save that journey for later right now.",
      status: 500,
    });
  }
}
