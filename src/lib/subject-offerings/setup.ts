import mongoose, { type Types } from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade, type IGrade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import {
  SubjectOffering,
  type CurriculumCode,
  type ISubjectOffering,
} from "@/models/SubjectOffering";
import {
  getSubjectOfferingTemplatesForCurriculum,
  isPreschoolLearningAreaGrade,
  type CurriculumSubjectOfferingTemplate,
} from "@/constants/curriculum-subject-templates";
import { gradeMatchesTemplateCode } from "./grade-bands";

type SetupPayload = {
  schoolId: Types.ObjectId | string;
  curriculumCode: CurriculumCode;
  selectedOfferingCodes: string[];
  gradeIds: string[];
  autoAssignToMatchingClassGroups: boolean;
  schoolType?: string;
};

export type SetupSubjectOfferingsResult = {
  createdSubjects: number;
  createdOfferings: number;
  assignedClassGroups: number;
  skippedExisting: number;
  warnings: string[];
};

function normalizeSubjectKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function toObjectId(value: string | Types.ObjectId): Types.ObjectId {
  return typeof value === "string" ? new mongoose.Types.ObjectId(value) : value;
}

async function ensureSubjectFamily(
  schoolId: Types.ObjectId,
  template: CurriculumSubjectOfferingTemplate
): Promise<{ subjectId: Types.ObjectId; created: boolean }> {
  const normalizedKey = normalizeSubjectKey(template.subjectFamily);
  const existing = await Subject.findOne({
    schoolId,
    $or: [{ normalizedKey }, { name: template.subjectFamily }],
  })
    .collation({ locale: "en", strength: 2 })
    .select("_id normalizedKey")
    .lean();
  if (existing?._id) {
    if (!existing.normalizedKey) {
      await Subject.updateOne(
        { _id: existing._id, schoolId },
        { $set: { normalizedKey } }
      );
    }
    return { subjectId: existing._id as Types.ObjectId, created: false };
  }

  try {
    const created = await Subject.create({
      schoolId,
      name: template.subjectFamily,
      normalizedKey,
      code: null,
      category: template.category,
      isActive: true,
    });
    return { subjectId: created._id, created: true };
  } catch (error: unknown) {
    const duplicateName =
      error instanceof Error &&
      (error.message.includes("E11000") || error.message.includes("duplicate key"));
    if (!duplicateName) throw error;

    const fallback = await Subject.findOne({ schoolId, name: template.subjectFamily })
      .collation({ locale: "en", strength: 2 })
      .select("_id normalizedKey")
      .lean();
    if (!fallback?._id) throw error;
    if (!fallback.normalizedKey) {
      await Subject.updateOne(
        { _id: fallback._id, schoolId },
        { $set: { normalizedKey } }
      );
    }
    return { subjectId: fallback._id as Types.ObjectId, created: false };
  }
}

export async function setupSubjectOfferingsFromCurriculum(
  payload: SetupPayload
): Promise<SetupSubjectOfferingsResult> {
  const schoolId = toObjectId(payload.schoolId);
  const selectedCodes = new Set(payload.selectedOfferingCodes.map((code) => code.trim().toUpperCase()));
  const requestedGradeIds = payload.gradeIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const templates = getSubjectOfferingTemplatesForCurriculum(
    payload.curriculumCode,
    payload.schoolType
  ).filter((template) => selectedCodes.has(template.code));

  const grades = await Grade.find({
    schoolId,
    _id: { $in: requestedGradeIds },
    isActive: { $ne: false },
  })
    .select("_id name code stage order")
    .lean<IGrade[]>();
  const eligibleGrades = grades.filter((grade) => !isPreschoolLearningAreaGrade(grade));

  const warnings: string[] = [];
  let createdSubjects = 0;
  let createdOfferings = 0;
  let skippedExisting = 0;
  let assignedClassGroups = 0;

  for (const template of templates) {
    const matchingGrades = eligibleGrades.filter((grade) =>
      gradeMatchesTemplateCode(grade, template.gradeCodes)
    );
    if (matchingGrades.length === 0) {
      warnings.push(`${template.displayName} has no matching active grades.`);
      continue;
    }

    const { subjectId, created } = await ensureSubjectFamily(schoolId, template);
    if (created) createdSubjects += 1;

    const existing = await SubjectOffering.findOne({
      schoolId,
      curriculumCode: template.curriculumCode,
      code: template.code,
    }).select("_id").lean();

    if (existing?._id) {
      skippedExisting += 1;
      if (payload.autoAssignToMatchingClassGroups) {
        const classUpdate = await ClassGroup.updateMany(
          { schoolId, gradeId: { $in: matchingGrades.map((grade) => grade._id) } },
          {
            $addToSet: {
              subjectOfferingIds: existing._id,
              subjectIds: subjectId,
            },
          }
        );
        assignedClassGroups += classUpdate.modifiedCount ?? 0;
      }
      continue;
    }

    const offering = await SubjectOffering.create({
      schoolId,
      subjectId,
      curriculumCode: template.curriculumCode,
      subjectFamily: template.subjectFamily,
      displayName: template.displayName,
      shortName: template.shortName,
      code: template.code,
      stage: template.stage,
      gradeBand: template.gradeBand,
      gradeIds: matchingGrades.map((grade) => grade._id),
      category: template.category,
      lessonNoteTemplateVariant: template.lessonNoteTemplateVariant ?? "classic",
      reportCardGroup: template.reportCardGroup ?? null,
      isActive: true,
    }) as ISubjectOffering;
    createdOfferings += 1;

    if (payload.autoAssignToMatchingClassGroups) {
      const classUpdate = await ClassGroup.updateMany(
        { schoolId, gradeId: { $in: matchingGrades.map((grade) => grade._id) } },
        {
          $addToSet: {
            subjectOfferingIds: offering._id,
            subjectIds: subjectId,
          },
        }
      );
      assignedClassGroups += classUpdate.modifiedCount ?? 0;
    }
  }

  return {
    createdSubjects,
    createdOfferings,
    assignedClassGroups,
    skippedExisting,
    warnings,
  };
}
