import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { revokeLearnMobileSession } from "@/lib/learn/mobile-session";

export async function POST(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request, { allowPasswordChangeOnly: true });
  if (!auth.ok) return auth.response;

  await revokeLearnMobileSession(auth.context.sessionId);

  return mobileApiSuccess({ signedOut: true as const });
}
