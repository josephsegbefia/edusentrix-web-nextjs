import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { submitLazyExploreAdventureQuiz } from "@/lib/learn/explore/explore-mobile.service";
import { submitMobileExploreAdventureQuiz } from "@/lib/learn/mobile-explore";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const lazyBodySchema = z.object({
  contentSnapshotId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOptionId: z.string().min(1),
      })
    )
    .min(1),
});

const legacyBodySchema = z.object({
  contentSnapshotId: z.string().min(1).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOptionId: z.string().min(1),
      })
    )
    .min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adventureId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const rawBody = await request.json().catch(() => null);
  const { adventureId } = await params;
  const decodedId = decodeURIComponent(adventureId);

  if (USE_LAZY_EXPLORE) {
    const parsedBody = lazyBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "contentSnapshotId and answers are required.",
        friendlyMessage: "Please answer each quiz question before submitting.",
        status: 400,
      });
    }

    const result = await submitLazyExploreAdventureQuiz(
      auth.context,
      decodedId,
      parsedBody.data
    );

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage:
          result.code === "QUIZ_REQUIRED"
            ? result.message
            : result.code === "SNAPSHOT_MISMATCH"
              ? "This quiz does not match the current mission version. Reopen the adventure and try again."
              : "We could not save your quiz. Try again.",
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  }

  const parsedBody = legacyBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return mobileApiFailure({
      code: "VALIDATION_ERROR",
      message: "Invalid quiz answers.",
      friendlyMessage: "Please answer each quiz question before submitting.",
      status: 400,
    });
  }

  const result = await submitMobileExploreAdventureQuiz(
    auth.context,
    decodedId,
    parsedBody.data
  );

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "QUIZ_REQUIRED"
          ? result.message
          : "We could not save your quiz. Try again.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
