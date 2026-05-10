import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { ensureDefaultExamTypesForSchool } from "@/lib/examinations/exam-type-seeds";
import { serializeExamType } from "@/lib/examinations/serializers";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamType } from "@/models/ExamType";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";

type LeanId = {
  _id: unknown;
};

function id(value: unknown) {
  return String(value);
}

export async function GET() {
  try {
    const ctx = await requireSchoolMember({
      allowedRoles: ["school_admin", "teacher", "staff"],
    });
    await connectToDatabase();
    await ensureDefaultExamTypesForSchool(ctx.schoolId);

    const [periods, examTypes] = await Promise.all([
      AcademicPeriod.find({ schoolId: ctx.schoolId })
        .sort({ startDate: -1 })
        .limit(12)
        .lean(),
      ExamType.find({ schoolId: ctx.schoolId, status: { $ne: "archived" } })
        .sort({ name: 1 })
        .lean(),
    ]);

    if (!ctx.roles.includes("teacher") || ctx.isAdmin) {
      const [grades, subjects, classGroups] = await Promise.all([
        Grade.find({ schoolId: ctx.schoolId, isActive: true })
          .sort({ order: 1, name: 1 })
          .lean(),
        Subject.find({ schoolId: ctx.schoolId, isActive: true })
          .sort({ name: 1 })
          .lean(),
        ClassGroup.find({ schoolId: ctx.schoolId, isActive: true })
          .sort({ name: 1 })
          .lean(),
      ]);

      return Response.json({
        success: true,
        data: {
          periods: periods.map((period) => ({
            id: id(period._id),
            academicYearId: id(period._id),
            label: `${period.yearLabel} · ${period.term}`,
            yearLabel: period.yearLabel,
            term: period.term,
            isCurrent: Boolean(period.isCurrent),
          })),
          examTypes: examTypes.map(serializeExamType),
          grades: grades.map((grade) => ({
            id: id(grade._id),
            name: grade.name,
          })),
          classGroups: classGroups.map((group) => ({
            id: id(group._id),
            gradeId: id(group.gradeId),
            name: group.name,
            subjectIds: (group.subjectIds ?? []).map(id),
          })),
          subjects: subjects.map((subject) => ({
            id: id(subject._id),
            name: subject.name,
          })),
        },
      });
    }

    const teacher = await Teacher.findOne({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      status: { $ne: "terminated" },
    })
      .select("_id")
      .lean<LeanId | null>();

    if (!teacher) {
      return Response.json({
        success: true,
        data: {
          periods: [],
          examTypes: examTypes.map(serializeExamType),
          grades: [],
          classGroups: [],
          subjects: [],
        },
      });
    }

    const currentPeriod = periods.find((period) => period.isCurrent) ?? periods[0];
    const assignments = currentPeriod
      ? await TeacherAssignment.find({
          schoolId: ctx.schoolId,
          teacherId: teacher._id,
          academicPeriodId: currentPeriod._id,
          status: "active",
        })
          .populate("classGroupId", "name gradeId subjectIds")
          .populate("subjectId", "name")
          .lean()
      : [];

    const gradeMap = new Map<string, { id: string; name: string }>();
    const classMap = new Map<
      string,
      { id: string; gradeId: string; name: string; subjectIds: string[] }
    >();
    const subjectMap = new Map<string, { id: string; name: string }>();

    const gradeIds = Array.from(
      new Set(
        assignments
          .map((assignment) => {
            const group = assignment.classGroupId as { gradeId?: unknown } | null;
            return group?.gradeId ? id(group.gradeId) : null;
          })
          .filter(Boolean)
      )
    );
    const grades = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds }, schoolId: ctx.schoolId })
          .select("name")
          .lean()
      : [];
    for (const grade of grades) {
      gradeMap.set(id(grade._id), { id: id(grade._id), name: grade.name });
    }

    for (const assignment of assignments) {
      const group = assignment.classGroupId as
        | { _id?: unknown; name?: string; gradeId?: unknown; subjectIds?: unknown[] }
        | null;
      const subject = assignment.subjectId as { _id?: unknown; name?: string } | null;
      if (group?._id && group.gradeId) {
        const groupId = id(group._id);
        const subjectIds = new Set(classMap.get(groupId)?.subjectIds ?? []);
        if (subject?._id) subjectIds.add(id(subject._id));
        classMap.set(groupId, {
          id: groupId,
          gradeId: id(group.gradeId),
          name: group.name ?? "Class group",
          subjectIds: Array.from(subjectIds),
        });
      }
      if (subject?._id) {
        subjectMap.set(id(subject._id), {
          id: id(subject._id),
          name: subject.name ?? "Subject",
        });
      }
    }

    return Response.json({
      success: true,
      data: {
        periods: currentPeriod
          ? [
              {
                id: id(currentPeriod._id),
                academicYearId: id(currentPeriod._id),
                label: `${currentPeriod.yearLabel} · ${currentPeriod.term}`,
                yearLabel: currentPeriod.yearLabel,
                term: currentPeriod.term,
                isCurrent: Boolean(currentPeriod.isCurrent),
              },
            ]
          : [],
        examTypes: examTypes.map(serializeExamType),
        grades: Array.from(gradeMap.values()),
        classGroups: Array.from(classMap.values()),
        subjects: Array.from(subjectMap.values()),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch examination setup options",
      },
      { status: 500 }
    );
  }
}
