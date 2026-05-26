import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { handleMobileTutorChat } from "@/lib/learn/mobile-tutor";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  lessonId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const result = await handleMobileTutorChat(auth.context, {
      ...body,
      mode: "explain",
      message: `Language help: ${body.message}`,
    });

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
      return mobileApiFailure({ code: "VALIDATION_ERROR", message: "Message is required.", status: 400 });
    }
    console.error("[learn/mobile/tutor/language-help]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Language help failed.", status: 500 });
  }
}
