import type { CurriculumCode as ProfileCurriculumCode } from "./curriculum-profiles";
import type {
  CurriculumCode,
  LessonNoteTemplateVariant,
  SubjectOfferingGradeBand,
  SubjectOfferingStage,
} from "@/models/SubjectOffering";

export type SubjectCategory =
  | "core"
  | "elective"
  | "foundation"
  | "optional"
  | "learning_area"
  | "co_curricular"
  | "custom"
  | "transdisciplinary_theme"
  | "subject_group";

/** Stages where this subject can be taught. Empty = all stages. */
export interface SubjectTemplateEntry {
  name: string;
  code?: string;
  category: SubjectCategory;
  /** Stage names from grade templates (e.g. "Primary", "JHS"). Empty = all stages. */
  stages?: string[];
}

/** NaCCA basic-school subject stages. Preschool stages use learning areas instead. */
const NACCA_BASIC_STAGES = ["Primary", "JHS"] as const;

export type PreschoolLearningAreaGradeCode =
  | "CRECHE"
  | "NURSERY"
  | "KG1"
  | "KG2";

export const PRESCHOOL_LEARNING_AREA_TEMPLATES: Record<
  PreschoolLearningAreaGradeCode,
  string[]
> = {
  CRECHE: [
    "Communication & Language",
    "Personal, Social & Emotional Development",
    "Physical Development",
    "Fine Motor Skills",
    "Music & Movement",
    "Creative Play",
    "Sensory Play",
    "Story Time",
    "Health & Hygiene Routines",
    "Outdoor Play",
  ],
  NURSERY: [
    "Language & Literacy Readiness",
    "Phonics Awareness",
    "Pre-Writing",
    "Numeracy Readiness",
    "Creative Arts",
    "Music & Movement",
    "Our World / Environmental Awareness",
    "Religious & Moral Education",
    "Physical Education",
    "Practical Life Skills",
    "Story Time",
  ],
  KG1: [
    "Language & Literacy",
    "Phonics",
    "Pre-Reading",
    "Pre-Writing / Handwriting",
    "Numeracy",
    "Creative Arts",
    "Music & Movement",
    "Our World and Our People",
    "Religious & Moral Education",
    "Physical Education",
    "Ghanaian Language",
    "Computing Readiness",
    "Story Time",
  ],
  KG2: [
    "Language & Literacy",
    "Reading",
    "Phonics",
    "Writing / Handwriting",
    "Numeracy / Mathematics",
    "Creative Arts",
    "Music & Movement",
    "Our World and Our People",
    "Religious & Moral Education",
    "Physical Education",
    "Ghanaian Language",
    "Computing Readiness",
    "Story Time / Library",
  ],
};

function normalizeGradeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}

export function getPreschoolLearningAreaGradeCode(input: {
  code?: string | null;
  name?: string | null;
}): PreschoolLearningAreaGradeCode | null {
  const code = normalizeGradeKey(input.code);
  const name = normalizeGradeKey(input.name);
  const candidates = [code, name];

  if (candidates.some((value) => value === "CRECHE" || value === "CRÈCHE")) {
    return "CRECHE";
  }
  if (candidates.some((value) => value === "NURSERY")) return "NURSERY";
  if (candidates.some((value) => value === "KG1" || value === "KINDERGARTEN1")) {
    return "KG1";
  }
  if (candidates.some((value) => value === "KG2" || value === "KINDERGARTEN2")) {
    return "KG2";
  }
  return null;
}

export function isPreschoolLearningAreaGrade(input: {
  code?: string | null;
  name?: string | null;
}): boolean {
  return getPreschoolLearningAreaGradeCode(input) !== null;
}

export function getPreschoolLearningAreaNames(input: {
  code?: string | null;
  name?: string | null;
}): string[] {
  const gradeCode = getPreschoolLearningAreaGradeCode(input);
  return gradeCode ? PRESCHOOL_LEARNING_AREA_TEMPLATES[gradeCode] : [];
}

export const CURRICULUM_SUBJECT_TEMPLATES: Record<
  ProfileCurriculumCode,
  SubjectTemplateEntry[]
> = {
  ghana_nacca: [
    { name: "English", code: "ENG", category: "core", stages: [...NACCA_BASIC_STAGES] },
    { name: "Mathematics", code: "MATH", category: "core", stages: [...NACCA_BASIC_STAGES] },
    { name: "Science", code: "SCI", category: "core", stages: ["Primary", "JHS"] },
    { name: "Ghanaian Language", code: "GHA", category: "core", stages: [...NACCA_BASIC_STAGES] },
    { name: "Creative Arts", code: "ART", category: "core", stages: [...NACCA_BASIC_STAGES] },
    { name: "Religious and Moral Education", code: "RME", category: "core", stages: [...NACCA_BASIC_STAGES] },
    { name: "Physical Education", code: "PE", category: "core", stages: [...NACCA_BASIC_STAGES] },
    { name: "History", code: "HIST", category: "core", stages: ["Primary", "JHS"] },
    { name: "Our World Our People", code: "OWOP", category: "core", stages: ["Primary", "JHS"] },
    { name: "Computing", code: "ICT", category: "core", stages: ["Primary", "JHS"] },
    { name: "French", code: "FRE", category: "elective", stages: ["Primary", "JHS"] },
    { name: "Basic Design and Technology", code: "BDT", category: "elective", stages: ["JHS"] },
  ],

  cambridge: [
    { name: "English", code: "ENG", category: "core", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "Mathematics", code: "MATH", category: "core", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "Science", code: "SCI", category: "core", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "ICT", code: "ICT", category: "core", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "Global Perspectives", code: "GP", category: "core", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "Art & Design", code: "ART", category: "foundation", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "Music", code: "MUS", category: "foundation", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "Physical Education", code: "PE", category: "foundation", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "French", code: "FRE", category: "elective", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
    { name: "Spanish", code: "SPA", category: "elective", stages: ["Cambridge Primary", "Cambridge Lower Secondary"] },
  ],

  ib_pyp: [
    { name: "Language", code: "LANG", category: "transdisciplinary_theme", stages: ["Early Years", "PYP"] },
    { name: "Mathematics", code: "MATH", category: "transdisciplinary_theme", stages: ["Early Years", "PYP"] },
    { name: "Science", code: "SCI", category: "transdisciplinary_theme", stages: ["Early Years", "PYP"] },
    { name: "Social Studies", code: "SOC", category: "transdisciplinary_theme", stages: ["Early Years", "PYP"] },
    { name: "Arts", code: "ART", category: "transdisciplinary_theme", stages: ["Early Years", "PYP"] },
    { name: "Personal, Social & Physical Education", code: "PSPE", category: "transdisciplinary_theme", stages: ["Early Years", "PYP"] },
  ],

  ib_myp: [
    { name: "Language & Literature", code: "LL", category: "subject_group", stages: ["MYP"] },
    { name: "Language Acquisition", code: "LA", category: "subject_group", stages: ["MYP"] },
    { name: "Individuals & Societies", code: "IS", category: "subject_group", stages: ["MYP"] },
    { name: "Sciences", code: "SCI", category: "subject_group", stages: ["MYP"] },
    { name: "Mathematics", code: "MATH", category: "subject_group", stages: ["MYP"] },
    { name: "Arts", code: "ART", category: "subject_group", stages: ["MYP"] },
    { name: "Physical & Health Education", code: "PHE", category: "subject_group", stages: ["MYP"] },
    { name: "Design", code: "DES", category: "subject_group", stages: ["MYP"] },
  ],

  british_nc: [
    { name: "English", code: "ENG", category: "core", stages: ["EYFS", "Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Mathematics", code: "MATH", category: "core", stages: ["EYFS", "Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Science", code: "SCI", category: "core", stages: ["Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "History", code: "HIST", category: "foundation", stages: ["Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Geography", code: "GEO", category: "foundation", stages: ["Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Art & Design", code: "ART", category: "foundation", stages: ["EYFS", "Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Music", code: "MUS", category: "foundation", stages: ["EYFS", "Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Physical Education", code: "PE", category: "foundation", stages: ["EYFS", "Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Computing", code: "ICT", category: "foundation", stages: ["Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Design & Technology", code: "DT", category: "foundation", stages: ["Key Stage 1", "Key Stage 2", "Key Stage 3"] },
    { name: "Modern Foreign Languages", code: "MFL", category: "foundation", stages: ["Key Stage 2", "Key Stage 3"] },
    { name: "Religious Education", code: "RE", category: "foundation", stages: ["Key Stage 1", "Key Stage 2", "Key Stage 3"] },
  ],

  american: [
    { name: "English Language Arts", code: "ELA", category: "core", stages: ["Elementary", "Middle School"] },
    { name: "Mathematics", code: "MATH", category: "core", stages: ["Elementary", "Middle School"] },
    { name: "Science", code: "SCI", category: "core", stages: ["Elementary", "Middle School"] },
    { name: "Social Studies", code: "SOC", category: "core", stages: ["Elementary", "Middle School"] },
    { name: "Physical Education", code: "PE", category: "core", stages: ["Elementary", "Middle School"] },
    { name: "Art", code: "ART", category: "elective", stages: ["Elementary", "Middle School"] },
    { name: "Music", code: "MUS", category: "elective", stages: ["Elementary", "Middle School"] },
    { name: "World Languages", code: "WL", category: "elective", stages: ["Elementary", "Middle School"] },
    { name: "Technology", code: "TECH", category: "elective", stages: ["Elementary", "Middle School"] },
    { name: "Health", code: "HLT", category: "elective", stages: ["Elementary", "Middle School"] },
  ],

  hybrid: [],
};

export const GHANA_SHS_SUBJECTS: SubjectTemplateEntry[] = [
  { name: "Core Mathematics", code: "CMATH", category: "core" },
  { name: "English Language", code: "ENG", category: "core" },
  { name: "Integrated Science", code: "ISCI", category: "core" },
  { name: "Social Studies", code: "SOC", category: "core" },
  { name: "Biology", code: "BIO", category: "elective" },
  { name: "Chemistry", code: "CHEM", category: "elective" },
  { name: "Physics", code: "PHY", category: "elective" },
  { name: "Geography", code: "GEO", category: "elective" },
  { name: "Economics", code: "ECON", category: "elective" },
  { name: "Government", code: "GOV", category: "elective" },
  { name: "Elective Mathematics", code: "EMATH", category: "elective" },
  { name: "Literature-in-English", code: "LIT", category: "elective" },
  { name: "ICT", code: "ICT", category: "elective" },
];

export function getSubjectTemplatesForCurriculum(
  curriculumCode: ProfileCurriculumCode,
  schoolType?: string
): SubjectTemplateEntry[] {
  if (curriculumCode === "ghana_nacca" && schoolType === "SHS") {
    return GHANA_SHS_SUBJECTS;
  }
  return CURRICULUM_SUBJECT_TEMPLATES[curriculumCode] ?? [];
}

export function getSubjectNamesForCurriculum(
  curriculumCode: ProfileCurriculumCode,
  schoolType?: string
): string[] {
  return getSubjectTemplatesForCurriculum(curriculumCode, schoolType).map(
    (s) => s.name
  );
}

/**
 * Get allowed stages for a subject by name (case-insensitive match).
 * Returns empty array if no match = allow all stages (permissive fallback).
 */
export function getAllowedStagesForSubject(
  subjectName: string,
  curriculumCode: ProfileCurriculumCode,
  schoolType?: string
): string[] {
  const templates = getSubjectTemplatesForCurriculum(curriculumCode, schoolType);
  const normalized = subjectName.trim().toLowerCase();
  const template = templates.find(
    (t) => t.name.trim().toLowerCase() === normalized
  );
  return template?.stages ?? [];
}

export type CurriculumSubjectOfferingTemplate = {
  curriculumCode: CurriculumCode;
  subjectFamily: string;
  displayName: string;
  shortName: string;
  code: string;
  stage: SubjectOfferingStage;
  gradeBand: SubjectOfferingGradeBand;
  gradeCodes: string[];
  category: SubjectCategory;
  lessonNoteTemplateVariant?: LessonNoteTemplateVariant;
  assessmentProfile?: string;
  reportCardGroup?: string;
  isDefault: boolean;
};

const PRESCHOOL_GRADE_CODES = ["CRECHE", "NURSERY", "KG1", "KG2"];
const LOWER_PRIMARY_GRADE_CODES = [
  "P1",
  "P2",
  "P3",
  "B1",
  "B2",
  "B3",
  "BASIC1",
  "BASIC2",
  "BASIC3",
  "PRIMARY1",
  "PRIMARY2",
  "PRIMARY3",
  "GRADE1",
  "GRADE2",
  "GRADE3",
];
const UPPER_PRIMARY_GRADE_CODES = [
  "P4",
  "P5",
  "P6",
  "B4",
  "B5",
  "B6",
  "BASIC4",
  "BASIC5",
  "BASIC6",
  "PRIMARY4",
  "PRIMARY5",
  "PRIMARY6",
  "GRADE4",
  "GRADE5",
  "GRADE6",
];
const JHS_GRADE_CODES = ["JHS1", "JHS2", "JHS3"];
const SHS_GRADE_CODES = ["SHS1", "SHS2", "SHS3"];

function naccaTemplate(input: Omit<CurriculumSubjectOfferingTemplate, "curriculumCode" | "isDefault"> & { isDefault?: boolean }): CurriculumSubjectOfferingTemplate {
  return { curriculumCode: "ghana_nacca", isDefault: input.isDefault ?? true, ...input };
}

export const CURRICULUM_SUBJECT_OFFERING_TEMPLATES: CurriculumSubjectOfferingTemplate[] = [
  naccaTemplate({
    subjectFamily: "Communication & Language",
    displayName: "Communication & Language - Early Years",
    shortName: "Communication & Language",
    code: "NACCA-EY-COMM-LANG",
    stage: "kg",
    gradeBand: "preschool",
    gradeCodes: PRESCHOOL_GRADE_CODES,
    category: "learning_area",
    lessonNoteTemplateVariant: "early_years_activity_plan",
    reportCardGroup: "Early Years",
  }),
  naccaTemplate({
    subjectFamily: "Numeracy Readiness",
    displayName: "Numeracy Readiness - Early Years",
    shortName: "Numeracy Readiness",
    code: "NACCA-EY-NUM",
    stage: "kg",
    gradeBand: "preschool",
    gradeCodes: PRESCHOOL_GRADE_CODES,
    category: "learning_area",
    lessonNoteTemplateVariant: "early_years_activity_plan",
    reportCardGroup: "Early Years",
  }),
  naccaTemplate({
    subjectFamily: "Creative Arts",
    displayName: "Creative Play / Creative Arts - Early Years",
    shortName: "Creative Arts",
    code: "NACCA-EY-CREATIVE",
    stage: "kg",
    gradeBand: "preschool",
    gradeCodes: PRESCHOOL_GRADE_CODES,
    category: "learning_area",
    lessonNoteTemplateVariant: "early_years_activity_plan",
    reportCardGroup: "Early Years",
  }),
  ...[
    ["English Language", "English Language", "ENG"],
    ["Mathematics", "Mathematics", "MATH"],
    ["Science", "Science", "SCI"],
    ["Our World and Our People", "Our World and Our People", "OWOP"],
    ["Religious and Moral Education", "Religious and Moral Education", "RME"],
    ["Creative Arts", "Creative Arts", "CARTS"],
    ["Computing", "Computing", "COMP"],
    ["Ghanaian Language", "Ghanaian Language", "GHL"],
    ["Physical Education", "Physical Education", "PE"],
  ].map(([family, name, code]) =>
    naccaTemplate({
      subjectFamily: family,
      displayName: `${name} - Lower Primary`,
      shortName: name,
      code: `NACCA-LP-${code}`,
      stage: "lower_primary",
      gradeBand: "lower_primary",
      gradeCodes: LOWER_PRIMARY_GRADE_CODES,
      category: "core",
      lessonNoteTemplateVariant: "nacca_primary",
      reportCardGroup: "Core",
    })
  ),
  ...[
    ["English Language", "English Language", "ENG"],
    ["Mathematics", "Mathematics", "MATH"],
    ["Science", "Science", "SCI"],
    ["Our World and Our People", "Our World and Our People", "OWOP"],
    ["Religious and Moral Education", "Religious and Moral Education", "RME"],
    ["Creative Arts", "Creative Arts", "CARTS"],
    ["Computing", "Computing", "COMP"],
    ["Ghanaian Language", "Ghanaian Language", "GHL"],
    ["Physical Education", "Physical Education", "PE"],
    ["French", "French", "FRE", "elective"],
  ].map(([family, name, code, category]) =>
    naccaTemplate({
      subjectFamily: family,
      displayName: `${name} - Upper Primary`,
      shortName: name,
      code: `NACCA-UP-${code}`,
      stage: "upper_primary",
      gradeBand: "upper_primary",
      gradeCodes: UPPER_PRIMARY_GRADE_CODES,
      category: (category as SubjectCategory | undefined) ?? "core",
      lessonNoteTemplateVariant: "nacca_primary",
      reportCardGroup: category === "elective" ? "Electives" : "Core",
    })
  ),
  ...[
    ["English Language", "English Language", "ENG"],
    ["Mathematics", "Mathematics", "MATH"],
    ["Science", "Science", "SCI"],
    ["Social Studies", "Social Studies", "SOC"],
    ["Computing", "Computing", "COMP"],
    ["Religious and Moral Education", "Religious and Moral Education", "RME"],
    ["Creative Arts and Design", "Creative Arts and Design", "CAD"],
    ["Career Technology", "Career Technology", "CTECH"],
    ["Ghanaian Language", "Ghanaian Language", "GHL"],
    ["Physical Education and Health", "Physical Education and Health", "PEH"],
    ["French", "French", "FRE", "elective"],
  ].map(([family, name, code, category]) =>
    naccaTemplate({
      subjectFamily: family,
      displayName: `${name} - JHS`,
      shortName: name,
      code: `NACCA-JHS-${code}`,
      stage: "jhs",
      gradeBand: "jhs",
      gradeCodes: JHS_GRADE_CODES,
      category: (category as SubjectCategory | undefined) ?? "core",
      lessonNoteTemplateVariant: "nacca_jhs",
      reportCardGroup: category === "elective" ? "Electives" : "Core",
    })
  ),
  naccaTemplate({
    subjectFamily: "Core Mathematics",
    displayName: "Core Mathematics - SHS",
    shortName: "Core Mathematics",
    code: "NACCA-SHS-CMATH",
    stage: "shs",
    gradeBand: "shs",
    gradeCodes: SHS_GRADE_CODES,
    category: "core",
    lessonNoteTemplateVariant: "classic",
    reportCardGroup: "Core",
  }),
  ...[
    ["Cambridge", "cambridge", "cambridge_primary", "custom", ["YEAR1", "YEAR2", "YEAR3", "YEAR4", "YEAR5", "YEAR6"]],
    ["Cambridge", "cambridge", "cambridge_lower_secondary", "custom", ["YEAR7", "YEAR8", "YEAR9"]],
  ].flatMap(([label, curriculumCode, stage, gradeBand, gradeCodes]) =>
    ["English", "Mathematics", "Science", "ICT", "Global Perspectives"].map((subject) => ({
      curriculumCode: curriculumCode as CurriculumCode,
      subjectFamily: subject,
      displayName: `${label} ${subject}`,
      shortName: subject,
      code: `${String(curriculumCode).toUpperCase()}-${String(stage).includes("lower") ? "LS" : "PRI"}-${subject.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
      stage: stage as SubjectOfferingStage,
      gradeBand: gradeBand as SubjectOfferingGradeBand,
      gradeCodes: gradeCodes as string[],
      category: "core" as SubjectCategory,
      lessonNoteTemplateVariant: "classic" as LessonNoteTemplateVariant,
      reportCardGroup: "Core",
      isDefault: true,
    }))
  ),
];

export function getSubjectOfferingTemplatesForCurriculum(
  curriculumCode: CurriculumCode,
  schoolType?: string
): CurriculumSubjectOfferingTemplate[] {
  const templates = CURRICULUM_SUBJECT_OFFERING_TEMPLATES.filter(
    (template) => template.curriculumCode === curriculumCode
  );
  if (curriculumCode === "ghana_nacca" && schoolType !== "SHS") {
    return templates.filter((template) => template.gradeBand !== "shs");
  }
  return templates;
}
