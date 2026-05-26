import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { startMobileRevisionSession } from "@/lib/learn/mobile-revision";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  topicId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const result = await startMobileRevisionSession(auth.context, body.topicId);

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage: "This revision sprint is not ready yet.",
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "topicId is required.",
        status: 400,
      });
    }
    console.error("[learn/mobile/revision/sessions]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Session start failed.", status: 500 });
  }
}
