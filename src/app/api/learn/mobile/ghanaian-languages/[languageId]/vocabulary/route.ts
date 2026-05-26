import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileGhanaianVocabulary } from "@/lib/learn/mobile-ghanaian-languages";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ languageId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { languageId } = await params;
  const result = await buildMobileGhanaianVocabulary(auth.context, decodeURIComponent(languageId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "Vocabulary is not ready for this language yet.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
