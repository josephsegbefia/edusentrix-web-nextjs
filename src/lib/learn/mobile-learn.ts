import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { buildMobileLearnOverview } from "@/lib/learn/mobile-learn-overview";

/** @deprecated Use buildMobileLearnOverview — kept as route entry alias */
export async function buildMobileLearn(context: LearnMobileStudentContext) {
  return buildMobileLearnOverview(context);
}
