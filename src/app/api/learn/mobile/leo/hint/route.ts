import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { handleMobileTutorChat } from "@/lib/learn/mobile-tutor";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  lessonId: z.string().optional(),
  subjectId: z.string().optional(),
  hasStudentAttempted: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const result = await handleMobileTutorChat(auth.context, { ...body, mode: "hint" });

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage:
          result.code === "LEO_SAFETY_BLOCKED"
            ? result.message
            : result.code === "AI_LIMIT_REACHED"
              ? "You have used today's AI tutor limit. Try again later."
              : result.message,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid hint request.",
        status: 400,
      });
    }
    console.error("[learn/mobile/leo/hint]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Hint failed.", status: 500 });
  }
}
