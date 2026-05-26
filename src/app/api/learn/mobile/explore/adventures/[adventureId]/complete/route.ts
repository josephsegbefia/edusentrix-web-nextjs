import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { completeLazyExploreAdventure } from "@/lib/learn/explore/explore-mobile.service";
import { completeMobileExploreAdventure } from "@/lib/learn/mobile-explore";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const lazyBodySchema = z.object({
  contentSnapshotId: z.string().min(1),
  quizScorePercent: z.number().min(0).max(100).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adventureId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { adventureId } = await params;
  const decodedId = decodeURIComponent(adventureId);

  if (USE_LAZY_EXPLORE) {
    const parsedBody = lazyBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "contentSnapshotId is required.",
        friendlyMessage: "We need the mission version to save your completion.",
        status: 400,
      });
    }

    const result = await completeLazyExploreAdventure(
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
            ? "Complete the quick Explore quiz before finishing this adventure."
            : result.code === "SNAPSHOT_MISMATCH"
              ? "This mission was updated. Reopen the adventure and try again."
              : "We could not save your adventure completion.",
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  }

  const result = await completeMobileExploreAdventure(auth.context, decodedId);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "We could not save your adventure completion.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
