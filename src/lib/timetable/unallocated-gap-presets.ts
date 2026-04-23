/** Persisted in DB as `presetCode` — one code per unallocated block (per grade, per day, per time range). */
export const UNALLOCATED_GAP_PRESET_CODES = [
  "planning",
  "staff_meeting",
  "clubs",
  "sports",
  "assembly",
  "catch_up",
  "reading",
  "dismissal",
  "enrichment",
  "buffer",
  "intervention",
  "other",
] as const;

export type UnallocatedGapPresetCode = (typeof UNALLOCATED_GAP_PRESET_CODES)[number];

export const UNALLOCATED_GAP_PRESET_OPTIONS: ReadonlyArray<{
  code: UnallocatedGapPresetCode;
  label: string;
  description: string;
}> = [
  { code: "planning", label: "Teacher planning / prep", description: "Department or individual prep" },
  { code: "staff_meeting", label: "Year-group or staff meeting", description: "Structured meeting time" },
  { code: "clubs", label: "Clubs & societies", description: "Optional clubs or electives" },
  { code: "sports", label: "Sports / PE / fixtures", description: "Physical activities or teams" },
  { code: "assembly", label: "Assembly, chapel, or house", description: "Whole-grade gatherings" },
  { code: "catch_up", label: "Pupil catch-up / support", description: "Intervention or revision" },
  { code: "reading", label: "Silent reading / library", description: "Reading for pleasure or DEAR" },
  { code: "dismissal", label: "Staggered dismissal / buses", description: "End-of-day routines" },
  { code: "enrichment", label: "Enrichment or rotation", description: "Rotating programme blocks" },
  { code: "buffer", label: "Intentional buffer", description: "Slack for transitions (policy)" },
  { code: "intervention", label: "Small-group intervention", description: "SEN or literacy/numeracy support" },
  { code: "other", label: "Other (see policy)", description: "Local naming in handbook" },
];

export function isUnallocatedGapPresetCode(s: string): s is UnallocatedGapPresetCode {
  return (UNALLOCATED_GAP_PRESET_CODES as readonly string[]).includes(s);
}

export function unallocatedGapPresetLabel(code: string | null | undefined): string {
  if (!code) return "";
  const hit = UNALLOCATED_GAP_PRESET_OPTIONS.find((o) => o.code === code);
  return hit?.label || code;
}
