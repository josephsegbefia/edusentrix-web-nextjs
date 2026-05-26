import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileGhanaianLanguageDetail } from "@/lib/learn/mobile-ghanaian-languages";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ languageId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { languageId } = await params;
  const result = await buildMobileGhanaianLanguageDetail(auth.context, decodeURIComponent(languageId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "Leo could not find that language practice yet.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
