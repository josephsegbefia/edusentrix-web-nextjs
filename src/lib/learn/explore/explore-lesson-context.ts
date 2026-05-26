import { Types } from "mongoose";

import type { ExploreLessonBrief } from "@/lib/learn/explore/explore-types";

function stripHtml(html: string, maxLen = 400) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

/** Parse mobile lesson ids (`session-<objectId>` or raw 24-char hex). */
export function parseExploreLessonId(lessonId: string): Types.ObjectId | null {
  const match = lessonId.match(/^session-([a-f0-9]{24})$/i);
  if (match?.[1] && Types.ObjectId.isValid(match[1])) {
    return new Types.ObjectId(match[1]);
  }
  if (Types.ObjectId.isValid(lessonId)) return new Types.ObjectId(lessonId);
  return null;
}

export function parseExploreSubjectOfferingId(
  subjectId: string
): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(subjectId)) return null;
  return new Types.ObjectId(subjectId);
}

/** Build approved lesson note context from published session blocks (no student free text). */
export function buildExploreLessonBrief(session: {
  title: string;
  planNotes?: string | null;
  contentBlocks?: Array<{ type?: string; title?: string | null; bodyHtml?: string }>;
}): ExploreLessonBrief {
  const blocks = session.contentBlocks ?? [];
  const taughtSnippets = blocks
    .map((block) => {
      const label = block.title?.trim() || block.type || "idea";
      const text = stripHtml(block.bodyHtml ?? "", 280);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean);

  const classroomBrief = taughtSnippets.join("\n").slice(0, 2400);
  const planNotes = session.planNotes?.trim()
    ? stripHtml(session.planNotes, 600)
    : "";

  return {
    classroomBrief: classroomBrief || `Class covered: ${session.title}.`,
    planNotes,
    topicKeywords: session.title,
  };
}
