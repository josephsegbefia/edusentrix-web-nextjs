// src/lib/academics/calculateClassAverages.ts
import mongoose from "mongoose";
import { Student } from "@/models/Student";
import { SubjectGrade } from "@/models/SubjectGrade";

type IdLike = string | mongoose.Types.ObjectId;

function toStringId(id: IdLike | undefined | null): string | null {
  if (!id) return null;
  return id instanceof mongoose.Types.ObjectId ? id.toString() : String(id);
}

/**
 * Calculate class averages for all subjects in a class group for a given term.
 * Returns a map of subjectId -> average score.
 */
export async function calculateClassAverages(params: {
  schoolId: IdLike;
  classGroupId: IdLike;
  academicPeriodId: IdLike;
}): Promise<Record<string, number>> {
  const { schoolId, classGroupId, academicPeriodId } = params;

  const schoolKey = toStringId(schoolId);
  const classGroupKey = toStringId(classGroupId);
  const periodKey = toStringId(academicPeriodId);

  if (!schoolKey || !classGroupKey || !periodKey) {
    return {};
  }

  // Find all active students in this class group
  const students = await Student.find({
    schoolId: schoolKey,
    classGroupId: classGroupKey,
    status: "active",
  })
    .select("_id")
    .lean();

  const studentIds = students.map((s) => s._id.toString());

  if (studentIds.length === 0) {
    return {};
  }

  // Aggregate subject grades for all students in this class group
  const subjectAverages = await SubjectGrade.aggregate([
    {
      $match: {
        schoolId: new mongoose.Types.ObjectId(schoolKey),
        academicPeriodId: new mongoose.Types.ObjectId(periodKey),
        studentId: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    {
      $group: {
        _id: "$subjectId",
        totalScore: { $sum: "$totalScore" },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        subjectId: { $toString: "$_id" },
        average: {
          $cond: [{ $gt: ["$count", 0] }, { $divide: ["$totalScore", "$count"] }, 0],
        },
      },
    },
  ]);

  const result: Record<string, number> = {};
  for (const item of subjectAverages) {
    result[item.subjectId] = Number(item.average.toFixed(2));
  }

  return result;
}
