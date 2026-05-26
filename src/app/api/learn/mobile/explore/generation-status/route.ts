import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { getLazyExploreGenerationStatus } from "@/lib/learn/explore/explore-mobile.service";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  if (!USE_LAZY_EXPLORE) {
    return mobileApiFailure({
      code: "NOT_AVAILABLE",
      message: "Generation status is only available for lazy Explore.",
      friendlyMessage: "This feature is not available yet.",
      status: 404,
    });
  }

  const generationKey = request.nextUrl.searchParams.get("generationKey")?.trim();
  if (!generationKey) {
    return mobileApiFailure({
      code: "VALIDATION_ERROR",
      message: "generationKey query parameter is required.",
      friendlyMessage: "Missing generation key.",
      status: 400,
    });
  }

  const result = await getLazyExploreGenerationStatus(auth.context, generationKey);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "JOB_NOT_FOUND"
          ? "Leo is not preparing that mission anymore. Try opening Explore again."
          : result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
