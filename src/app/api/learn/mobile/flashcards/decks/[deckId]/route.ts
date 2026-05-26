import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileFlashcardDeckDetail } from "@/lib/learn/mobile-flashcards";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { deckId } = await params;
  const result = await buildMobileFlashcardDeckDetail(auth.context, decodeURIComponent(deckId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "We could not find this flashcard deck.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
