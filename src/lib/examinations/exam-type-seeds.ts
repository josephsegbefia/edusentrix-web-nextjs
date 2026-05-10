import type { Types } from "mongoose";
import {
  DEFAULT_EXAM_TYPE_SEEDS,
  EXAM_QUESTION_TYPES,
} from "@/constants/examinations";
import { ExamType } from "@/models/ExamType";

const DEFAULT_ALLOWED_QUESTION_TYPES = EXAM_QUESTION_TYPES.filter((type) =>
  [
    "multiple_choice",
    "true_false",
    "short_answer",
    "essay",
    "structured",
    "fill_blank",
    "matching",
    "practical",
    "oral",
    "project_based",
  ].includes(type)
);

export async function ensureDefaultExamTypesForSchool(schoolId: Types.ObjectId) {
  await ExamType.bulkWrite(
    DEFAULT_EXAM_TYPE_SEEDS.map((name) => ({
      updateOne: {
        filter: { schoolId, name },
        update: {
          $setOnInsert: {
            schoolId,
            name,
            description: null,
            requiresApproval: true,
            appearsOnReportCard: false,
            contributesToFinalGrade: false,
            canBePrinted: true,
            allowCandidateNumbers: true,
            allowAnswerSheet: false,
            allowedQuestionTypes: DEFAULT_ALLOWED_QUESTION_TYPES,
            status: "active",
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}
