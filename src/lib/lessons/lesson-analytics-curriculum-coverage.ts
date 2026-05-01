import type { Types } from "mongoose";
import mongoose from "mongoose";
import { Lesson } from "@/models/Lesson";
import { Student } from "@/models/Student";
import { StudentLessonProgress } from "@/models/StudentLessonProgress";
import { completionRatioPercent } from "@/lib/lessons/completion-percent";

export type CurriculumCompletionInRange = {
  /** Published lessons with `publishedAt` in the range (status `published`). */
  publishedLessonsInRange: number;
  /**
   * Theoretical completion slots: for each such lesson, count of active students in its
   * `classGroupId` (summed across lessons; same student in multiple lessons counts multiple times).
   */
  studentSlotsTotal: number;
  /** `StudentLessonProgress` rows marked completed in the range for those lesson ids. */
  completionsForPublishedLessonsInRange: number;
  /** `100 * completions / studentSlotsTotal` when slots > 0; otherwise null. */
  coveragePercent: number | null;
};

/**
 * Curriculum-style completion: completions in range for lessons first published in the window,
 * divided by roster-weighted slots (active students per lesson class).
 *
 * When `teacherId` is set, only that teacher's lessons are considered.
 */
export async function getCurriculumCompletionForPublishedLessonsInRange(
  schoolId: Types.ObjectId,
  fromD: Date,
  toD: Date,
  teacherId?: Types.ObjectId
): Promise<CurriculumCompletionInRange> {
  const lessonMatch: Record<string, unknown> = {
    schoolId,
    status: "published",
    publishedAt: { $gte: fromD, $lte: toD },
  };
  if (teacherId) lessonMatch.teacherId = teacherId;

  const publishedRows = (await Lesson.find(lessonMatch)
    .select("_id classGroupId")
    .lean()) as Array<{ _id: Types.ObjectId; classGroupId: Types.ObjectId }>;

  const publishedLessonsInRange = publishedRows.length;

  if (publishedLessonsInRange === 0) {
    return {
      publishedLessonsInRange: 0,
      studentSlotsTotal: 0,
      completionsForPublishedLessonsInRange: 0,
      coveragePercent: null,
    };
  }

  const classOidSet = [
    ...new Set(publishedRows.map((r) => String(r.classGroupId))),
  ].map((s) => new mongoose.Types.ObjectId(s));

  const classCounts = await Student.aggregate<{ _id: Types.ObjectId; n: number }>([
    {
      $match: {
        schoolId,
        status: "active",
        classGroupId: { $in: classOidSet },
      },
    },
    { $group: { _id: "$classGroupId", n: { $sum: 1 } } },
  ]);

  const sizeByClass = new Map(classCounts.map((c) => [String(c._id), c.n]));

  let studentSlotsTotal = 0;
  for (const row of publishedRows) {
    studentSlotsTotal += sizeByClass.get(String(row.classGroupId)) ?? 0;
  }

  const lessonOids = publishedRows.map((r) => r._id);

  const completionsForPublishedLessonsInRange = await StudentLessonProgress.countDocuments({
    schoolId,
    lessonId: { $in: lessonOids },
    completionStatus: "completed",
    completedAt: { $gte: fromD, $lte: toD },
  });

  const coveragePercent = completionRatioPercent(
    completionsForPublishedLessonsInRange,
    studentSlotsTotal
  );

  return {
    publishedLessonsInRange,
    studentSlotsTotal,
    completionsForPublishedLessonsInRange,
    coveragePercent,
  };
}
