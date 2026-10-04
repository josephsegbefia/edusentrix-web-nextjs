import type { Types } from "mongoose";
import { getParentWardIds } from "@/lib/auth/requireParent";
import { Teacher } from "@/models/Teacher";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { LessonResource } from "@/models/LessonResource";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { Student } from "@/models/Student";
import type { IStoredAsset } from "@/models/StoredAsset";
import type { StorageActor, StorageKind } from "./types";

export type ReadableStoredAsset = {
  _id?: Types.ObjectId;
  status: string;
  visibility: string;
  kind?: StorageKind | string;
  schoolId: Types.ObjectId | string;
  uploadedByUserId?: Types.ObjectId | string | null;
  association?: { type: string; id: Types.ObjectId | string } | null;
};

export type AssetReadDecision =
  | { allowed: true }
  | { allowed: false; reason: "not_ready" | "unauthorized" };

export function isSchoolAdminOrPlatform(actor: StorageActor): boolean {
  return actor.isPlatformOperator === true || actor.roles.includes("school_admin");
}

export function isFinanceStaff(actor: StorageActor): boolean {
  return isSchoolAdminOrPlatform(actor) || actor.roles.includes("bursar");
}

export function canMutateStoredAsset(input: {
  asset: {
    schoolId: Types.ObjectId | string;
    uploadedByUserId?: Types.ObjectId | string | null;
    kind?: string;
    status?: string;
  };
  actor: StorageActor;
}): boolean {
  if (String(input.actor.schoolId) !== String(input.asset.schoolId)) {
    return false;
  }
  if (isSchoolAdminOrPlatform(input.actor)) return true;
  if (input.actor.isPublicToken) {
    return (
      input.asset.kind === "admission_document" ||
      input.asset.kind === "parent_document"
    );
  }
  if (!input.actor.userId) return false;
  if (!input.asset.uploadedByUserId) return false;
  return String(input.actor.userId) === String(input.asset.uploadedByUserId);
}

function sameSchool(actor: StorageActor, asset: ReadableStoredAsset): boolean {
  return String(actor.schoolId) === String(asset.schoolId);
}

export async function authorizeStoredAssetRead(input: {
  asset: ReadableStoredAsset;
  actor: StorageActor | null;
  accessToken?: string | null;
}): Promise<AssetReadDecision> {
  if (input.asset.status !== "ready") {
    return { allowed: false, reason: "not_ready" };
  }
  if (input.asset.visibility === "public") {
    return { allowed: true };
  }

  const { actor, accessToken } = input;
  if (accessToken) {
    const tokenOk = await authorizeByPublicToken(input.asset, accessToken);
    if (tokenOk) return { allowed: true };
  }

  if (!actor) {
    return { allowed: false, reason: "unauthorized" };
  }
  if (!sameSchool(actor, input.asset)) {
    return { allowed: false, reason: "unauthorized" };
  }
  if (isSchoolAdminOrPlatform(actor)) {
    return { allowed: true };
  }

  if (!input.asset.association) {
    if (
      actor.userId &&
      input.asset.uploadedByUserId &&
      String(actor.userId) === String(input.asset.uploadedByUserId)
    ) {
      return { allowed: true };
    }
    return { allowed: false, reason: "unauthorized" };
  }

  const kind = (input.asset.kind || "") as StorageKind;
  const allowed = await authorizeAssociatedRead(kind, input.asset, actor);
  return allowed ? { allowed: true } : { allowed: false, reason: "unauthorized" };
}

async function authorizeByPublicToken(
  asset: ReadableStoredAsset,
  token: string
): Promise<boolean> {
  if (!asset.association || token.trim().length < 16) return false;
  const id = String(asset.association.id);
  if (asset.association.type === "application") {
    const app = await AdmissionApplication.findOne({
      _id: id,
      schoolId: asset.schoolId,
      "tracker.token": token,
    })
      .select({ _id: 1 })
      .lean();
    return Boolean(app);
  }
  if (asset.association.type === "request") {
    const parent = await Student.findOne({
      schoolId: asset.schoolId,
      parentDocumentRequests: { $elemMatch: { token } },
    })
      .select({ _id: 1 })
      .lean();
    if (parent) return true;
    const supplemental = await AdmissionApplication.findOne({
      schoolId: asset.schoolId,
      supplementalDocumentRequests: { $elemMatch: { token } },
    })
      .select({ _id: 1 })
      .lean();
    return Boolean(supplemental);
  }
  return false;
}

async function authorizeAssociatedRead(
  kind: StorageKind,
  asset: ReadableStoredAsset,
  actor: StorageActor
): Promise<boolean> {
  const associationId = String(asset.association?.id);
  if (!associationId) return false;

  if (
    actor.userId &&
    asset.uploadedByUserId &&
    String(actor.userId) === String(asset.uploadedByUserId)
  ) {
    return true;
  }

  switch (kind) {
    case "teacher_document":
      return false;
    case "student_record_document":
    case "parent_document": {
      if (!actor.userId || !actor.roles.includes("parent")) return false;
      const wards = await getParentWardIds(actor.userId);
      if (asset.association?.type === "student") {
        return wards.some((id) => String(id) === associationId);
      }
      return false;
    }
    case "expense_receipt":
      return isFinanceStaff(actor);
    case "assignment_attachment":
    case "lesson_resource":
      return authorizeAcademicAttachment(actor, associationId, asset);
    case "submission_attachment":
      return authorizeSubmission(actor, associationId);
    case "scheme_import":
      return isSchoolAdminOrPlatform(actor);
    case "notice_attachment":
      return actor.roles.length > 0;
    case "admission_document":
      return false;
    default:
      return false;
  }
}

async function authorizeAcademicAttachment(
  actor: StorageActor,
  associationId: string,
  asset: ReadableStoredAsset
): Promise<boolean> {
  if (actor.roles.includes("teacher") && actor.userId) {
    const teacher = await Teacher.findOne({
      userId: actor.userId,
      schoolId: actor.schoolId,
    })
      .select({ _id: 1 })
      .lean();
    if (!teacher) return false;
    if (asset.association?.type === "homework") {
      const homework = await Homework.findOne({
        _id: associationId,
        schoolId: actor.schoolId,
        teacherId: teacher._id,
      })
        .select({ _id: 1 })
        .lean();
      return Boolean(homework);
    }
    if (asset.association?.type === "lesson" || asset.association?.type === "resource") {
      const resource = await LessonResource.findOne({
        _id: associationId,
        schoolId: actor.schoolId,
      })
        .select({ _id: 1, createdByUserId: 1 })
        .lean();
      return Boolean(resource);
    }
    return true;
  }
  if (actor.roles.includes("student") && actor.userId) {
    if (asset.association?.type === "homework") {
      const student = await Student.findOne({
        userId: actor.userId,
        schoolId: actor.schoolId,
      })
        .select({ _id: 1, classGroupId: 1 })
        .lean();
      if (!student) return false;
      const homework = await Homework.findOne({
        _id: associationId,
        schoolId: actor.schoolId,
        $or: [
          { targetStudentIds: student._id },
          { classGroupIds: student.classGroupId },
        ],
      })
        .select({ _id: 1 })
        .lean();
      return Boolean(homework);
    }
    if (asset.association?.type === "resource") {
      const resource = await LessonResource.findOne({
        _id: associationId,
        schoolId: actor.schoolId,
        visibility: { $in: ["students", "students_and_parents"] },
      })
        .select({ _id: 1 })
        .lean();
      return Boolean(resource);
    }
  }
  return false;
}

async function authorizeSubmission(
  actor: StorageActor,
  submissionId: string
): Promise<boolean> {
  const submission = await Submission.findOne({
    _id: submissionId,
    schoolId: actor.schoolId,
  })
    .select({ studentId: 1, homeworkId: 1 })
    .lean();
  if (!submission) return false;
  if (actor.roles.includes("student") && actor.userId) {
    const student = await Student.findOne({
      userId: actor.userId,
      schoolId: actor.schoolId,
    })
      .select({ _id: 1 })
      .lean();
    return Boolean(student && String(student._id) === String(submission.studentId));
  }
  if (actor.roles.includes("teacher") && actor.userId) {
    const teacher = await Teacher.findOne({
      userId: actor.userId,
      schoolId: actor.schoolId,
    })
      .select({ _id: 1 })
      .lean();
    if (!teacher) return false;
    const homework = await Homework.findOne({
      _id: submission.homeworkId,
      schoolId: actor.schoolId,
      teacherId: teacher._id,
    })
      .select({ _id: 1 })
      .lean();
    return Boolean(homework);
  }
  return false;
}

export function canReadStoredAsset(input: {
  asset: ReadableStoredAsset;
  actor: StorageActor | null;
}): AssetReadDecision {
  if (input.asset.status !== "ready") {
    return { allowed: false, reason: "not_ready" };
  }
  if (input.asset.visibility === "public") {
    return { allowed: true };
  }
  if (!input.actor) {
    return { allowed: false, reason: "unauthorized" };
  }
  if (!sameSchool(input.actor, input.asset)) {
    return { allowed: false, reason: "unauthorized" };
  }
  if (isSchoolAdminOrPlatform(input.actor)) {
    return { allowed: true };
  }
  if (
    !input.asset.association &&
    input.actor.userId &&
    input.asset.uploadedByUserId &&
    String(input.actor.userId) === String(input.asset.uploadedByUserId)
  ) {
    return { allowed: true };
  }
  return { allowed: false, reason: "unauthorized" };
}

export type { IStoredAsset };
