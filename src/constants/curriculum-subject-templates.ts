import type { CurriculumCode } from "./curriculum-profiles";

export type SubjectCategory =
  | "core"
  | "elective"
  | "foundation"
  | "optional"
  | "transdisciplinary_theme"
  | "subject_group";

export interface SubjectTemplateEntry {
  name: string;
  code?: string;
  category: SubjectCategory;
}

export const CURRICULUM_SUBJECT_TEMPLATES: Record<
  CurriculumCode,
  SubjectTemplateEntry[]
> = {
  ghana_nacca: [
    { name: "English", code: "ENG", category: "core" },
    { name: "Mathematics", code: "MATH", category: "core" },
    { name: "Science", code: "SCI", category: "core" },
    { name: "Ghanaian Language", code: "GHA", category: "core" },
    { name: "Creative Arts", code: "ART", category: "core" },
    { name: "Religious and Moral Education", code: "RME", category: "core" },
    { name: "Physical Education", code: "PE", category: "core" },
    { name: "History", code: "HIST", category: "core" },
    { name: "Our World Our People", code: "OWOP", category: "core" },
    { name: "Computing", code: "ICT", category: "core" },
    { name: "French", code: "FRE", category: "elective" },
    { name: "Basic Design and Technology", code: "BDT", category: "elective" },
  ],

  cambridge: [
    { name: "English", code: "ENG", category: "core" },
    { name: "Mathematics", code: "MATH", category: "core" },
    { name: "Science", code: "SCI", category: "core" },
    { name: "ICT", code: "ICT", category: "core" },
    { name: "Global Perspectives", code: "GP", category: "core" },
    { name: "Art & Design", code: "ART", category: "foundation" },
    { name: "Music", code: "MUS", category: "foundation" },
    { name: "Physical Education", code: "PE", category: "foundation" },
    { name: "French", code: "FRE", category: "elective" },
    { name: "Spanish", code: "SPA", category: "elective" },
  ],

  ib_pyp: [
    { name: "Language", code: "LANG", category: "transdisciplinary_theme" },
    { name: "Mathematics", code: "MATH", category: "transdisciplinary_theme" },
    { name: "Science", code: "SCI", category: "transdisciplinary_theme" },
    { name: "Social Studies", code: "SOC", category: "transdisciplinary_theme" },
    { name: "Arts", code: "ART", category: "transdisciplinary_theme" },
    { name: "Personal, Social & Physical Education", code: "PSPE", category: "transdisciplinary_theme" },
  ],

  ib_myp: [
    { name: "Language & Literature", code: "LL", category: "subject_group" },
    { name: "Language Acquisition", code: "LA", category: "subject_group" },
    { name: "Individuals & Societies", code: "IS", category: "subject_group" },
    { name: "Sciences", code: "SCI", category: "subject_group" },
    { name: "Mathematics", code: "MATH", category: "subject_group" },
    { name: "Arts", code: "ART", category: "subject_group" },
    { name: "Physical & Health Education", code: "PHE", category: "subject_group" },
    { name: "Design", code: "DES", category: "subject_group" },
  ],

  british_nc: [
    { name: "English", code: "ENG", category: "core" },
    { name: "Mathematics", code: "MATH", category: "core" },
    { name: "Science", code: "SCI", category: "core" },
    { name: "History", code: "HIST", category: "foundation" },
    { name: "Geography", code: "GEO", category: "foundation" },
    { name: "Art & Design", code: "ART", category: "foundation" },
    { name: "Music", code: "MUS", category: "foundation" },
    { name: "Physical Education", code: "PE", category: "foundation" },
    { name: "Computing", code: "ICT", category: "foundation" },
    { name: "Design & Technology", code: "DT", category: "foundation" },
    { name: "Modern Foreign Languages", code: "MFL", category: "foundation" },
    { name: "Religious Education", code: "RE", category: "foundation" },
  ],

  american: [
    { name: "English Language Arts", code: "ELA", category: "core" },
    { name: "Mathematics", code: "MATH", category: "core" },
    { name: "Science", code: "SCI", category: "core" },
    { name: "Social Studies", code: "SOC", category: "core" },
    { name: "Physical Education", code: "PE", category: "core" },
    { name: "Art", code: "ART", category: "elective" },
    { name: "Music", code: "MUS", category: "elective" },
    { name: "World Languages", code: "WL", category: "elective" },
    { name: "Technology", code: "TECH", category: "elective" },
    { name: "Health", code: "HLT", category: "elective" },
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
  curriculumCode: CurriculumCode,
  schoolType?: string
): SubjectTemplateEntry[] {
  if (curriculumCode === "ghana_nacca" && schoolType === "SHS") {
    return GHANA_SHS_SUBJECTS;
  }
  return CURRICULUM_SUBJECT_TEMPLATES[curriculumCode] ?? [];
}

export function getSubjectNamesForCurriculum(
  curriculumCode: CurriculumCode,
  schoolType?: string
): string[] {
  return getSubjectTemplatesForCurriculum(curriculumCode, schoolType).map(
    (s) => s.name
  );
}
