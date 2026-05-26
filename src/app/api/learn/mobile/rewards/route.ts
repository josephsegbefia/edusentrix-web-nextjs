import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileRewards } from "@/lib/learn/mobile-rewards";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const result = await buildMobileRewards(auth.context);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
