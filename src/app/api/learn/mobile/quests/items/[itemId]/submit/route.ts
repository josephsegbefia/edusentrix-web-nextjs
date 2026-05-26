import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { submitQuestItem } from "@/lib/learn/mobile-daily-quest-board";

const BodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      optionId: z.string().min(1),
    })
  ),
  elapsedSeconds: z.number().int().min(0).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const { itemId } = await params;
    const result = await submitQuestItem({
      context: auth.context,
      itemId: decodeURIComponent(itemId),
      answers: body.answers,
      elapsedSeconds: body.elapsedSeconds,
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
        message: "Invalid quest submission.",
        friendlyMessage: "Please answer the quiz questions and try again.",
        status: 400,
        details: error.flatten(),
      });
    }

    console.error("[learn/mobile/quests/items/submit]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Quest item submission failed.",
      status: 500,
    });
  }
}
