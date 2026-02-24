export type CurriculumCode =
  | "ghana_nacca"
  | "cambridge"
  | "ib_pyp"
  | "ib_myp"
  | "british_nc"
  | "american"
  | "hybrid";

export type AssessmentModel =
  | "ca_exam"
  | "criteria_rubric"
  | "standards_based"
  | "portfolio"
  | "points_average"
  | "custom";

export type TermStructure =
  | "three_terms"
  | "two_semesters"
  | "four_quarters"
  | "trimesters";

export type GradingSystemType =
  | "letter_af"
  | "ib_1_7"
  | "cambridge_ag"
  | "descriptive"
  | "gpa_4"
  | "custom";

export interface PerformanceTierDef {
  tier: "top" | "above_average" | "average" | "at_risk";
  label: string;
  minPercentage: number;
}

export interface CurriculumProfile {
  code: CurriculumCode;
  label: string;
  description: string;
  assessmentModel: AssessmentModel;
  termStructure: TermStructure;
  gradingSystem: GradingSystemType;
  passThreshold: number;
  performanceTiers: PerformanceTierDef[];
  defaultCaWeight: number;
  defaultExamWeight: number;
  termLabels: string[];
}

export const CURRICULUM_PROFILES: Record<CurriculumCode, CurriculumProfile> = {
  ghana_nacca: {
    code: "ghana_nacca",
    label: "Ghana NaCCA Curriculum",
    description:
      "National Council for Curriculum and Assessment — the standard Ghana curriculum for Basic and SHS schools.",
    assessmentModel: "ca_exam",
    termStructure: "three_terms",
    gradingSystem: "letter_af",
    passThreshold: 50,
    performanceTiers: [
      { tier: "top", label: "Top", minPercentage: 80 },
      { tier: "above_average", label: "Above Average", minPercentage: 65 },
      { tier: "average", label: "Average", minPercentage: 50 },
      { tier: "at_risk", label: "At Risk", minPercentage: 0 },
    ],
    defaultCaWeight: 0.3,
    defaultExamWeight: 0.7,
    termLabels: ["Term 1", "Term 2", "Term 3"],
  },

  cambridge: {
    code: "cambridge",
    label: "Cambridge Primary & Lower Secondary",
    description:
      "Cambridge Assessment International Education — Progression Tests, Checkpoint exams, and IGCSE pathway.",
    assessmentModel: "ca_exam",
    termStructure: "three_terms",
    gradingSystem: "cambridge_ag",
    passThreshold: 40,
    performanceTiers: [
      { tier: "top", label: "Outstanding", minPercentage: 90 },
      { tier: "above_average", label: "Good", minPercentage: 70 },
      { tier: "average", label: "Satisfactory", minPercentage: 40 },
      { tier: "at_risk", label: "Below Expectations", minPercentage: 0 },
    ],
    defaultCaWeight: 0.4,
    defaultExamWeight: 0.6,
    termLabels: ["Autumn Term", "Spring Term", "Summer Term"],
  },

  ib_pyp: {
    code: "ib_pyp",
    label: "IB Primary Years Programme (PYP)",
    description:
      "International Baccalaureate PYP — transdisciplinary, inquiry-based learning with portfolio assessment.",
    assessmentModel: "portfolio",
    termStructure: "two_semesters",
    gradingSystem: "descriptive",
    passThreshold: 0,
    performanceTiers: [
      { tier: "top", label: "Exceeding", minPercentage: 80 },
      { tier: "above_average", label: "Meeting", minPercentage: 60 },
      { tier: "average", label: "Approaching", minPercentage: 40 },
      { tier: "at_risk", label: "Beginning", minPercentage: 0 },
    ],
    defaultCaWeight: 1.0,
    defaultExamWeight: 0.0,
    termLabels: ["Semester 1", "Semester 2"],
  },

  ib_myp: {
    code: "ib_myp",
    label: "IB Middle Years Programme (MYP)",
    description:
      "International Baccalaureate MYP — criteria-based rubric assessment across 8 subject groups.",
    assessmentModel: "criteria_rubric",
    termStructure: "two_semesters",
    gradingSystem: "ib_1_7",
    passThreshold: 3,
    performanceTiers: [
      { tier: "top", label: "Excellent", minPercentage: 86 },
      { tier: "above_average", label: "Very Good", minPercentage: 72 },
      { tier: "average", label: "Adequate", minPercentage: 43 },
      { tier: "at_risk", label: "Limited", minPercentage: 0 },
    ],
    defaultCaWeight: 0.5,
    defaultExamWeight: 0.5,
    termLabels: ["Semester 1", "Semester 2"],
  },

  british_nc: {
    code: "british_nc",
    label: "English National Curriculum",
    description:
      "EYFS through Key Stage 3 — standards-based descriptors (Working Towards, Expected, Greater Depth).",
    assessmentModel: "standards_based",
    termStructure: "three_terms",
    gradingSystem: "descriptive",
    passThreshold: 0,
    performanceTiers: [
      { tier: "top", label: "Greater Depth", minPercentage: 80 },
      { tier: "above_average", label: "Expected Standard", minPercentage: 60 },
      { tier: "average", label: "Working Towards", minPercentage: 40 },
      { tier: "at_risk", label: "Below Expectations", minPercentage: 0 },
    ],
    defaultCaWeight: 0.6,
    defaultExamWeight: 0.4,
    termLabels: ["Autumn Term", "Spring Term", "Summer Term"],
  },

  american: {
    code: "american",
    label: "American Curriculum (K–8)",
    description:
      "US-style Elementary and Middle School — points-based GPA with letter grades and quarterly reports.",
    assessmentModel: "points_average",
    termStructure: "two_semesters",
    gradingSystem: "gpa_4",
    passThreshold: 60,
    performanceTiers: [
      { tier: "top", label: "Honor Roll", minPercentage: 90 },
      { tier: "above_average", label: "Proficient", minPercentage: 75 },
      { tier: "average", label: "Satisfactory", minPercentage: 60 },
      { tier: "at_risk", label: "Needs Improvement", minPercentage: 0 },
    ],
    defaultCaWeight: 0.5,
    defaultExamWeight: 0.5,
    termLabels: ["Semester 1", "Semester 2"],
  },

  hybrid: {
    code: "hybrid",
    label: "Hybrid / Custom Curriculum",
    description:
      "A blend of international and local curriculum elements — fully customizable structure.",
    assessmentModel: "custom",
    termStructure: "three_terms",
    gradingSystem: "custom",
    passThreshold: 50,
    performanceTiers: [
      { tier: "top", label: "Top", minPercentage: 80 },
      { tier: "above_average", label: "Above Average", minPercentage: 65 },
      { tier: "average", label: "Average", minPercentage: 50 },
      { tier: "at_risk", label: "At Risk", minPercentage: 0 },
    ],
    defaultCaWeight: 0.4,
    defaultExamWeight: 0.6,
    termLabels: ["Term 1", "Term 2", "Term 3"],
  },
};

export const CURRICULUM_OPTIONS = Object.values(CURRICULUM_PROFILES);

export function getCurriculumProfile(code: CurriculumCode): CurriculumProfile {
  return CURRICULUM_PROFILES[code] ?? CURRICULUM_PROFILES.ghana_nacca;
}
