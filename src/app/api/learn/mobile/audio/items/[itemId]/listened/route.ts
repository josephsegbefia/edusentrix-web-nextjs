import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { markMobileAudioListened } from "@/lib/learn/mobile-audio";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { itemId } = await params;
  const result = await markMobileAudioListened(auth.context, decodeURIComponent(itemId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
