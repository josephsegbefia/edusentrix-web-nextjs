import type { IGradeMapping } from "@/models/GradingScale";
import type { CurriculumCode } from "./curriculum-profiles";

export interface GradingPreset {
  name: string;
  gradeMappings: IGradeMapping[];
  caWeight: number;
  examWeight: number;
  passThreshold: number;
  performanceTiers: {
    top: number;
    aboveAverage: number;
    average: number;
  };
}

export const GRADING_PRESETS: Record<CurriculumCode, GradingPreset> = {
  ghana_nacca: {
    name: "Ghana NaCCA Standard",
    gradeMappings: [
      { minPercentage: 80, maxPercentage: 100, letter: "A", point: 4.0, description: "Excellent" },
      { minPercentage: 70, maxPercentage: 79.9, letter: "B", point: 3.0, description: "Very Good" },
      { minPercentage: 60, maxPercentage: 69.9, letter: "C", point: 2.0, description: "Good" },
      { minPercentage: 50, maxPercentage: 59.9, letter: "D", point: 1.0, description: "Pass" },
      { minPercentage: 0, maxPercentage: 49.9, letter: "F", point: 0.0, description: "Fail" },
    ],
    caWeight: 0.3,
    examWeight: 0.7,
    passThreshold: 50,
    performanceTiers: { top: 80, aboveAverage: 65, average: 50 },
  },

  cambridge: {
    name: "Cambridge Assessment Scale",
    gradeMappings: [
      { minPercentage: 90, maxPercentage: 100, letter: "A*", point: 8.0, description: "Outstanding" },
      { minPercentage: 80, maxPercentage: 89.9, letter: "A", point: 7.0, description: "Excellent" },
      { minPercentage: 70, maxPercentage: 79.9, letter: "B", point: 6.0, description: "Very Good" },
      { minPercentage: 60, maxPercentage: 69.9, letter: "C", point: 5.0, description: "Good" },
      { minPercentage: 50, maxPercentage: 59.9, letter: "D", point: 4.0, description: "Satisfactory" },
      { minPercentage: 40, maxPercentage: 49.9, letter: "E", point: 3.0, description: "Sufficient" },
      { minPercentage: 30, maxPercentage: 39.9, letter: "F", point: 2.0, description: "Weak" },
      { minPercentage: 20, maxPercentage: 29.9, letter: "G", point: 1.0, description: "Very Weak" },
      { minPercentage: 0, maxPercentage: 19.9, letter: "U", point: 0.0, description: "Ungraded" },
    ],
    caWeight: 0.4,
    examWeight: 0.6,
    passThreshold: 40,
    performanceTiers: { top: 90, aboveAverage: 70, average: 40 },
  },

  ib_pyp: {
    name: "IB PYP Descriptive",
    gradeMappings: [
      { minPercentage: 80, maxPercentage: 100, letter: "Exceeding", point: 4.0, description: "Exceeding expectations" },
      { minPercentage: 60, maxPercentage: 79.9, letter: "Meeting", point: 3.0, description: "Meeting expectations" },
      { minPercentage: 40, maxPercentage: 59.9, letter: "Approaching", point: 2.0, description: "Approaching expectations" },
      { minPercentage: 0, maxPercentage: 39.9, letter: "Beginning", point: 1.0, description: "Beginning" },
    ],
    caWeight: 1.0,
    examWeight: 0.0,
    passThreshold: 0,
    performanceTiers: { top: 80, aboveAverage: 60, average: 40 },
  },

  ib_myp: {
    name: "IB MYP Achievement Levels",
    gradeMappings: [
      { minPercentage: 86, maxPercentage: 100, letter: "7", point: 7.0, description: "Excellent" },
      { minPercentage: 72, maxPercentage: 85.9, letter: "6", point: 6.0, description: "Very Good" },
      { minPercentage: 58, maxPercentage: 71.9, letter: "5", point: 5.0, description: "Good" },
      { minPercentage: 43, maxPercentage: 57.9, letter: "4", point: 4.0, description: "Satisfactory" },
      { minPercentage: 29, maxPercentage: 42.9, letter: "3", point: 3.0, description: "Mediocre" },
      { minPercentage: 15, maxPercentage: 28.9, letter: "2", point: 2.0, description: "Poor" },
      { minPercentage: 0, maxPercentage: 14.9, letter: "1", point: 1.0, description: "Very Poor" },
    ],
    caWeight: 0.5,
    examWeight: 0.5,
    passThreshold: 29,
    performanceTiers: { top: 86, aboveAverage: 72, average: 43 },
  },

  british_nc: {
    name: "English National Curriculum Standards",
    gradeMappings: [
      { minPercentage: 80, maxPercentage: 100, letter: "GD", point: 3.0, description: "Greater Depth" },
      { minPercentage: 60, maxPercentage: 79.9, letter: "EXS", point: 2.0, description: "Expected Standard" },
      { minPercentage: 40, maxPercentage: 59.9, letter: "WTS", point: 1.0, description: "Working Towards Standard" },
      { minPercentage: 0, maxPercentage: 39.9, letter: "BLW", point: 0.0, description: "Below Expectations" },
    ],
    caWeight: 0.6,
    examWeight: 0.4,
    passThreshold: 0,
    performanceTiers: { top: 80, aboveAverage: 60, average: 40 },
  },

  american: {
    name: "US Standard GPA Scale",
    gradeMappings: [
      { minPercentage: 97, maxPercentage: 100, letter: "A+", point: 4.0, description: "Outstanding" },
      { minPercentage: 93, maxPercentage: 96.9, letter: "A", point: 4.0, description: "Excellent" },
      { minPercentage: 90, maxPercentage: 92.9, letter: "A-", point: 3.7, description: "Excellent" },
      { minPercentage: 87, maxPercentage: 89.9, letter: "B+", point: 3.3, description: "Very Good" },
      { minPercentage: 83, maxPercentage: 86.9, letter: "B", point: 3.0, description: "Good" },
      { minPercentage: 80, maxPercentage: 82.9, letter: "B-", point: 2.7, description: "Good" },
      { minPercentage: 77, maxPercentage: 79.9, letter: "C+", point: 2.3, description: "Above Average" },
      { minPercentage: 73, maxPercentage: 76.9, letter: "C", point: 2.0, description: "Average" },
      { minPercentage: 70, maxPercentage: 72.9, letter: "C-", point: 1.7, description: "Below Average" },
      { minPercentage: 67, maxPercentage: 69.9, letter: "D+", point: 1.3, description: "Poor" },
      { minPercentage: 63, maxPercentage: 66.9, letter: "D", point: 1.0, description: "Poor" },
      { minPercentage: 60, maxPercentage: 62.9, letter: "D-", point: 0.7, description: "Very Poor" },
      { minPercentage: 0, maxPercentage: 59.9, letter: "F", point: 0.0, description: "Failing" },
    ],
    caWeight: 0.5,
    examWeight: 0.5,
    passThreshold: 60,
    performanceTiers: { top: 90, aboveAverage: 75, average: 60 },
  },

  hybrid: {
    name: "Custom Scale",
    gradeMappings: [
      { minPercentage: 80, maxPercentage: 100, letter: "A", point: 4.0, description: "Excellent" },
      { minPercentage: 70, maxPercentage: 79.9, letter: "B", point: 3.0, description: "Very Good" },
      { minPercentage: 60, maxPercentage: 69.9, letter: "C", point: 2.0, description: "Good" },
      { minPercentage: 50, maxPercentage: 59.9, letter: "D", point: 1.0, description: "Pass" },
      { minPercentage: 0, maxPercentage: 49.9, letter: "F", point: 0.0, description: "Fail" },
    ],
    caWeight: 0.4,
    examWeight: 0.6,
    passThreshold: 50,
    performanceTiers: { top: 80, aboveAverage: 65, average: 50 },
  },
};

export function getGradingPreset(code: CurriculumCode): GradingPreset {
  return GRADING_PRESETS[code] ?? GRADING_PRESETS.ghana_nacca;
}
