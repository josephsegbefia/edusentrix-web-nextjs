import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileLeoSuggestedActions } from "@/lib/learn/mobile-leo-suggest-actions";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const ContextSchema = z
  .object({
    source: z.string().optional(),
    mode: z.string().optional(),
    subjectId: z.string().optional(),
    lessonId: z.string().optional(),
    questItemId: z.string().optional(),
    exploreAdventureId: z.string().optional(),
    revisionTopicId: z.string().optional(),
    examAttemptId: z.string().optional(),
    hasStudentAttempted: z.boolean().optional(),
  })
  .optional();

const BodySchema = z.object({
  context: ContextSchema,
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const suggestedActions = await buildMobileLeoSuggestedActions({
      context: auth.context,
      snapshot: body.context ?? undefined,
    });

    return mobileApiSuccess({ suggestedActions });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({ code: "VALIDATION_ERROR", message: "Invalid request.", status: 400 });
    }
    console.error("[learn/mobile/leo/suggest-actions]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Suggest actions failed.",
      status: 500,
    });
  }
}
