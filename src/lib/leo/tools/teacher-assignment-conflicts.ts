import "server-only";
import mongoose, { type Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { findOtherTeachersOnSlot } from "@/lib/admin/teacher-assignment-slot";
import type { LeoAssistantDraft } from "@/lib/leo/types";

function extractTeacherIdFromRoute(route?: string | null): string | null {
  if (!route) return null;
  const match = route.match(/\/admin\/teachers\/([a-fA-F0-9]{24})(?:\/|$|\?)/);
  return match?.[1] ?? null;
}

function fullName(user?: { firstName?: string; lastName?: string } | null) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "this teacher";
}

function classLabel(group: {
  name?: string;
  gradeId?: Types.ObjectId | { _id?: Types.ObjectId; name?: string } | null;
}) {
  const gradeName =
    typeof group.gradeId === "object" && group.gradeId !== null && "name" in group.gradeId
      ? group.gradeId.name || ""
      : "";
  return `${gradeName} ${group.name || ""}`.trim() || "Class";
}

export async function runTeacherAssignmentConflictsTool(args: {
  schoolId: Types.ObjectId;
  route?: string | null;
}): Promise<LeoAssistantDraft> {
  const teacherId = extractTeacherIdFromRoute(args.route);
  if (!teacherId) {
    return {
      contentText:
        "Open a teacher profile first, then ask me again. I need the teacher page route so I can check assignment conflicts for the right teacher.",
      citations: [{ type: "route", label: "Teachers", ref: "/admin/teachers" }],
      toolsUsed: ["teacher_assignment_conflicts"],
    };
  }

  const teacherObjId = new mongoose.Types.ObjectId(teacherId);
  const [teacher, period] = await Promise.all([
    Teacher.findOne({ _id: teacherObjId, schoolId: args.schoolId })
      .select("_id userId subjectIds homeroomClassGroupId")
      .lean(),
    AcademicPeriod.findOne({ schoolId: args.schoolId, isCurrent: true })
      .select("_id yearLabel term")
      .lean(),
  ]);

  if (!teacher) {
    return {
      contentText: "I could not find this teacher inside the current school.",
      citations: [{ type: "route", label: "Teachers", ref: "/admin/teachers" }],
      toolsUsed: ["teacher_assignment_conflicts"],
    };
  }

  const user = await User.findById(teacher.userId).select("firstName lastName").lean();
  const teacherName = fullName(user as { firstName?: string; lastName?: string } | null);

  if (!period) {
    return {
      contentText: `I found ${teacherName}, but there is no current academic period. Set the current period before checking assignment conflicts.`,
      citations: [
        { type: "record", label: "Teacher", ref: `Teacher:${teacherId}` },
        { type: "route", label: "Academic periods", ref: "/admin/periods" },
      ],
      toolsUsed: ["teacher_assignment_conflicts"],
    };
  }

  const assignments = await TeacherAssignment.find({
    schoolId: args.schoolId,
    teacherId: teacherObjId,
    academicPeriodId: period._id,
    status: "active",
  })
    .select("_id subjectId classGroupId")
    .lean();

  const subjectIds = Array.from(
    new Set([
      ...assignments.map((assignment) => String(assignment.subjectId)),
      ...(teacher.subjectIds || []).map((id) => String(id)),
    ])
  );
  const classGroupIds = Array.from(
    new Set([
      ...assignments.map((assignment) => String(assignment.classGroupId)),
      ...(teacher.homeroomClassGroupId ? [String(teacher.homeroomClassGroupId)] : []),
    ])
  );

  const [subjects, classGroups] = await Promise.all([
    subjectIds.length
      ? Subject.find({
          _id: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
          schoolId: args.schoolId,
        })
          .select("_id name code")
          .lean()
      : [],
    classGroupIds.length
      ? ClassGroup.find({
          _id: { $in: classGroupIds.map((id) => new mongoose.Types.ObjectId(id)) },
          schoolId: args.schoolId,
        })
          .select("_id name gradeId subjectIds homeroomTeacherId")
          .populate({ path: "gradeId", select: "name", model: Grade })
          .lean()
      : [],
  ]);

  const subjectMap = new Map(subjects.map((subject) => [String(subject._id), subject]));
  const classMap = new Map(classGroups.map((group) => [String(group._id), group]));

  const coTeachingConflicts: string[] = [];
  const classSubjectWarnings: string[] = [];
  const outsideTeacherSubjectWarnings: string[] = [];

  const teacherSubjectSet = new Set((teacher.subjectIds || []).map((id) => String(id)));

  for (const assignment of assignments) {
    const subjectId = String(assignment.subjectId);
    const classGroupId = String(assignment.classGroupId);
    const subject = subjectMap.get(subjectId);
    const group = classMap.get(classGroupId);
    const label = `${subject?.name || "Subject"} in ${group ? classLabel(group) : "Class"}`;

    const others = await findOtherTeachersOnSlot({
      schoolId: args.schoolId,
      academicPeriodId: period._id,
      subjectId: assignment.subjectId,
      classGroupId: assignment.classGroupId,
      requestingTeacherId: teacherObjId,
    });
    if (others.length > 0) {
      coTeachingConflicts.push(
        `${label}: also assigned to ${others.map((other) => other.displayName).join(", ")}`
      );
    }

    const classSubjects = new Set((group?.subjectIds || []).map((id) => String(id)));
    if (group && classSubjects.size > 0 && !classSubjects.has(subjectId)) {
      classSubjectWarnings.push(`${label}: subject is not on the class subject list`);
    }

    if (!teacherSubjectSet.has(subjectId)) {
      outsideTeacherSubjectWarnings.push(`${label}: subject is not on ${teacherName}'s subject list`);
    }
  }

  const homeroomWarnings: string[] = [];
  if (teacher.homeroomClassGroupId) {
    const homeroom = classMap.get(String(teacher.homeroomClassGroupId));
    if (!homeroom) {
      homeroomWarnings.push("Homeroom class is missing or outside this school.");
    } else if (
      homeroom.homeroomTeacherId &&
      String(homeroom.homeroomTeacherId) !== teacherId
    ) {
      homeroomWarnings.push(
        `${classLabel(homeroom)} points to another homeroom teacher on the class record.`
      );
    }
  }

  const totalIssues =
    coTeachingConflicts.length +
    classSubjectWarnings.length +
    outsideTeacherSubjectWarnings.length +
    homeroomWarnings.length;

  const lines = [
    `${teacherName} has ${assignments.length} active teaching assignment${assignments.length === 1 ? "" : "s"} for ${period.term} ${period.yearLabel}.`,
    totalIssues === 0
      ? "I did not find assignment conflicts in the current period."
      : `I found ${totalIssues} assignment warning${totalIssues === 1 ? "" : "s"} to review.`,
  ];

  if (coTeachingConflicts.length > 0) {
    lines.push("", "Co-teaching / occupied assignment slots:");
    for (const item of coTeachingConflicts.slice(0, 6)) lines.push(`- ${item}`);
  }

  if (classSubjectWarnings.length > 0) {
    lines.push("", "Class subject-list mismatches:");
    for (const item of classSubjectWarnings.slice(0, 6)) lines.push(`- ${item}`);
  }

  if (outsideTeacherSubjectWarnings.length > 0) {
    lines.push("", "Teacher subject-list mismatches:");
    for (const item of outsideTeacherSubjectWarnings.slice(0, 6)) lines.push(`- ${item}`);
  }

  if (homeroomWarnings.length > 0) {
    lines.push("", "Homeroom warnings:");
    for (const item of homeroomWarnings) lines.push(`- ${item}`);
  }

  lines.push(
    "",
    "Safe next action: review these on the teacher assignments or class subject-teacher screens before replacing or adding teachers."
  );

  return {
    contentText: lines.join("\n"),
    citations: [
      { type: "record", label: "Teacher", ref: `Teacher:${teacherId}` },
      { type: "record", label: "Teacher assignments", ref: "TeacherAssignment" },
      { type: "route", label: "Teacher profile", ref: `/admin/teachers/${teacherId}` },
    ],
    toolsUsed: ["teacher_assignment_conflicts"],
  };
}
