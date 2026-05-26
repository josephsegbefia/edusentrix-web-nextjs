import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { removeMobileOfflinePack } from "@/lib/learn/mobile-offline";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ packId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { packId } = await params;
  const result = await removeMobileOfflinePack(auth.context, decodeURIComponent(packId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
