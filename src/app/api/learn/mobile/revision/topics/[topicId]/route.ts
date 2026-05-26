import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileRevisionTopicDetail } from "@/lib/learn/mobile-revision";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { topicId } = await params;
  const result = await buildMobileRevisionTopicDetail(auth.context, decodeURIComponent(topicId));

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "We could not find that revision topic.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
