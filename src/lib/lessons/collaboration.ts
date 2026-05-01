import mongoose from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import type { ILesson } from "@/models/Lesson";

type CollaboratorDisplay = {
  teacherId: string;
  userId: string;
  name: string;
};

function formatUserName(user: { name?: string; firstName?: string; lastName?: string; email?: string }) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.name?.trim()) return user.name.trim();
  if (user.email?.trim()) return user.email.trim();
  return "Teacher";
}

export async function canTeacherCollaborateOnLesson(
  schoolId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId,
  lesson: Pick<ILesson, "teacherId" | "classGroupId" | "subjectId" | "academicPeriodId" | "collaboratorTeacherIds">
) {
  if (String(lesson.teacherId) === String(teacherId)) return true;
  if ((lesson.collaboratorTeacherIds ?? []).some((id) => String(id) === String(teacherId))) return true;

  const assignmentQuery: Record<string, unknown> = {
    schoolId,
    teacherId,
    classGroupId: lesson.classGroupId,
    status: "active",
  };
  if (lesson.subjectId) assignmentQuery.subjectId = lesson.subjectId;
  if (lesson.academicPeriodId) assignmentQuery.academicPeriodId = lesson.academicPeriodId;

  const assignment = await TeacherAssignment.findOne(assignmentQuery).select("_id").lean();
  return Boolean(assignment);
}

export function validateCollaboratorTeacherIdsInput(args: {
  collaboratorTeacherIds: string[];
  ownerTeacherId: mongoose.Types.ObjectId;
  allowedTeacherIds: string[];
}):
  | { ok: true; collaboratorTeacherIds: mongoose.Types.ObjectId[] }
  | { ok: false; status: 400; error: string } {
  const rawUniqueIds = Array.from(new Set(args.collaboratorTeacherIds));
  const mapped = rawUniqueIds.map((candidate) => ({
    raw: candidate,
    objectId: (() => {
      try {
        return new mongoose.Types.ObjectId(String(candidate));
      } catch {
        return null;
      }
    })(),
  }));
  const invalid = mapped.filter((row) => row.objectId === null).map((row) => row.raw);
  if (invalid.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `Invalid collaborator teacher ID(s): ${invalid.join(", ")}`,
    };
  }

  const normalizedTeacherIds = mapped
    .map((row) => row.objectId as mongoose.Types.ObjectId)
    .filter((candidate) => String(candidate) !== String(args.ownerTeacherId));

  const allowedSet = new Set(args.allowedTeacherIds.map(String));
  const disallowed = normalizedTeacherIds
    .map(String)
    .filter((teacherId) => !allowedSet.has(teacherId));
  if (disallowed.length > 0) {
    return {
      ok: false,
      status: 400,
      error:
        "Some collaborator teacher IDs are not active teachers in this school: " +
        disallowed.join(", "),
    };
  }

  return { ok: true, collaboratorTeacherIds: normalizedTeacherIds };
}

export async function resolveLessonCollaborators(
  schoolId: mongoose.Types.ObjectId,
  lesson: Pick<ILesson, "teacherId" | "classGroupId" | "subjectId" | "academicPeriodId" | "collaboratorTeacherIds">
): Promise<CollaboratorDisplay[]> {
  const assignmentQuery: Record<string, unknown> = {
    schoolId,
    classGroupId: lesson.classGroupId,
    status: "active",
  };
  if (lesson.subjectId) assignmentQuery.subjectId = lesson.subjectId;
  if (lesson.academicPeriodId) assignmentQuery.academicPeriodId = lesson.academicPeriodId;

  const assignedTeacherIds = await TeacherAssignment.find(assignmentQuery).distinct("teacherId");
  const explicitIds = (lesson.collaboratorTeacherIds ?? []).map((id) => String(id));
  const allTeacherIds = Array.from(
    new Set([String(lesson.teacherId), ...assignedTeacherIds.map((id) => String(id)), ...explicitIds])
  ).map((id) => new mongoose.Types.ObjectId(id));

  if (allTeacherIds.length === 0) return [];
  const teachers = await Teacher.find({
    _id: { $in: allTeacherIds },
    schoolId,
    status: { $in: ["active", "on_leave"] },
  })
    .select("_id userId")
    .lean();
  const userIds = teachers.map((t) => t.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("_id name firstName lastName email").lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return teachers
    .map((t) => {
      const user = userMap.get(String(t.userId));
      if (!user) return null;
      return {
        teacherId: String(t._id),
        userId: String(t.userId),
        name: formatUserName(user),
      };
    })
    .filter((row): row is CollaboratorDisplay => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
