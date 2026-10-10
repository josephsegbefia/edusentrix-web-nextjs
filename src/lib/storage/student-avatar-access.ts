import type { Types } from "mongoose";
import { DELEGATION_REGISTRY } from "@/lib/delegations/registry";
import { mergedDelegationPermissions } from "@/lib/delegations/service";
import { ClassGroup } from "@/models/ClassGroup";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import type { ReadableStoredAsset } from "./access-policy";
import type { StorageActor } from "./types";

const STUDENTS_VIEW_PERMISSION =
  DELEGATION_REGISTRY.students.presets.viewer?.permissions[0] ?? "students.view";

export type AvatarStudent = {
  _id: Types.ObjectId;
  classGroupId?: Types.ObjectId | null;
};

export type AvatarOwnership =
  | { status: "resolved"; student: AvatarStudent }
  | { status: "unreferenced" }
  | { status: "ambiguous" };

/** Matches a stored `photoUrl` that points at this asset through the gateway. */
export function studentPhotoUrlPattern(assetId: string): RegExp {
  if (!/^[a-fA-F0-9]{24}$/.test(assetId)) {
    throw new Error("Invalid asset id");
  }
  return new RegExp(`/api/storage/assets/${assetId}(\\?.*)?$`, "i");
}

/**
 * The single student a photo belongs to, inside the asset's own school.
 * An explicit student association wins; legacy assets without one are
 * resolved through `Student.photoUrl`, and more than one match is ambiguous.
 */
export async function resolveStudentAvatarOwner(
  asset: Pick<ReadableStoredAsset, "_id" | "schoolId" | "association">
): Promise<AvatarOwnership> {
  const select = { _id: 1, classGroupId: 1 };
  if (asset.association?.type === "student") {
    const student = await Student.findOne({
      _id: asset.association.id,
      schoolId: asset.schoolId,
    })
      .select(select)
      .lean<AvatarStudent | null>();
    return student ? { status: "resolved", student } : { status: "unreferenced" };
  }
  if (asset.association || !asset._id) {
    return { status: "unreferenced" };
  }
  const matches = await Student.find({
    schoolId: asset.schoolId,
    photoUrl: studentPhotoUrlPattern(String(asset._id)),
  })
    .select(select)
    .limit(2)
    .lean<AvatarStudent[]>();
  if (matches.length === 0) return { status: "unreferenced" };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "resolved", student: matches[0] };
}

async function teacherCanSeeStudent(actor: StorageActor, student: AvatarStudent): Promise<boolean> {
  if (!actor.userId || !actor.roles.includes("teacher") || !student.classGroupId) {
    return false;
  }
  const teacher = await Teacher.findOne({ userId: actor.userId, schoolId: actor.schoolId })
    .select({ _id: 1, homeroomClassGroupId: 1 })
    .lean<{ _id: Types.ObjectId; homeroomClassGroupId?: Types.ObjectId | null } | null>();
  if (!teacher) return false;
  if (
    teacher.homeroomClassGroupId &&
    String(teacher.homeroomClassGroupId) === String(student.classGroupId)
  ) {
    return true;
  }
  const [homeroom, assignment] = await Promise.all([
    ClassGroup.exists({
      _id: student.classGroupId,
      schoolId: actor.schoolId,
      homeroomTeacherId: teacher._id,
    }),
    TeacherAssignment.exists({
      schoolId: actor.schoolId,
      teacherId: teacher._id,
      classGroupId: student.classGroupId,
      status: "active",
    }),
  ]);
  return Boolean(homeroom || assignment);
}

/**
 * Read rule for a student photograph once the caller is known to be in the
 * asset's school and is not a school administrator or assisted-access operator.
 * Uploading a photo grants nothing by itself.
 */
export async function authorizeStudentAvatarRead(
  asset: ReadableStoredAsset,
  actor: StorageActor
): Promise<boolean> {
  const ownership = await resolveStudentAvatarOwner(asset);
  if (ownership.status !== "resolved") return false;
  const { student } = ownership;

  if (actor.learnStudentId) {
    return String(actor.learnStudentId) === String(student._id);
  }
  if (!actor.userId) return false;

  if (actor.roles.includes("bursar")) return true;

  const delegated = await mergedDelegationPermissions(actor.schoolId, actor.userId);
  if (delegated.includes(STUDENTS_VIEW_PERMISSION)) return true;

  if (await teacherCanSeeStudent(actor, student)) return true;

  if (actor.roles.includes("parent")) {
    const guardian = await Guardian.exists({ userId: actor.userId, studentId: student._id });
    return Boolean(guardian);
  }
  return false;
}
