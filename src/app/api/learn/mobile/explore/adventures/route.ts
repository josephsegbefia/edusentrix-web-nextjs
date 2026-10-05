import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { USE_LAZY_EXPLORE } from "@/lib/learn/explore/explore-flags";
import { kickoffLazyExploreFeedGeneration } from "@/lib/learn/explore/explore-feed-kickoff.service";
import { enqueueExploreGenerationWork } from "@/lib/learn/explore/enqueue-explore-generation";
import { ExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { buildLazyExploreAdventuresFeed } from "@/lib/learn/explore/explore-mobile.service";
import { buildMobileExploreAdventuresList } from "@/lib/learn/mobile-explore";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  if (USE_LAZY_EXPLORE) {
    const kickoff = await kickoffLazyExploreFeedGeneration(auth.context);
    if (kickoff.runInBackground && kickoff.jobId) {
      const job = await ExploreGenerationJob.findById(kickoff.jobId);
      if (job) {
        await enqueueExploreGenerationWork({
          exploreJob: job,
          trigger: "system",
        });
      }
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
