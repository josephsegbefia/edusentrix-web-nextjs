import "server-only";
import mongoose, { type Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import type { LeoAssistantDraft } from "@/lib/leo/types";

function extractClassIdFromRoute(route?: string | null): string | null {
  if (!route) return null;
  const match = route.match(/\/admin\/classes\/([a-fA-F0-9]{24})(?:\/|$|\?)/);
  return match?.[1] ?? null;
}

function subjectLabel(subject: { name: string; code?: string | null }) {
  return subject.code ? `${subject.name} (${subject.code})` : subject.name;
}

function userFullName(user?: { firstName?: string; lastName?: string } | null) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Unnamed teacher";
}

export async function runClassSubjectTeacherLinksTool(args: {
  schoolId: Types.ObjectId;
  route?: string | null;
}): Promise<LeoAssistantDraft> {
  const classId = extractClassIdFromRoute(args.route);
  if (!classId) {
    return {
      contentText:
        "Open a specific class first, then ask me again. I need the class page route so I can check subject-teacher links safely.",
      citations: [{ type: "route", label: "Classes", ref: "/admin/classes" }],
      toolsUsed: ["class_subject_teacher_links"],
    };
  }

  const classObjId = new mongoose.Types.ObjectId(classId);
  const [classGroup, currentPeriod] = await Promise.all([
    ClassGroup.findOne({ _id: classObjId, schoolId: args.schoolId })
      .select("_id name gradeId subjectIds")
      .lean(),
    AcademicPeriod.findOne({ schoolId: args.schoolId, isCurrent: true })
      .select("_id yearLabel term")
      .lean(),
  ]);

  if (!classGroup) {
    return {
      contentText: "I could not find this class inside the current school.",
      citations: [{ type: "route", label: "Classes", ref: "/admin/classes" }],
      toolsUsed: ["class_subject_teacher_links"],
    };
  }

  const grade = await Grade.findOne({ _id: classGroup.gradeId, schoolId: args.schoolId })
    .select("name")
    .lean();
  const classLabel = `${grade?.name || ""} ${classGroup.name || ""}`.trim() || "this class";

  const classSubjectIds = (classGroup.subjectIds || []).map((id) => String(id));
  const subjectIds = classSubjectIds.map((id) => new mongoose.Types.ObjectId(id));
  const subjects = subjectIds.length
    ? await Subject.find({ _id: { $in: subjectIds }, schoolId: args.schoolId })
        .select("_id name code")
        .lean()
    : [];

  if (!currentPeriod) {
    return {
      contentText: `${classLabel} has ${subjects.length} subject${subjects.length === 1 ? "" : "s"} linked, but there is no current academic period to check teacher assignments against.`,
      citations: [
        { type: "record", label: "Class group", ref: `ClassGroup:${classId}` },
        { type: "route", label: "Academic periods", ref: "/admin/periods" },
      ],
      toolsUsed: ["class_subject_teacher_links"],
    };
  }

  const assignments = await TeacherAssignment.find({
    schoolId: args.schoolId,
    classGroupId: classObjId,
    academicPeriodId: currentPeriod._id,
    status: "active",
  })
    .select("_id subjectId teacherId")
    .lean();

  const assignmentSubjectIds = assignments.map((assignment) => String(assignment.subjectId));
  const extraSubjectIds = assignmentSubjectIds.filter((id) => !classSubjectIds.includes(id));
  const extraSubjectObjectIds = Array.from(new Set(extraSubjectIds)).map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const extraSubjects = extraSubjectObjectIds.length
    ? await Subject.find({ _id: { $in: extraSubjectObjectIds }, schoolId: args.schoolId })
        .select("_id name code")
        .lean()
    : [];

  const teacherIds = Array.from(new Set(assignments.map((assignment) => String(assignment.teacherId))));
  const teachers = teacherIds.length
    ? await Teacher.find({
        _id: { $in: teacherIds.map((id) => new mongoose.Types.ObjectId(id)) },
        schoolId: args.schoolId,
      })
        .select("_id userId")
        .lean()
    : [];

  const users = teachers.length
    ? await User.find({ _id: { $in: teachers.map((teacher) => teacher.userId) } })
        .select("_id firstName lastName")
        .lean()
    : [];

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const teacherNameById = new Map(
    teachers.map((teacher) => [
      String(teacher._id),
      userFullName(userById.get(String(teacher.userId))),
    ])
  );
  const assignmentsBySubject = new Map<string, string[]>();
  for (const assignment of assignments) {
    const subjectId = String(assignment.subjectId);
    const teacherName = teacherNameById.get(String(assignment.teacherId)) || "Unnamed teacher";
    const values = assignmentsBySubject.get(subjectId) || [];
    if (!values.includes(teacherName)) values.push(teacherName);
    assignmentsBySubject.set(subjectId, values);
  }

  const missingSubjects = subjects.filter(
    (subject) => (assignmentsBySubject.get(String(subject._id)) || []).length === 0
  );
  const coTaughtSubjects = subjects.filter(
    (subject) => (assignmentsBySubject.get(String(subject._id)) || []).length > 1
  );

  const lines = [
    `${classLabel} has ${subjects.length} subject${subjects.length === 1 ? "" : "s"} linked for ${currentPeriod.term} ${currentPeriod.yearLabel}.`,
    `${subjects.length - missingSubjects.length} subject${subjects.length - missingSubjects.length === 1 ? "" : "s"} currently have at least one teacher assignment.`,
  ];

  if (missingSubjects.length > 0) {
    lines.push("", "Subjects missing teachers:");
    for (const subject of missingSubjects.slice(0, 6)) {
      lines.push(`- ${subjectLabel(subject)}`);
    }
  } else {
    lines.push("", "Every linked subject has a teacher assignment.");
  }

  const linkedSamples = subjects
    .filter((subject) => (assignmentsBySubject.get(String(subject._id)) || []).length > 0)
    .slice(0, 6);
  if (linkedSamples.length > 0) {
    lines.push("", "Current subject-teacher links:");
    for (const subject of linkedSamples) {
      const teachersForSubject = assignmentsBySubject.get(String(subject._id)) || [];
      lines.push(`- ${subjectLabel(subject)}: ${teachersForSubject.join(", ")}`);
    }
  }

  if (coTaughtSubjects.length > 0) {
    lines.push(
      "",
      `Co-teaching is active for ${coTaughtSubjects.length} subject${coTaughtSubjects.length === 1 ? "" : "s"}.`
    );
  }

  if (extraSubjects.length > 0) {
    lines.push("", "Assignments outside this class subject list:");
    for (const subject of extraSubjects.slice(0, 4)) {
      lines.push(`- ${subjectLabel(subject)}`);
    }
  }

  return {
    contentText: lines.join("\n"),
    citations: [
      { type: "record", label: "Class group", ref: `ClassGroup:${classId}` },
      { type: "record", label: "Teacher assignments", ref: "TeacherAssignment" },
      { type: "route", label: "Class subject teachers", ref: `/admin/classes/${classId}?tab=subjects` },
    ],
    toolsUsed: ["class_subject_teacher_links"],
  };
}
