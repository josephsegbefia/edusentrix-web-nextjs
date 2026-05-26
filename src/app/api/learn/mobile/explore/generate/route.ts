import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { lazyGenerateOrGetExploreAdventure } from "@/lib/learn/explore/explore-lazy-generate.service";
import { generateMobileExploreAdventure } from "@/lib/learn/mobile-explore";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  lessonId: z.string().optional(),
  subjectId: z.string().optional(),
  mode: z
    .enum(["recommended", "go_deeper", "mistake_buster", "challenge"])
    .optional(),
  /** Legacy mobile flag — maps to go_deeper when mode is omitted. */
  goDeeper: z.boolean().optional(),
  /** Ignored in lazy v1 — no arbitrary student topics. */
  topic: z.string().optional(),
});

function friendlyGenerateMessage(code: string, message: string) {
  if (code === "AI_LIMIT_REACHED") {
    return "You have used today's adventure generation limit. Try again tomorrow.";
  }
  if (code === "NO_EXPLORE_CONTEXT" || code === "NO_APPROVED_CONTENT") {
    return "Leo needs a class lesson before creating a new adventure.";
  }
  if (code === "LEARN_ACCESS_REQUIRED" || code === "SCHOOL_NOT_ELIGIBLE") {
    return "EduSentrix Learn is available for Premium schools.";
  }
  return message;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const mode =
      body.mode ?? (body.goDeeper === false ? "recommended" : "go_deeper");

    if (USE_LAZY_EXPLORE) {
      const result = await lazyGenerateOrGetExploreAdventure(auth.context, {
        lessonId: body.lessonId,
        subjectId: body.subjectId,
        mode,
      });

      if (!result.ok) {
        return mobileApiFailure({
          code: result.code,
          message: result.message,
          friendlyMessage: result.friendlyMessage ?? friendlyGenerateMessage(result.code, result.message),
          status: result.status,
        });
      }

      return mobileApiSuccess(result.data);
    }

    const legacy = await generateMobileExploreAdventure(auth.context, {
      lessonId: body.lessonId,
      goDeeper: mode !== "recommended",
    });

    if (!legacy.ok) {
      return mobileApiFailure({
        code: legacy.code,
        message: legacy.message,
        friendlyMessage: friendlyGenerateMessage(legacy.code, legacy.message),
        status: legacy.status,
      });
    }

    return mobileApiSuccess({
      state: "ready" as const,
      adventureId: legacy.data.adventureId,
      adventure: legacy.data.adventure,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid generate request.",
        status: 400,
      });
    }
    console.error("[learn/mobile/explore/generate]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Adventure generation failed.",
      status: 500,
    });
  }
}
