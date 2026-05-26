import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { handleMobileTutorChat } from "@/lib/learn/mobile-tutor";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  message: z.string().optional(),
  conversationId: z.string().optional(),
  lessonId: z.string().optional(),
  questionText: z.string().optional(),
  studentAnswer: z.string().optional(),
  correctAnswer: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const mistakeContext = [
      body.questionText ? `Question: ${body.questionText}` : null,
      body.studentAnswer ? `Student tried: ${body.studentAnswer}` : null,
      body.correctAnswer ? `Correct idea (for tutor only): ${body.correctAnswer}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await handleMobileTutorChat(auth.context, {
      message:
        body.message?.trim() ||
        `Explain my mistake kindly and help me fix my thinking.\n${mistakeContext}`,
      mode: "explain",
      lessonId: body.lessonId,
      conversationId: body.conversationId,
      hasStudentAttempted: true,
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
      return mobileApiFailure({ code: "VALIDATION_ERROR", message: "Invalid request.", status: 400 });
    }
    console.error("[learn/mobile/leo/explain-mistake]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Explain mistake failed.",
      status: 500,
    });
  }
}
