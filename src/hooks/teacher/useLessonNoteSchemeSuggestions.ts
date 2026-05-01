import { useQuery } from "@tanstack/react-query";
import type { SchemeItemRow, SchemeRow } from "@/types/schemes";

export type LessonNoteSchemeSuggestions = {
  enabled: boolean;
  requireSchemeLinkForLessonNotes: boolean;
  schemes: SchemeRow[];
  items: SchemeItemRow[];
  suggestedItems: SchemeItemRow[];
  selectedSchemeValid: boolean | null;
};

type Response = { success: boolean; data: LessonNoteSchemeSuggestions; error?: string };

export function useLessonNoteSchemeSuggestions(
  args: {
    classGroupId: string | null;
    subjectId: string | undefined;
    topic: string;
    selectedSchemeId: string | null | undefined;
  },
  queryEnabled: boolean
) {
  const { classGroupId, subjectId, topic, selectedSchemeId } = args;

  return useQuery<LessonNoteSchemeSuggestions>({
    queryKey: [
      "lesson-note-scheme-suggestions",
      classGroupId,
      subjectId ?? "",
      topic,
      selectedSchemeId ?? "",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classGroupId) params.set("classGroupId", classGroupId);
      if (subjectId) params.set("subjectId", subjectId);
      if (topic.trim()) params.set("topic", topic.trim());
      if (selectedSchemeId) params.set("schemeId", selectedSchemeId);
      const res = await fetch(
        `/api/teacher/lesson-notes/scheme-suggestions?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => null)) as Response | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load scheme suggestions");
      }
      return json.data;
    },
    enabled: queryEnabled && Boolean(classGroupId),
    staleTime: 20_000,
  });
}
