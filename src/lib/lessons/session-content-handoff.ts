import type { LessonContentBlock } from "@/types/lesson-content-blocks";

export type PriorSessionHandoff = {
  title: string;
  focusSummary?: string | null;
  keyPointsSummary?: string | null;
};

function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Short summary of generated blocks for anti-repetition across sequential generation. */
export function summarizeContentBlocksForHandoff(blocks: LessonContentBlock[]): string | null {
  const prioritized = [...blocks]
    .sort((a, b) => a.order - b.order)
    .filter((b) =>
      ["explanation", "example", "activity", "teacher_note", "check"].includes(b.type),
    )
    .slice(0, 6);

  if (prioritized.length === 0) return null;

  const lines = prioritized.map((block) => {
    const title = block.title?.trim() || block.type;
    const text = plainTextFromHtml(block.bodyHtml).slice(0, 160);
    return text ? `${title}: ${text}` : title;
  });

  const joined = lines.join(" | ");
  return joined.length > 900 ? `${joined.slice(0, 900)}…` : joined;
}

export function buildPriorSessionsHandoff(
  sessions: PriorSessionHandoff[],
): PriorSessionHandoff[] {
  return sessions.map((s) => ({
    title: s.title,
    focusSummary: s.focusSummary?.trim() || null,
    keyPointsSummary: s.keyPointsSummary?.trim() || null,
  }));
}
