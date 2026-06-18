import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { updateJourneyStep } from "@/lib/learn/todays-journey/update-journey-step";

const BodySchema = z.object({
  status: z.enum(["in_progress", "completed", "skipped"]).optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  elapsedSeconds: z.number().min(0).max(7200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string; stepKey: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  try {
    const body = BodySchema.parse(await request.json());
    const { journeyId, stepKey } = await params;

    const result = await updateJourneyStep({
      context: auth.context,
      journeyId: decodeURIComponent(journeyId),
      stepKey: decodeURIComponent(stepKey),
      status: body.status,
      progressPercent: body.progressPercent,
      elapsedSeconds: body.elapsedSeconds,
      metadata: body.metadata,
    });

    if (!result.ok) {
      const friendlyMessage =
        result.code === "INVALID_STEP_KEY"
          ? "That journey step is not valid."
          : result.code === "STEP_LOCKED"
            ? "Finish earlier steps before opening this one."
            : result.code === "STEP_ALREADY_COMPLETED"
              ? "You already finished this step."
              : result.message;

      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid step update payload.",
        friendlyMessage: "Something was wrong with that update. Please try again.",
        status: 400,
      });
    }

    console.error("[journey/subjects/step]", error);
    return mobileApiFailure({
      code: "JOURNEY_STEP_UPDATE_FAILED",
      message: error instanceof Error ? error.message : "Step update failed.",
      friendlyMessage: "We could not save your progress right now.",
      status: 500,
    });
  }
}
