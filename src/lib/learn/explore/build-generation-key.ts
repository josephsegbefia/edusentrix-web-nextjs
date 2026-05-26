import type { ExploreGenerationKeyParams } from "@/lib/learn/explore/explore-types";
import { EXPLORE_BASE_CONTENT_VERSION } from "@/lib/learn/explore/explore-types";

/** Class-scoped key — studentId is intentionally excluded (spec §7). */
export function buildExploreGenerationKey(params: ExploreGenerationKeyParams) {
  const contentVersion = params.contentVersion ?? EXPLORE_BASE_CONTENT_VERSION;

  return [
    String(params.schoolId),
    String(params.classGroupId),
    String(params.subjectId),
    String(params.lessonId),
    params.gradeLevel.trim(),
    "base_explore",
    contentVersion,
  ].join(":");
}

export function buildExploreAdventureId(adventureObjectId: { toString(): string }) {
  return `adventure-${adventureObjectId.toString()}`;
}

export function parseExploreAdventureId(adventureId: string) {
  const prefixed = adventureId.match(/^adventure-([a-f0-9]{24})$/i);
  if (prefixed?.[1]) {
    return prefixed[1];
  }
  if (/^[a-f0-9]{24}$/i.test(adventureId)) {
    return adventureId;
  }
  return null;
}
