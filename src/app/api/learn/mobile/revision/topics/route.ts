import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileRevisionTopicsList } from "@/lib/learn/mobile-revision";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const result = await buildMobileRevisionTopicsList(auth.context);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "NO_STUDENT_PROFILE"
          ? "We could not find your student profile yet."
          : result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
