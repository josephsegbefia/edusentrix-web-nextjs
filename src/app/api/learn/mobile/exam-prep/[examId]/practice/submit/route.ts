import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { submitMobileExamPractice } from "@/lib/learn/mobile-exam-prep";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      optionId: z.string().min(1),
    })
  ),
  elapsedSeconds: z.number().int().min(0).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const { examId } = await params;

    const result = await submitMobileExamPractice({
      context: auth.context,
      examId: decodeURIComponent(examId),
      answers: body.answers,
      elapsedSeconds: body.elapsedSeconds,
    });

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage: "We could not save your practice results.",
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid practice submission.",
        status: 400,
      });
    }
    console.error("[learn/mobile/exam-prep/submit]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Submission failed.", status: 500 });
  }
}
