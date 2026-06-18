import type { LessonSubjectMode } from "@/types/lesson-content-blocks";

export type SubjectModeResolution = {
  subjectMode: LessonSubjectMode;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  languageCode?: string | null;
};

function normalizeSubjectText(input: {
  subjectName?: string | null;
  subjectCode?: string | null;
  curriculum?: string | null;
  gradeName?: string | null;
}): string {
  return [
    input.subjectName,
    input.subjectCode,
    input.curriculum,
    input.gradeName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Aligns with heuristics in mobile-ghanaian-languages.ts */
export function detectGhanaianLanguageCode(text: string): string | null {
  if (text.includes("ewe")) return "ewe";
  if (text.includes("akuapem") && text.includes("twi")) return "twi-akuapem";
  if (text.includes("asante") && text.includes("twi")) return "twi-asante";
  if (/\btwi\b/.test(text)) return "twi-asante";
  if (text.includes("dagbani")) return "dagbani";
  if (text.includes("fante")) return "fante";
  if (text.includes("nzema")) return "nzema";
  if (text.includes("dangme")) return "dangme";
  if (text.includes("gonja")) return "gonja";
  if (text.includes("kasem")) return "kasem";
  if (text.includes("dagaare") || text.includes("dagaare")) return "dagaare";
  if (text.includes("ga") && !text.includes("ghanaian language")) return "ga";
  if (text.includes("ghanaian language") || text.includes("ghl")) return "twi-asante";
  return null;
}

function isMathematicsSubject(text: string): boolean {
  return (
    /\bmathematics\b/.test(text) ||
    /\bmaths?\b/.test(text) ||
    /\bcore mathematics\b/.test(text) ||
    /\belective mathematics\b/.test(text)
  );
}

function isScienceVisualSubject(text: string): boolean {
  const patterns = [
    /\bscience\b/,
    /\bintegrated science\b/,
    /\bcareer technology\b/,
    /\bagriculture\b/,
    /\bbasic science\b/,
    /\bnatural science\b/,
    /\bphysics\b/,
    /\bchemistry\b/,
    /\bbiology\b/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function isVisualHeavySubject(text: string): boolean {
  const patterns = [
    /\bcreative arts\b/,
    /\bvisual arts\b/,
    /\bhome economics\b/,
    /\btechnical\b/,
    /\bict\b/,
    /\bcomputing\b/,
    /\bgeography\b/,
    /\bhistory\b/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

export function resolveLessonSubjectMode(input: {
  subjectName?: string | null;
  subjectCode?: string | null;
  curriculum?: string | null;
  gradeName?: string | null;
}): SubjectModeResolution {
  const text = normalizeSubjectText(input);
  if (!text) {
    return {
      subjectMode: "general",
      confidence: "low",
      reasons: ["No subject metadata provided — defaulting to general mode."],
    };
  }

  const languageCode = detectGhanaianLanguageCode(text);
  if (languageCode) {
    return {
      subjectMode: "ghanaian_language",
      confidence: "high",
      reasons: [`Detected Ghanaian language subject (${languageCode}).`],
      languageCode,
    };
  }

  if (isMathematicsSubject(text)) {
    return {
      subjectMode: "mathematics",
      confidence: "high",
      reasons: ["Detected Mathematics subject."],
    };
  }

  if (isScienceVisualSubject(text)) {
    return {
      subjectMode: "science_visual",
      confidence: "medium",
      reasons: ["Detected science or technology subject that often needs diagrams."],
    };
  }

  if (isVisualHeavySubject(text)) {
    return {
      subjectMode: "visual_heavy",
      confidence: "medium",
      reasons: ["Detected subject that often benefits from illustrations."],
    };
  }

  return {
    subjectMode: "general",
    confidence: "low",
    reasons: ["No specialized subject mode matched — using general mode."],
  };
}
