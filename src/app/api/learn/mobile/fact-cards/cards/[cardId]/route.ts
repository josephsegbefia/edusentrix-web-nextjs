import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileFactCardDetail } from "@/lib/learn/mobile-fact-cards";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

type Params = { params: Promise<{ cardId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { cardId } = await params;
  const result = await buildMobileFactCardDetail(auth.context, cardId);
  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
