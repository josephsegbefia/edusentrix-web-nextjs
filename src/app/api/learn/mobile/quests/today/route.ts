import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { resolveTodayQuestBoard } from "@/lib/learn/mobile-daily-quest-board";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const result = await resolveTodayQuestBoard(auth.context);

  if (!result.ok) {
    const friendlyMessage =
      result.code === "QUEST_BOARD_UNAVAILABLE"
        ? "Your daily quest will appear after your teacher adds covered lessons."
        : result.message;

    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data, undefined, result.meta);
}
