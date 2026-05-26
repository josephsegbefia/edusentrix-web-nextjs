import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { startQuestItem } from "@/lib/learn/mobile-daily-quest-board";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { itemId } = await params;
  const result = await startQuestItem(auth.context, decodeURIComponent(itemId));

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
