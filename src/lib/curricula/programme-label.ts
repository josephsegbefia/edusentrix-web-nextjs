import { CURRICULUM_PROFILES, type CurriculumCode } from "@/constants/curriculum-profiles";

export function curriculumProgrammeLabel(code: string | null | undefined): string {
  if (!code) return "";
  return CURRICULUM_PROFILES[code as CurriculumCode]?.label ?? code;
}
