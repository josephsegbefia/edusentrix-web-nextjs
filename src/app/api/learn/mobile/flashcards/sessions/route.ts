import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { startMobileFlashcardSession } from "@/lib/learn/mobile-flashcards";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  deckId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const result = await startMobileFlashcardSession(auth.context, body.deckId);

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
        message: "deckId is required.",
        status: 400,
      });
    }
    console.error("[learn/mobile/flashcards/sessions]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Session start failed.", status: 500 });
  }
}
