import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { lazyGenerateOrGetExploreAdventure } from "@/lib/learn/explore/explore-lazy-generate.service";
import { generateMobileExploreAdventure } from "@/lib/learn/mobile-explore";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { DailyQuestItem } from "@/models/DailyQuestItem";

const BodySchema = z.object({
  mode: z.enum(["go_deeper", "leo_rescue"]).default("go_deeper"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const { itemId } = await params;

    if (!Types.ObjectId.isValid(itemId)) {
      return mobileApiFailure({
        code: "QUEST_ITEM_NOT_FOUND",
        message: "Quest item not found.",
        friendlyMessage: "We could not find that quest item.",
        status: 404,
      });
    }

    const item = await DailyQuestItem.findOne({
      _id: new Types.ObjectId(itemId),
      schoolId: auth.context.schoolId,
      studentId: auth.context.studentId,
    });

    if (!item || !item.lessonId) {
      return mobileApiFailure({
        code: "EXPLORE_NOT_AVAILABLE",
        message: "Explore is not available for this quest item.",
        friendlyMessage: "Leo needs a class lesson before opening an Explore adventure.",
        status: 404,
      });
    }

    const mode = body.mode === "leo_rescue" ? "mistake_buster" : "go_deeper";
    const result = USE_LAZY_EXPLORE
      ? await lazyGenerateOrGetExploreAdventure(auth.context, {
          lessonId: String(item.lessonId),
          subjectId: item.subjectId ? String(item.subjectId) : undefined,
          mode,
        })
      : await generateMobileExploreAdventure(auth.context, {
          lessonId: String(item.lessonId),
          goDeeper: true,
        });

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        friendlyMessage:
          "Leo could not open that adventure yet. Finish the review and try again.",
        status: result.status,
      });
    }

    const adventureId = (result.data as { adventureId?: string }).adventureId ?? null;
    if (adventureId && Types.ObjectId.isValid(adventureId)) {
      item.explore.unlockStatus = "ready";
      item.explore.adventureId = new Types.ObjectId(adventureId);
      item.explore.unlockReason = body.mode === "leo_rescue" ? "needs_rescue" : "score_ready";
      await item.save();
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid Explore request.",
        status: 400,
      });
    }

    console.error("[learn/mobile/quests/items/explore]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Quest Explore unlock failed.",
      status: 500,
    });
  }
}
