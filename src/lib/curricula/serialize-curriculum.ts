import type { ICurriculum } from "@/models/Curriculum";

export function serializeCurriculumApi(
  row: ICurriculum,
  extras?: { matchesSchoolCurriculum?: boolean }
) {
  return {
    id: String(row._id),
    title: row.title,
    code: row.code,
    schoolCurriculumCode: row.schoolCurriculumCode ?? null,
    description: row.description ?? null,
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    ...(extras?.matchesSchoolCurriculum !== undefined
      ? { matchesSchoolCurriculum: extras.matchesSchoolCurriculum }
      : {}),
  };
}
