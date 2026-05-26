import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { reviewMobileFlashcard } from "@/lib/learn/mobile-flashcards";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  rating: z.enum(["known", "needs_practice", "learning", "new"]),
  elapsedSeconds: z.number().int().min(5).max(3600).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const { cardId } = await params;

    const result = await reviewMobileFlashcard(
      auth.context,
      decodeURIComponent(cardId),
      body.rating,
      body.elapsedSeconds
    );

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid review rating.",
        status: 400,
      });
    }
    console.error("[learn/mobile/flashcards/review]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Review failed.", status: 500 });
  }
}
