import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { submitJourneyReflection } from "@/lib/learn/todays-journey/submit-reflection";

const BodySchema = z.object({
  confidence: z.enum(["not_yet", "a_little", "good", "very_well"]),
  studentNote: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const body = BodySchema.parse(await request.json());
    const { journeyId } = await params;

    const result = await submitJourneyReflection(auth.context, decodeURIComponent(journeyId), body);

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage: result.message,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid reflection payload.",
        friendlyMessage: "Please choose how well you understood the lesson.",
        status: 400,
      });
    }

    console.error("[journey/subjects/reflection]", error);
    return mobileApiFailure({
      code: "REFLECTION_FAILED",
      message: error instanceof Error ? error.message : "Reflection save failed.",
      friendlyMessage: "We could not save your reflection right now.",
      status: 500,
    });
  }
}
