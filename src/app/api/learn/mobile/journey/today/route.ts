import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { generateTodaysJourney } from "@/lib/learn/todays-journey";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await generateTodaysJourney(auth.context);

    if (!result.ok) {
      const friendlyMessage =
        result.code === "LEARN_ACCESS_REQUIRED" || result.code === "SCHOOL_NOT_ELIGIBLE"
          ? "EduSentrix Learn is available for Premium schools with active student access."
          : result.code === "NO_STUDENT_PROFILE"
            ? "We could not find your student profile yet."
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
    console.error("[journey/today]", error);
    return mobileApiFailure({
      code: "JOURNEY_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Today's Journey unavailable.",
      friendlyMessage: "We could not prepare today's journey right now. Please try again.",
      status: 500,
    });
  }
}
