import mongoose from "mongoose";
import { Student } from "@/models/Student";
import { StudentAttendance } from "@/models/StudentAttendance";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";

export type AtRiskThresholds = {
  attendance: number;
  submissions: number;
  score: number;
};

export type AtRiskStudent = {
  id: string;
  name: string;
  admissionNo?: string;
  photoUrl?: string;
  classGroupId: string;
  className: string;
  attendanceRate: number | null;
  submissionRate: number | null;
  averageScore: number | null;
  flags: {
    attendance: boolean;
    submissions: boolean;
    score: boolean;
  };
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  reasons: string[];
};

const SUBMITTED_STATUSES = ["submitted", "late", "graded", "returned"] as const;

function toPercent(rate: number | null) {
  if (rate === null) return null;
  return Math.round(rate * 1000) / 10;
}

function normalizeIds(ids: Array<mongoose.Types.ObjectId | string>) {
  return Array.from(new Set(ids.map((id) => String(id))));
}

function buildClassNames(
  input: Array<{ _id: mongoose.Types.ObjectId; name: string; gradeId?: mongoose.Types.ObjectId }>
) {
  const gradeIds = normalizeIds(
    input
      .map((item) => item.gradeId)
      .filter(Boolean)
      .map((id) => id as mongoose.Types.ObjectId)
  ).map((id) => new mongoose.Types.ObjectId(id));

  return Grade.find({ _id: { $in: gradeIds } })
    .select("name")
    .lean()
    .then((grades) => {
      const gradeMap = new Map(
        grades.map((grade: { _id: mongoose.Types.ObjectId; name: string }) => [
          String(grade._id),
          grade.name,
        ])
      );

      const nameMap = new Map<string, string>();
      input.forEach((group) => {
        const gradeName = group.gradeId ? gradeMap.get(String(group.gradeId)) : undefined;
        const label = `${gradeName ? gradeName + " " : ""}${group.name}`.trim();
        nameMap.set(String(group._id), label || group.name);
      });

      return nameMap;
    });
}

export async function calculateMissingMarks(args: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupIds?: mongoose.Types.ObjectId[];
}) {
  const { schoolId, teacherId, academicPeriodId, classGroupIds = [] } = args;

  const homeworkQuery: Record<string, unknown> = {
    schoolId,
    teacherId,
    academicPeriodId,
    status: { $in: ["published", "closed"] },
  };

  if (classGroupIds.length > 0) {
    homeworkQuery.classGroupIds = { $in: classGroupIds };
  }

  const homeworks = await Homework.find(homeworkQuery)
    .select("_id classGroupIds targetStudentIds")
    .lean();

  if (homeworks.length === 0) return 0;

  const classGroupIdList = normalizeIds(
    homeworks.flatMap((hw) => (hw.classGroupIds || []) as mongoose.Types.ObjectId[])
  ).map((id) => new mongoose.Types.ObjectId(id));

  const studentCounts = classGroupIdList.length
    ? await Student.aggregate([
        {
          $match: {
            schoolId,
            classGroupId: { $in: classGroupIdList },
            status: "active",
          },
        },
        { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
      ])
    : [];

  const studentCountMap = new Map(
    studentCounts.map((entry: { _id: mongoose.Types.ObjectId; count: number }) => [
      String(entry._id),
      entry.count,
    ])
  );

  const submissionCounts = await Submission.aggregate([
    {
      $match: {
        schoolId,
        homeworkId: { $in: homeworks.map((hw) => hw._id) },
        status: { $in: SUBMITTED_STATUSES },
      },
    },
    { $group: { _id: "$homeworkId", count: { $sum: 1 } } },
  ]);

  const submissionMap = new Map(
    submissionCounts.map((entry: { _id: mongoose.Types.ObjectId; count: number }) => [
      String(entry._id),
      entry.count,
    ])
  );

  let missing = 0;

  for (const homework of homeworks) {
    const targetIds = (homework.targetStudentIds || []) as mongoose.Types.ObjectId[];
    let expected = 0;
    if (targetIds.length > 0) {
      expected = targetIds.length;
    } else {
      expected = (homework.classGroupIds || []).reduce((sum, classGroupId) => {
        return sum + (studentCountMap.get(String(classGroupId)) || 0);
      }, 0);
    }
    const submitted = submissionMap.get(String(homework._id)) || 0;
    missing += Math.max(expected - submitted, 0);
  }

  return missing;
}

export async function calculateAtRiskStudents(args: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupIds: mongoose.Types.ObjectId[];
  thresholds?: Partial<AtRiskThresholds>;
}) {
  const { schoolId, teacherId, academicPeriodId, classGroupIds } = args;

  if (!classGroupIds.length) {
    return {
      students: [] as AtRiskStudent[],
      total: 0,
      thresholds: {
        attendance: 0.75,
        submissions: 0.6,
        score: 0.5,
      },
    };
  }

  const thresholds: AtRiskThresholds = {
    attendance: args.thresholds?.attendance ?? 0.75,
    submissions: args.thresholds?.submissions ?? 0.6,
    score: args.thresholds?.score ?? 0.5,
  };

  const students = await Student.find({
    schoolId,
    classGroupId: { $in: classGroupIds },
    status: "active",
  })
    .select("_id firstName lastName middleName admissionNo photoUrl classGroupId")
    .sort({ lastName: 1, firstName: 1 })
    .lean();

  if (students.length === 0) {
    return { students: [], total: 0, thresholds };
  }

  const studentIds = students.map((student) => student._id);

  const classGroups = await ClassGroup.find({
    _id: { $in: classGroupIds },
    schoolId,
  })
    .select("_id name gradeId")
    .lean();

  const classNameMap = await buildClassNames(
    classGroups as Array<{
      _id: mongoose.Types.ObjectId;
      name: string;
      gradeId?: mongoose.Types.ObjectId;
    }>
  );

  const attendanceStats = await StudentAttendance.aggregate([
    {
      $match: {
        schoolId,
        academicPeriodId,
        studentId: { $in: studentIds },
        type: "homeroom",
      },
    },
    {
      $group: {
        _id: { studentId: "$studentId", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);

  const attendanceMap = new Map<string, { present: number; total: number }>();
  for (const entry of attendanceStats) {
    const key = String(entry._id.studentId);
    const current = attendanceMap.get(key) || { present: 0, total: 0 };
    current.total += entry.count;
    if (entry._id.status === "present") current.present += entry.count;
    attendanceMap.set(key, current);
  }

  const homeworks = await Homework.find({
    schoolId,
    teacherId,
    academicPeriodId,
    status: { $in: ["published", "closed"] },
  })
    .select("_id classGroupIds targetStudentIds maxScore")
    .lean();

  const homeworkIds = homeworks.map((hw) => hw._id);
  const homeworkCountByClass = new Map<string, number>();
  const targetedExpected = new Map<string, number>();

  for (const hw of homeworks) {
    const targets = (hw.targetStudentIds || []) as mongoose.Types.ObjectId[];
    if (targets.length > 0) {
      targets.forEach((studentId) => {
        const key = String(studentId);
        targetedExpected.set(key, (targetedExpected.get(key) || 0) + 1);
      });
    } else {
      (hw.classGroupIds || []).forEach((classId) => {
        const key = String(classId);
        homeworkCountByClass.set(key, (homeworkCountByClass.get(key) || 0) + 1);
      });
    }
  }

  const submissionCounts = homeworkIds.length
    ? await Submission.aggregate([
        {
          $match: {
            schoolId,
            homeworkId: { $in: homeworkIds },
            studentId: { $in: studentIds },
            status: { $in: SUBMITTED_STATUSES },
          },
        },
        { $group: { _id: "$studentId", count: { $sum: 1 } } },
      ])
    : [];

  const submissionMap = new Map(
    submissionCounts.map((entry: { _id: mongoose.Types.ObjectId; count: number }) => [
      String(entry._id),
      entry.count,
    ])
  );

  const scoreAgg = homeworkIds.length
    ? await Submission.aggregate([
        {
          $match: {
            schoolId,
            homeworkId: { $in: homeworkIds },
            studentId: { $in: studentIds },
            score: { $ne: null },
          },
        },
        {
          $lookup: {
            from: Homework.collection.name,
            localField: "homeworkId",
            foreignField: "_id",
            as: "homework",
          },
        },
        { $unwind: "$homework" },
        {
          $group: {
            _id: "$studentId",
            totalScore: { $sum: "$score" },
            totalMax: { $sum: "$homework.maxScore" },
          },
        },
      ])
    : [];

  const scoreMap = new Map(
    scoreAgg.map(
      (entry: { _id: mongoose.Types.ObjectId; totalScore: number; totalMax: number }) => [
        String(entry._id),
        entry,
      ]
    )
  );

  const atRiskStudents: AtRiskStudent[] = [];

  for (const student of students) {
    const studentId = String(student._id);
    const attendance = attendanceMap.get(studentId);
    const attendanceRate = attendance && attendance.total > 0
      ? attendance.present / attendance.total
      : null;

    const expected = (homeworkCountByClass.get(String(student.classGroupId)) || 0)
      + (targetedExpected.get(studentId) || 0);
    const submissionCount = submissionMap.get(studentId) || 0;
    const submissionRate = expected > 0 ? submissionCount / expected : null;

    const scoreEntry = scoreMap.get(studentId);
    const scoreRate = scoreEntry && scoreEntry.totalMax > 0
      ? scoreEntry.totalScore / scoreEntry.totalMax
      : null;

    const attendanceFlag = attendanceRate !== null && attendanceRate < thresholds.attendance;
    const submissionFlag = submissionRate !== null && submissionRate < thresholds.submissions;
    const scoreFlag = scoreRate !== null && scoreRate < thresholds.score;

    const riskScore = [attendanceFlag, submissionFlag, scoreFlag].filter(Boolean).length;
    if (riskScore === 0) continue;

    const reasons: string[] = [];
    if (attendanceFlag) reasons.push(`Attendance below ${Math.round(thresholds.attendance * 100)}%`);
    if (submissionFlag) reasons.push(`Submission rate below ${Math.round(thresholds.submissions * 100)}%`);
    if (scoreFlag) reasons.push(`Average score below ${Math.round(thresholds.score * 100)}%`);

    const riskLevel = riskScore >= 2 ? "high" : "medium";

    atRiskStudents.push({
      id: studentId,
      name: `${student.firstName} ${student.lastName}`.trim(),
      admissionNo: student.admissionNo || undefined,
      photoUrl: student.photoUrl || undefined,
      classGroupId: String(student.classGroupId),
      className: classNameMap.get(String(student.classGroupId)) || "",
      attendanceRate: toPercent(attendanceRate),
      submissionRate: toPercent(submissionRate),
      averageScore: toPercent(scoreRate),
      flags: {
        attendance: attendanceFlag,
        submissions: submissionFlag,
        score: scoreFlag,
      },
      riskScore,
      riskLevel,
      reasons,
    });
  }

  atRiskStudents.sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    return a.name.localeCompare(b.name);
  });

  return {
    students: atRiskStudents,
    total: atRiskStudents.length,
    thresholds,
  };
}
