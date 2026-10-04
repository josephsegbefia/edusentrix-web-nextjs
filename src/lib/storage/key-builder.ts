import { randomUUID } from "node:crypto";
import { assertObjectIdHex } from "./ids";
import { normalizeMimeType } from "./kinds";
import {
  StorageValidationError,
  type StorageAssociation,
  type StorageKind,
} from "./types";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "text/csv": "csv",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const ALLOWED_EXTENSIONS = new Set(Object.values(MIME_EXTENSIONS));

export type BuildStorageKeyInput = {
  schoolId: string;
  kind: StorageKind;
  mimeType: string;
  association?: StorageAssociation;
  assetUuid?: string;
};

export type BuiltStorageKey = {
  storageKey: string;
  extension: string;
  assetUuid: string;
};

export function extensionForMimeType(mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  const extension = MIME_EXTENSIONS[normalized];
  if (!extension) {
    throw new StorageValidationError("Unsupported file type");
  }
  return extension;
}

function assertSafeSegment(value: string, label: string): string {
  if (!value || value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new StorageValidationError(`Invalid ${label}`);
  }
  if (/[@\s]/.test(value) || value.includes("://")) {
    throw new StorageValidationError(`Invalid ${label}`);
  }
  return value;
}

function associationId(
  association: StorageAssociation | undefined,
  type: StorageAssociation["type"]
): string | null {
  if (!association || association.type !== type) return null;
  return assertObjectIdHex(association.id, `${type} id`);
}

function pendingKey(
  schoolId: string,
  kind: StorageKind,
  assetUuid: string,
  extension: string
): string {
  return `schools/${schoolId}/pending/${kind}/${assetUuid}.${extension}`;
}

export function buildStorageKey(input: BuildStorageKeyInput): BuiltStorageKey {
  const schoolId = assertObjectIdHex(input.schoolId, "schoolId");
  const extension = extensionForMimeType(input.mimeType);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new StorageValidationError("Unsupported file extension");
  }

  const assetUuid = input.assetUuid ?? randomUUID();
  if (input.assetUuid) {
    assertSafeSegment(assetUuid, "asset id");
  }

  const kind = assertSafeSegment(input.kind, "kind") as StorageKind;
  const association = input.association;
  if (association) {
    assertSafeSegment(association.type, "association type");
    assertObjectIdHex(association.id, "association id");
  }

  const path = resolveKindPath(schoolId, kind, association, assetUuid, extension);
  if (!path.startsWith(`schools/${schoolId}/`)) {
    throw new StorageValidationError("Storage key must be tenant-scoped");
  }
  if (path.includes("..") || path.includes("//")) {
    throw new StorageValidationError("Invalid storage key");
  }

  return { storageKey: path, extension, assetUuid };
}

function resolveKindPath(
  schoolId: string,
  kind: StorageKind,
  association: StorageAssociation | undefined,
  assetUuid: string,
  extension: string
): string {
  const file = `${assetUuid}.${extension}`;
  const student = associationId(association, "student");
  const user = associationId(association, "user");
  const teacher = associationId(association, "teacher");
  const product = associationId(association, "product");
  const book = associationId(association, "book");
  const event = associationId(association, "event");
  const document = associationId(association, "document");
  const request = associationId(association, "request");
  const application = associationId(association, "application");
  const cycle = associationId(association, "cycle");
  const expense = associationId(association, "expense");
  const homework = associationId(association, "homework");
  const submission = associationId(association, "submission");
  const lesson = associationId(association, "lesson");
  const notice = associationId(association, "notice");
  const job = associationId(association, "job");

  switch (kind) {
    case "student_avatar":
      return student
        ? `schools/${schoolId}/avatars/students/${student}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "teacher_avatar":
    case "parent_avatar":
    case "school_admin_avatar":
    case "staff_avatar":
    case "bursar_avatar":
      return user
        ? `schools/${schoolId}/avatars/users/${user}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "school_brand_image":
      return `schools/${schoolId}/branding/logo/${file}`;
    case "store_product_image":
      return product
        ? `schools/${schoolId}/store/products/${product}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "library_book_cover":
      return book
        ? `schools/${schoolId}/library/covers/${book}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "academic_calendar_cover":
      return event
        ? `schools/${schoolId}/calendar/events/${event}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "teacher_document":
      if (!teacher) return pendingKey(schoolId, kind, assetUuid, extension);
      return document
        ? `schools/${schoolId}/teachers/${teacher}/documents/${document}/${file}`
        : `schools/${schoolId}/teachers/${teacher}/documents/${file}`;
    case "student_record_document":
      if (!student) return pendingKey(schoolId, kind, assetUuid, extension);
      return document
        ? `schools/${schoolId}/students/${student}/records/${document}/${file}`
        : `schools/${schoolId}/students/${student}/records/${file}`;
    case "parent_document":
      if (!student) return pendingKey(schoolId, kind, assetUuid, extension);
      return request
        ? `schools/${schoolId}/students/${student}/parent-documents/${request}/${file}`
        : `schools/${schoolId}/students/${student}/parent-documents/${file}`;
    case "admission_document": {
      const parent = application ?? cycle;
      return parent
        ? `schools/${schoolId}/admissions/${parent}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    }
    case "expense_receipt":
      return expense
        ? `schools/${schoolId}/finance/expenses/${expense}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "assignment_attachment":
      return homework
        ? `schools/${schoolId}/assignments/${homework}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "submission_attachment":
      return submission
        ? `schools/${schoolId}/submissions/${submission}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "lesson_resource":
      return lesson
        ? `schools/${schoolId}/lessons/${lesson}/resources/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "lesson_illustration":
      return lesson
        ? `schools/${schoolId}/lessons/${lesson}/illustrations/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "notice_attachment":
      return notice
        ? `schools/${schoolId}/notices/${notice}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    case "scheme_import":
      return job
        ? `schools/${schoolId}/schemes/imports/${job}/${file}`
        : pendingKey(schoolId, kind, assetUuid, extension);
    default: {
      const exhaustive: never = kind;
      throw new StorageValidationError(`Unsupported storage kind: ${exhaustive}`);
    }
  }
}
