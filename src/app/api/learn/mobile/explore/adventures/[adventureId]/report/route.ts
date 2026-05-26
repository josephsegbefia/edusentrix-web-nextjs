import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { reportLazyExploreAdventure } from "@/lib/learn/explore/explore-mobile.service";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const bodySchema = z.object({
  contentSnapshotId: z.string().min(1),
  reason: z.enum([
    "too_hard",
    "too_easy",
    "not_related",
    "unsafe_or_inappropriate",
    "confusing",
    "wrong_information",
    "other",
  ]),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adventureId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  if (!USE_LAZY_EXPLORE) {
    return mobileApiFailure({
      code: "NOT_AVAILABLE",
      message: "Explore reporting requires lazy Explore.",
      friendlyMessage: "Reporting is not available yet. Please tell your teacher.",
      status: 404,
    });
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return mobileApiFailure({
      code: "VALIDATION_ERROR",
      message: "Invalid report request.",
      friendlyMessage: "Please choose a reason before sending your report.",
      status: 400,
    });
  }

  const { adventureId } = await params;
  const result = await reportLazyExploreAdventure(
    auth.context,
    decodeURIComponent(adventureId),
    parsedBody.data
  );

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "SNAPSHOT_MISMATCH"
          ? "That report could not be linked to this mission. Try again from the adventure."
          : "We could not send your report. Try again.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
