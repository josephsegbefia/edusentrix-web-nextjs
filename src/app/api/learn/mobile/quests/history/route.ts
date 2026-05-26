import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { getMobileDailyQuestHistory } from "@/lib/learn/daily-quest-review";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 14);
    const data = await getMobileDailyQuestHistory(auth.context, Number.isFinite(limit) ? limit : 14);

    return mobileApiSuccess(data);
  } catch (error) {
    console.error("[learn/mobile/quests/history:GET]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Quest history failed to load.",
      friendlyMessage: "Leo could not load your quest history yet. Try again soon.",
      status: 500,
    });
  }
}
