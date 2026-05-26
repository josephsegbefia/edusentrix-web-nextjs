import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { handleMobileTutorModeAction } from "@/lib/learn/mobile-tutor";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  message: z.string().optional(),
  conversationId: z.string().optional(),
  lessonId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const result = await handleMobileTutorModeAction(auth.context, "explain", body);

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({ code: "VALIDATION_ERROR", message: "Invalid request.", status: 400 });
    }
    console.error("[learn/mobile/tutor/explain]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Explain failed.", status: 500 });
  }
}
