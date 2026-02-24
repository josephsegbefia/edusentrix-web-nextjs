import type { CurriculumCode } from "./curriculum-profiles";

export interface GradeTemplateEntry {
  name: string;
  code: string;
  stage: string;
  order: number;
}

export const CURRICULUM_GRADE_TEMPLATES: Record<
  CurriculumCode,
  GradeTemplateEntry[]
> = {
  ghana_nacca: [
    { name: "Creche", code: "CRECHE", stage: "Pre-Primary", order: 1 },
    { name: "Nursery", code: "NURSERY", stage: "Pre-Primary", order: 2 },
    { name: "KG1", code: "KG1", stage: "Kindergarten", order: 3 },
    { name: "KG2", code: "KG2", stage: "Kindergarten", order: 4 },
    { name: "Primary 1", code: "P1", stage: "Primary", order: 5 },
    { name: "Primary 2", code: "P2", stage: "Primary", order: 6 },
    { name: "Primary 3", code: "P3", stage: "Primary", order: 7 },
    { name: "Primary 4", code: "P4", stage: "Primary", order: 8 },
    { name: "Primary 5", code: "P5", stage: "Primary", order: 9 },
    { name: "Primary 6", code: "P6", stage: "Primary", order: 10 },
    { name: "JHS 1", code: "JHS1", stage: "JHS", order: 11 },
    { name: "JHS 2", code: "JHS2", stage: "JHS", order: 12 },
    { name: "JHS 3", code: "JHS3", stage: "JHS", order: 13 },
  ],

  cambridge: [
    { name: "Year 1", code: "Y1", stage: "Cambridge Primary", order: 1 },
    { name: "Year 2", code: "Y2", stage: "Cambridge Primary", order: 2 },
    { name: "Year 3", code: "Y3", stage: "Cambridge Primary", order: 3 },
    { name: "Year 4", code: "Y4", stage: "Cambridge Primary", order: 4 },
    { name: "Year 5", code: "Y5", stage: "Cambridge Primary", order: 5 },
    { name: "Year 6", code: "Y6", stage: "Cambridge Primary", order: 6 },
    { name: "Year 7", code: "Y7", stage: "Cambridge Lower Secondary", order: 7 },
    { name: "Year 8", code: "Y8", stage: "Cambridge Lower Secondary", order: 8 },
    { name: "Year 9", code: "Y9", stage: "Cambridge Lower Secondary", order: 9 },
  ],

  ib_pyp: [
    { name: "PYP Early Years", code: "PYP-EY", stage: "Early Years", order: 1 },
    { name: "PYP Year 1", code: "PYP1", stage: "PYP", order: 2 },
    { name: "PYP Year 2", code: "PYP2", stage: "PYP", order: 3 },
    { name: "PYP Year 3", code: "PYP3", stage: "PYP", order: 4 },
    { name: "PYP Year 4", code: "PYP4", stage: "PYP", order: 5 },
    { name: "PYP Year 5", code: "PYP5", stage: "PYP", order: 6 },
    { name: "PYP Year 6", code: "PYP6", stage: "PYP", order: 7 },
  ],

  ib_myp: [
    { name: "MYP Year 1", code: "MYP1", stage: "MYP", order: 1 },
    { name: "MYP Year 2", code: "MYP2", stage: "MYP", order: 2 },
    { name: "MYP Year 3", code: "MYP3", stage: "MYP", order: 3 },
    { name: "MYP Year 4", code: "MYP4", stage: "MYP", order: 4 },
    { name: "MYP Year 5", code: "MYP5", stage: "MYP", order: 5 },
  ],

  british_nc: [
    { name: "Reception", code: "REC", stage: "EYFS", order: 1 },
    { name: "Year 1", code: "Y1", stage: "Key Stage 1", order: 2 },
    { name: "Year 2", code: "Y2", stage: "Key Stage 1", order: 3 },
    { name: "Year 3", code: "Y3", stage: "Key Stage 2", order: 4 },
    { name: "Year 4", code: "Y4", stage: "Key Stage 2", order: 5 },
    { name: "Year 5", code: "Y5", stage: "Key Stage 2", order: 6 },
    { name: "Year 6", code: "Y6", stage: "Key Stage 2", order: 7 },
    { name: "Year 7", code: "Y7", stage: "Key Stage 3", order: 8 },
    { name: "Year 8", code: "Y8", stage: "Key Stage 3", order: 9 },
    { name: "Year 9", code: "Y9", stage: "Key Stage 3", order: 10 },
  ],

  american: [
    { name: "Kindergarten", code: "K", stage: "Elementary", order: 1 },
    { name: "Grade 1", code: "G1", stage: "Elementary", order: 2 },
    { name: "Grade 2", code: "G2", stage: "Elementary", order: 3 },
    { name: "Grade 3", code: "G3", stage: "Elementary", order: 4 },
    { name: "Grade 4", code: "G4", stage: "Elementary", order: 5 },
    { name: "Grade 5", code: "G5", stage: "Elementary", order: 6 },
    { name: "Grade 6", code: "G6", stage: "Middle School", order: 7 },
    { name: "Grade 7", code: "G7", stage: "Middle School", order: 8 },
    { name: "Grade 8", code: "G8", stage: "Middle School", order: 9 },
  ],

  hybrid: [],
};

export const GHANA_SHS_GRADES: GradeTemplateEntry[] = [
  { name: "SHS 1", code: "SHS1", stage: "SHS", order: 1 },
  { name: "SHS 2", code: "SHS2", stage: "SHS", order: 2 },
  { name: "SHS 3", code: "SHS3", stage: "SHS", order: 3 },
];

export function getGradeTemplatesForCurriculum(
  curriculumCode: CurriculumCode,
  schoolType?: string
): GradeTemplateEntry[] {
  if (curriculumCode === "ghana_nacca" && schoolType === "SHS") {
    return GHANA_SHS_GRADES;
  }
  return CURRICULUM_GRADE_TEMPLATES[curriculumCode] ?? [];
}
