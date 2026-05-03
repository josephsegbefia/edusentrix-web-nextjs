export const LEO_SCHEME_PLAN_MODES = [
  "draft_from_curriculum",
  "missing_objectives",
  "pacing",
  "uncovered",
  "catch_up",
  "revision",
] as const;

export type LeoSchemePlanMode = (typeof LEO_SCHEME_PLAN_MODES)[number];

export type LeoSchemePlanRow = {
  weekNumber: number | null;
  title: string;
  learningObjective: string | null;
  notes: string | null;
  curriculumNodeIds: string[];
};

export type LeoSchemePlanResult = {
  mode: LeoSchemePlanMode;
  isDraft: true;
  disclaimer: string;
  assistantSummary: string;
  suggestedRows: LeoSchemePlanRow[];
  pacingNotes: string | null;
  uncoveredTopics: string[];
  revisionFocus: string[];
  catchUpNotes: string | null;
};
