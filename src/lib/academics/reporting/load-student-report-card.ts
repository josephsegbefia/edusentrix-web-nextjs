import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { ReportVerification } from "@/models/ReportVerification";
import { StudentReportCard, type IStudentReportCard } from "@/models/StudentReportCard";
import { Subject } from "@/models/Subject";
import type { StudentReportCardStatus } from "@/types/academics/assessment-engine";

export type StudentReportCardViewContext = {
  subjectNamesById: Map<string, string>;
  period: { yearLabel: string; term: string };
  gradeName: string | null;
  classGroupName: string | null;
  classGroupLabel: string | null;
  verificationId: string | null;
};

const DEFAULT_VIEW_STATUSES: StudentReportCardStatus[] = ["released"];

export async function findStudentReportCard(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  academicPeriodId?: mongoose.Types.ObjectId | null;
  statuses?: StudentReportCardStatus[];
  studentReportCardId?: mongoose.Types.ObjectId | null;
}): Promise<IStudentReportCard | null> {
  if (input.studentReportCardId) {
    return StudentReportCard.findOne({
      _id: input.studentReportCardId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      ...(input.statuses?.length ? { status: { $in: input.statuses } } : {}),
    }).lean();
  }

  if (!input.academicPeriodId) {
    return null;
  }

  return StudentReportCard.findOne({
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: input.academicPeriodId,
    status: { $in: input.statuses ?? DEFAULT_VIEW_STATUSES },
  })
    .sort({ releasedAt: -1, updatedAt: -1 })
    .lean();
}

export async function listReleasedStudentReportCards(input: {
  schoolId: mongoose.Types.ObjectId;
  studentIds: mongoose.Types.ObjectId[];
  academicPeriodIds?: mongoose.Types.ObjectId[];
}) {
  const query: Record<string, unknown> = {
    schoolId: input.schoolId,
    studentId: { $in: input.studentIds },
    status: "released",
  };

  if (input.academicPeriodIds?.length) {
    query.academicPeriodId = { $in: input.academicPeriodIds };
  }

  return StudentReportCard.find(query)
    .select(
      "_id studentId academicPeriodId classGroupId status releasedAt termSummarySnapshot studentSnapshot"
    )
    .sort({ releasedAt: -1 })
    .lean();
}

export async function loadStudentReportCardViewContext(
  card: IStudentReportCard
): Promise<StudentReportCardViewContext> {
  const subjectIds = [
    ...new Set(
      (card.subjectResultsSnapshot as Array<{ subjectId?: string }>).map((row) =>
        String(row.subjectId ?? "")
      )
    ),
  ].filter(Boolean);

  const [subjects, period, grade, classGroup, verification] = await Promise.all([
    subjectIds.length
      ? Subject.find({
          _id: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
          schoolId: card.schoolId,
        })
          .select("_id name")
          .lean()
      : Promise.resolve([]),
    AcademicPeriod.findById(card.academicPeriodId).select("yearLabel term").lean(),
    Grade.findById(card.gradeId).select("name").lean(),
    ClassGroup.findById(card.classGroupId).select("name").lean(),
    card.verificationId
      ? ReportVerification.findById(card.verificationId).select("verificationId").lean()
      : Promise.resolve(null),
  ]);

  const subjectNamesById = new Map(subjects.map((subject) => [String(subject._id), subject.name]));
  const gradeName = grade?.name ?? null;
  const classGroupName = classGroup?.name ?? null;
  const classGroupLabel =
    gradeName && classGroupName ? `${gradeName} ${classGroupName}`.trim() : classGroupName;

  return {
    subjectNamesById,
    period: {
      yearLabel: period?.yearLabel ?? "",
      term: period?.term ?? "",
    },
    gradeName,
    classGroupName,
    classGroupLabel,
    verificationId: verification?.verificationId ?? null,
  };
}
