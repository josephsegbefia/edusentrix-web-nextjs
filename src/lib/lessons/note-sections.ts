import "server-only";

import type { ILessonNote } from "@/models/LessonNote";

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
