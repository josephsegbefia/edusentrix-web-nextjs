import { Types } from "mongoose";
import { mergedDelegationPermissions } from "@/lib/delegations/service";
import { StoredAsset } from "@/models/StoredAsset";
import { Student } from "@/models/Student";
import { isSchoolAdminOrPlatform } from "./access-policy";
import { OBJECT_ID_HEX } from "./ids";
import { STORED_ASSET_RECOVERY_DAYS } from "./service";
import { studentPhotoUrlPattern } from "./student-avatar-access";
import {
  StorageAuthorizationError,
  StorageValidationError,
  type StorageActor,
  type StorageAssociation,
} from "./types";
import { getStoredAssetUrl, parseStoredAssetId } from "./urls";

const STUDENTS_EDIT_PERMISSION = "students.edit";

type IdLike = Types.ObjectId | string;

function toObjectId(value: IdLike): Types.ObjectId {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

/**
 * Who may presign a `student_avatar`. School admins and assisted-access
 * operators may upload before the student exists; a `students.edit` delegate
 * must name a student in the same school. Nobody else may upload one.
 */
export async function assertStudentAvatarUploadAllowed(
  actor: StorageActor,
  association?: StorageAssociation
): Promise<void> {
  if (association) {
    if (association.type !== "student" || !OBJECT_ID_HEX.test(association.id)) {
      throw new StorageValidationError("A student photo can only be linked to a student");
    }
    const student = await Student.exists({
      _id: new Types.ObjectId(association.id),
      schoolId: actor.schoolId,
    });
    if (!student) {
      throw new StorageAuthorizationError("Not allowed to upload a photo for this student");
    }
  }
  if (isSchoolAdminOrPlatform(actor)) return;
  if (!association || !actor.userId) {
    throw new StorageAuthorizationError("Not allowed to upload student photos");
  }
  const delegated = await mergedDelegationPermissions(actor.schoolId, actor.userId);
  if (!delegated.includes(STUDENTS_EDIT_PERMISSION)) {
    throw new StorageAuthorizationError("Not allowed to upload student photos");
  }
}

export type AssignableStudentPhoto = {
  /** Value to store in `Student.photoUrl`. */
  photoUrl: string | null;
  /** Unlinked asset to link once the student id is known (create flow). */
  pendingLinkAssetId: string | null;
};

/**
 * Validates a `photoUrl` before it is written to a student. A blank value
 * clears the photo and an unchanged value is kept as is, so legacy records
 * still save. Anything else must be a ready `student_avatar` in the same
 * school that is unlinked or already linked to this student, and that no
 * other student references. Pass `studentId: null` while creating a student;
 * link the returned asset with `linkStudentPhoto` after the insert.
 */
export async function assertAssignableStudentPhoto(input: {
  schoolId: IdLike;
  studentId: IdLike | null;
  photoUrl: string | null | undefined;
  currentPhotoUrl?: string | null;
}): Promise<AssignableStudentPhoto> {
  const value = typeof input.photoUrl === "string" ? input.photoUrl.trim() : "";
  if (!value) return { photoUrl: null, pendingLinkAssetId: null };
  const current = input.currentPhotoUrl?.trim() ?? "";
  if (current && value === current) {
    return { photoUrl: current, pendingLinkAssetId: null };
  }

  const assetId = parseStoredAssetId(value);
  if (!assetId) {
    throw new StorageValidationError("Student photos must be uploaded to EduSentrix");
  }
  const schoolId = toObjectId(input.schoolId);
  const studentId = input.studentId ? toObjectId(input.studentId) : null;

  const asset = await StoredAsset.findOne({
    _id: new Types.ObjectId(assetId),
    schoolId,
    kind: "student_avatar",
    status: "ready",
  })
    .select({ _id: 1, association: 1 })
    .lean<{ _id: Types.ObjectId; association?: { type: string; id: Types.ObjectId } | null } | null>();
  if (!asset) {
    throw new StorageValidationError("Photo not found");
  }
  if (asset.association) {
    const linkedHere =
      studentId &&
      asset.association.type === "student" &&
      String(asset.association.id) === String(studentId);
    if (!linkedHere) {
      throw new StorageValidationError("This photo belongs to another record");
    }
  }
  const otherReference = await Student.exists({
    schoolId,
    photoUrl: studentPhotoUrlPattern(assetId),
    ...(studentId ? { _id: { $ne: studentId } } : {}),
  });
  if (otherReference) {
    throw new StorageValidationError("This photo belongs to another record");
  }

  if (!asset.association && studentId) {
    await linkStudentPhoto({ schoolId, studentId, assetId });
  }
  return {
    photoUrl: getStoredAssetUrl(assetId),
    pendingLinkAssetId: asset.association || studentId ? null : assetId,
  };
}

/** Links an unlinked `student_avatar` to its student. Never relinks. */
export async function linkStudentPhoto(input: {
  schoolId: IdLike;
  studentId: IdLike;
  assetId: string;
}): Promise<void> {
  await StoredAsset.updateOne(
    {
      _id: new Types.ObjectId(input.assetId),
      schoolId: toObjectId(input.schoolId),
      kind: "student_avatar",
      association: null,
    },
    { $set: { association: { type: "student", id: toObjectId(input.studentId) } } }
  );
}

/**
 * Soft-deletes the photo a student is replacing, only when it is a
 * `student_avatar` in the same school that is linked to this student, or
 * unlinked and referenced by no other student. Returns whether it was deleted.
 */
export async function releasePreviousStudentPhoto(input: {
  schoolId: IdLike;
  studentId: IdLike;
  url: string | null | undefined;
}): Promise<boolean> {
  const assetId = parseStoredAssetId(input.url);
  if (!assetId) return false;
  const schoolId = toObjectId(input.schoolId);
  const studentId = toObjectId(input.studentId);

  const asset = await StoredAsset.findOne({
    _id: new Types.ObjectId(assetId),
    schoolId,
    kind: "student_avatar",
    status: "ready",
  })
    .select({ _id: 1, association: 1 })
    .lean<{ _id: Types.ObjectId; association?: { type: string; id: Types.ObjectId } | null } | null>();
  if (!asset) return false;

  if (asset.association) {
    if (asset.association.type !== "student" || String(asset.association.id) !== String(studentId)) {
      return false;
    }
  }
  const otherReference = await Student.exists({
    schoolId,
    _id: { $ne: studentId },
    photoUrl: studentPhotoUrlPattern(assetId),
  });
  if (otherReference) return false;

  const result = await StoredAsset.updateOne(
    { _id: asset._id, schoolId, kind: "student_avatar", status: "ready" },
    {
      $set: {
        status: "deleted",
        deletedAt: new Date(),
        purgeAfter: new Date(Date.now() + STORED_ASSET_RECOVERY_DAYS * 24 * 60 * 60 * 1000),
      },
    }
  );
  return result.modifiedCount > 0;
}
