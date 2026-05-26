import { NextRequest, after } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { kickoffLazyExploreFeedGeneration } from "@/lib/learn/explore/explore-feed-kickoff.service";
import { runExploreGenerationForClaimedJob } from "@/lib/learn/explore/explore-lazy-generate.service";
import { buildLazyExploreAdventuresFeed } from "@/lib/learn/explore/explore-mobile.service";
import { buildMobileExploreAdventuresList } from "@/lib/learn/mobile-explore";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  if (USE_LAZY_EXPLORE) {
    const kickoff = await kickoffLazyExploreFeedGeneration(auth.context);
    if (kickoff.runInBackground && kickoff.jobId) {
      after(async () => {
        try {
          await connectToDatabase();
          await runExploreGenerationForClaimedJob({
            auth: auth.context,
            jobId: kickoff.jobId!,
          });
        } catch (error) {
          console.error("[learn/mobile/explore/adventures] background generation:", error);
        }
      });
    }
  }

  const result = USE_LAZY_EXPLORE
    ? await buildLazyExploreAdventuresFeed(auth.context)
    : await buildMobileExploreAdventuresList(auth.context);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      friendlyMessage:
        result.code === "NO_STUDENT_PROFILE"
          ? "Explore will appear after your student profile is ready."
          : result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}
