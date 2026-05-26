import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { listMobileTutorConversations } from "@/lib/learn/mobile-tutor";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const result = await listMobileTutorConversations(auth.context);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "AI_LIMIT_REACHED"
          ? "You have used today's AI tutor limit. Try again later."
          : result.code === "NO_APPROVED_CONTENT"
            ? "Your tutor will appear after your teacher adds covered lessons."
            : result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
