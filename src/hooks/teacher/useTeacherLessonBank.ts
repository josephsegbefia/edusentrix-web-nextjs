import { useQuery } from "@tanstack/react-query";

export type TeacherLessonBankRow = {
  id: string;
  title: string;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  classGroupId: string;
  classDisplayLabel: string | null;
  subjectId: string | null;
  subjectName: string | null;
  lessonNoteId: string;
  lessonNoteTopic: string | null;
  ownerTeacherId: string;
  ownerDisplayName: string | null;
};

export function useTeacherLessonBank(params: { q?: string; limit?: number }) {
  const q = params.q?.trim() || "";
  const limit = params.limit ?? 40;

  return useQuery({
    queryKey: ["teacher-lessons-bank", q, limit],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      sp.set("limit", String(limit));
      const res = await fetch(`/api/teacher/lessons/bank?${sp.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { success: true; data: { entries: TeacherLessonBankRow[] } }
        | { success: false; error?: string }
        | null;
      if (!res.ok || !json?.success) {
        throw new Error(
          json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to load lesson bank"
        );
      }
      return json.data.entries;
    },
    staleTime: 30_000,
  });
}
