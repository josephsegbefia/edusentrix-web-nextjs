import "server-only";

import type { Types } from "mongoose";
import type { ILessonNote } from "@/models/LessonNote";
import { SchemeItem } from "@/models/SchemeItem";

const MAX_SCHEME_ENRICHMENT_CHARS = 3_000;

const STANDARD_SECTION_KEYS = [
  "context",
  "curriculum",
  "resources",
  "body",
  "assessment",
] as const;

/** Section keys available for allocation from a lesson note (excludes reflections by default). */
export function getAllocatableNoteSectionKeys(note: ILessonNote): string[] {
  if (note.templateType === "IB_PYP_UNIT_PLANNER" || note.templateType === "IB_MYP_UNIT_PLANNER") {
    const unit = note.body as { unitSections?: Array<{ key?: string }> } | undefined;
    const keys = (unit?.unitSections ?? [])
      .map((s) => String(s.key || "").trim())
      .filter(Boolean);
    if (keys.length > 0) return keys;
  }
  return [...STANDARD_SECTION_KEYS];
}

/**
 * Enrich a note slice with content from linked SchemeItems.
 * Call this before serialising the slice for an AI prompt when the session has schemeItemIds.
 * Falls back to noteSchemeItemIds when schemeItemIds is empty.
 */
export async function enrichSliceWithSchemeItems(
  slice: Record<string, unknown>,
  schemeItemIds: Types.ObjectId[] | string[],
  schoolId: Types.ObjectId,
  noteSchemeItemIds?: Types.ObjectId[] | string[],
): Promise<Record<string, unknown>> {
  const ids =
    schemeItemIds.length > 0 ? schemeItemIds : (noteSchemeItemIds ?? []);
  if (ids.length === 0) return slice;
  const items = await SchemeItem.find({
    _id: { $in: ids },
    schoolId,
  })
    .select(
      "topic subtopic strand subStrand contentStandard indicator learningObjectives assessmentIdeas teachingLearningActivities teachingResources notes",
    )
    .lean<
      Array<{
        topic?: string | null;
        subtopic?: string | null;
        strand?: string | null;
        subStrand?: string | null;
        contentStandard?: string | null;
        indicator?: string | null;
        learningObjectives?: string[];
        assessmentIdeas?: string[];
        teachingLearningActivities?: string | null;
        teachingResources?: string[];
        notes?: string | null;
      }>
    >();
  if (items.length === 0) return slice;
  const lines = items
    .map((item, i) => {
      const parts = [
        `Scheme item ${i + 1}:`,
        item.strand && `  Strand: ${item.strand}`,
        item.subStrand && `  Sub-strand: ${item.subStrand}`,
        item.topic && `  Topic: ${item.topic}`,
        item.subtopic && `  Subtopic: ${item.subtopic}`,
        item.contentStandard && `  Content standard: ${item.contentStandard}`,
        item.indicator && `  Indicator: ${item.indicator}`,
        item.learningObjectives?.length &&
          `  Objectives: ${item.learningObjectives.join("; ")}`,
        item.teachingLearningActivities &&
          `  Teaching & learning activities: ${item.teachingLearningActivities}`,
        item.teachingResources?.length &&
          `  Teaching resources: ${item.teachingResources.join(", ")}`,
        item.assessmentIdeas?.length &&
          `  Assessment ideas: ${item.assessmentIdeas.join("; ")}`,
        item.notes && `  Notes: ${item.notes}`,
      ]
        .filter(Boolean)
        .join("\n");
      return parts;
    })
    .join("\n\n");
  let schemeText = lines;
  if (schemeText.length > MAX_SCHEME_ENRICHMENT_CHARS) {
    schemeText = schemeText.slice(0, MAX_SCHEME_ENRICHMENT_CHARS) + "\n...(truncated)";
  }
  return { ...slice, schemeItems: schemeText };
}

export function sliceNoteContextForSections(note: ILessonNote, sectionKeys: string[]): Record<string, unknown> {
  const keys = new Set(sectionKeys);
  const out: Record<string, unknown> = {
    templateType: note.templateType,
    topic: note.topic,
    durationMinutes: note.durationMinutes,
  };
  if (keys.has("context")) {
    out.curriculumCode = note.curriculumCode;
    out.references = note.references;
  }
  if (keys.has("curriculum")) out.curriculum = note.curriculum;
  if (keys.has("resources")) out.resources = note.resources;
  if (keys.has("body")) out.body = note.body;
  if (keys.has("assessment")) out.assessment = note.assessment;
  if (note.templateType === "IB_PYP_UNIT_PLANNER" || note.templateType === "IB_MYP_UNIT_PLANNER") {
    const unit = note.body as { unitSections?: Array<{ key?: string; content?: unknown }> } | undefined;
    const picked = (unit?.unitSections ?? []).filter((s) => keys.has(String(s.key)));
    if (picked.length > 0) out.unitSections = picked;
  }
  return out;
}
