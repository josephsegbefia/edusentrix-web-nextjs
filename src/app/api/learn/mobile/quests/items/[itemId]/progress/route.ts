import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { updateQuestItemProgress } from "@/lib/learn/mobile-daily-quest-board";

const BodySchema = z.object({
  progressPercent: z.number().min(0).max(100),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const { itemId } = await params;
    const result = await updateQuestItemProgress({
      context: auth.context,
      itemId: decodeURIComponent(itemId),
      progressPercent: body.progressPercent,
    });

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
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid quest progress.",
        friendlyMessage: "Please try that step again.",
        status: 400,
        details: error.flatten(),
      });
    }

    console.error("[learn/mobile/quests/items/progress]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Quest progress update failed.",
      status: 500,
    });
  }
}
