import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { submitMobileRevisionSession } from "@/lib/learn/mobile-revision";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.string(),
    })
  ),
  elapsedSeconds: z.number().int().min(0).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const { sessionId } = await params;

    const result = await submitMobileRevisionSession({
      context: auth.context,
      sessionId: decodeURIComponent(sessionId),
      answers: body.answers,
      elapsedSeconds: body.elapsedSeconds,
    });

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage: "We could not save your revision results.",
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid revision submission.",
        status: 400,
      });
    }
    console.error("[learn/mobile/revision/submit]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Submission failed.", status: 500 });
  }
}
