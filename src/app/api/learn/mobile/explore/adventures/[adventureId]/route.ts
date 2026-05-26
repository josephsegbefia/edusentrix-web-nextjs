import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { buildLazyExploreAdventureDetail } from "@/lib/learn/explore/explore-mobile.service";
import { buildMobileExploreAdventureDetail } from "@/lib/learn/mobile-explore";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ adventureId: string }> }
) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const { adventureId } = await params;
  const decodedId = decodeURIComponent(adventureId);

  let result = USE_LAZY_EXPLORE
    ? await buildLazyExploreAdventureDetail(auth.context, decodedId)
    : await buildMobileExploreAdventureDetail(auth.context, decodedId);

  if (!result.ok && USE_LAZY_EXPLORE && result.code === "ADVENTURE_NOT_FOUND") {
    result = await buildMobileExploreAdventureDetail(auth.context, decodedId);
  }

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage: "Leo could not find that adventure. Try another Explore card.",
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
