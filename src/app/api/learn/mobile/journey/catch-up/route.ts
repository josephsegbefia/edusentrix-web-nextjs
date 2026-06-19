import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { buildCatchUpVault } from "@/lib/learn/todays-journey/catch-up";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await buildCatchUpVault(auth.context);

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
    console.error("[journey/catch-up]", error);
    return mobileApiFailure({
      code: "CATCH_UP_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Catch-up vault unavailable.",
      friendlyMessage: "We could not open your Catch-up Vault right now.",
      status: 500,
    });
  }
}
