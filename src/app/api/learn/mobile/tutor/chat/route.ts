import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { handleMobileTutorChat } from "@/lib/learn/mobile-tutor";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const LeoContextSchema = z
  .object({
    source: z.string().optional(),
    mode: z.string().optional(),
    subjectId: z.string().optional(),
    lessonId: z.string().optional(),
    questItemId: z.string().optional(),
    exploreAdventureId: z.string().optional(),
    revisionTopicId: z.string().optional(),
    hasStudentAttempted: z.boolean().optional(),
  })
  .optional();

const BodySchema = z.object({
  message: z.string().min(1),
  mode: z
    .enum(["explain", "quiz", "hint", "summarize", "revise", "exam_prep"])
    .optional(),
  conversationId: z.string().optional(),
  lessonId: z.string().optional(),
  subjectId: z.string().optional(),
  hasStudentAttempted: z.boolean().optional(),
  context: LeoContextSchema,
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const result = await handleMobileTutorChat(auth.context, {
      message: body.message,
      mode: body.mode,
      conversationId: body.conversationId,
      lessonId: body.lessonId ?? body.context?.lessonId ?? body.context?.questItemId,
      subjectId: body.subjectId ?? body.context?.subjectId,
      hasStudentAttempted:
        body.hasStudentAttempted ?? body.context?.hasStudentAttempted,
    });

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage:
          result.code === "AI_LIMIT_REACHED"
            ? "You have used today's AI tutor limit. Try again later."
            : result.code === "NO_APPROVED_CONTENT"
              ? "Leo needs a class lesson before tutoring can start."
              : result.message,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid tutor message.",
        status: 400,
      });
    }
    console.error("[learn/mobile/tutor/chat]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Tutor chat failed.", status: 500 });
  }
}
