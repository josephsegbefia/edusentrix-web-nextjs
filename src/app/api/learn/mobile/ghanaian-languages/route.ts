import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileGhanaianLanguagesList } from "@/lib/learn/mobile-ghanaian-languages";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const result = await buildMobileGhanaianLanguagesList(auth.context);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "NO_LANGUAGE_SELECTED"
          ? "Your Ghanaian language practice will appear after your school selects the taught language."
          : result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
