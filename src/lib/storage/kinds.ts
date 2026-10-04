import {
  STORAGE_KINDS,
  StorageValidationError,
  type StorageAuthPolicy,
  type StorageKind,
  type StorageVisibility,
} from "./types";

export const BYTES_PER_MB = 1024 * 1024;
export const BYTES_8MB = 8 * BYTES_PER_MB;
export const BYTES_16MB = 16 * BYTES_PER_MB;
export const BYTES_64MB = 64 * BYTES_PER_MB;

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const PDF_MIME_TYPES = ["application/pdf"] as const;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const CSV_MIME_TYPES = ["text/csv"] as const;

export const EXCEL_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const POWERPOINT_MIME_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const WORD_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const SAFE_INLINE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type MimeLimit = {
  mimeTypes: readonly string[];
  maxBytes: number;
};

export type StorageKindDefinition = {
  kind: StorageKind;
  limits: readonly MimeLimit[];
  defaultVisibility: StorageVisibility;
  keyCategory: string;
  authPolicy: StorageAuthPolicy;
  requiresDocumentsStorage: boolean;
};

const IMAGE_8MB: MimeLimit = { mimeTypes: IMAGE_MIME_TYPES, maxBytes: BYTES_8MB };

const TEACHER_DOCUMENT_LIMITS: readonly MimeLimit[] = [
  { mimeTypes: PDF_MIME_TYPES, maxBytes: BYTES_16MB },
  IMAGE_8MB,
  { mimeTypes: VIDEO_MIME_TYPES, maxBytes: BYTES_64MB },
  { mimeTypes: CSV_MIME_TYPES, maxBytes: BYTES_8MB },
  { mimeTypes: EXCEL_MIME_TYPES, maxBytes: BYTES_16MB },
  { mimeTypes: POWERPOINT_MIME_TYPES, maxBytes: BYTES_16MB },
  { mimeTypes: WORD_MIME_TYPES, maxBytes: BYTES_16MB },
];

const ASSIGNMENT_LIMITS: readonly MimeLimit[] = [
  { mimeTypes: PDF_MIME_TYPES, maxBytes: BYTES_16MB },
  IMAGE_8MB,
  { mimeTypes: CSV_MIME_TYPES, maxBytes: BYTES_8MB },
  { mimeTypes: EXCEL_MIME_TYPES, maxBytes: BYTES_16MB },
  { mimeTypes: WORD_MIME_TYPES, maxBytes: BYTES_16MB },
];

const ADMISSION_LIMITS: readonly MimeLimit[] = [
  { mimeTypes: PDF_MIME_TYPES, maxBytes: BYTES_16MB },
  IMAGE_8MB,
  { mimeTypes: WORD_MIME_TYPES, maxBytes: BYTES_16MB },
];

const NOTICE_LIMITS: readonly MimeLimit[] = [
  { mimeTypes: PDF_MIME_TYPES, maxBytes: BYTES_8MB },
  IMAGE_8MB,
  { mimeTypes: WORD_MIME_TYPES, maxBytes: BYTES_8MB },
];

const RECEIPT_LIMITS: readonly MimeLimit[] = [
  { mimeTypes: PDF_MIME_TYPES, maxBytes: BYTES_8MB },
  IMAGE_8MB,
];

function avatar(kind: StorageKind): StorageKindDefinition {
  return {
    kind,
    limits: [IMAGE_8MB],
    defaultVisibility: "public",
    keyCategory: "avatar",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: false,
  };
}

export const STORAGE_KIND_REGISTRY: Record<StorageKind, StorageKindDefinition> = {
  student_avatar: avatar("student_avatar"),
  teacher_avatar: avatar("teacher_avatar"),
  parent_avatar: avatar("parent_avatar"),
  school_admin_avatar: avatar("school_admin_avatar"),
  staff_avatar: avatar("staff_avatar"),
  bursar_avatar: avatar("bursar_avatar"),
  school_brand_image: {
    kind: "school_brand_image",
    limits: [IMAGE_8MB],
    defaultVisibility: "public",
    keyCategory: "branding",
    authPolicy: "school_admin_or_platform",
    requiresDocumentsStorage: false,
  },
  store_product_image: {
    kind: "store_product_image",
    limits: [IMAGE_8MB],
    defaultVisibility: "public",
    keyCategory: "store_product",
    authPolicy: "school_admin_or_platform",
    requiresDocumentsStorage: false,
  },
  library_book_cover: {
    kind: "library_book_cover",
    limits: [IMAGE_8MB],
    defaultVisibility: "public",
    keyCategory: "library_cover",
    authPolicy: "library_cover",
    requiresDocumentsStorage: true,
  },
  teacher_document: {
    kind: "teacher_document",
    limits: TEACHER_DOCUMENT_LIMITS,
    defaultVisibility: "private",
    keyCategory: "teacher_document",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  student_record_document: {
    kind: "student_record_document",
    limits: TEACHER_DOCUMENT_LIMITS,
    defaultVisibility: "private",
    keyCategory: "student_record",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  expense_receipt: {
    kind: "expense_receipt",
    limits: RECEIPT_LIMITS,
    defaultVisibility: "private",
    keyCategory: "expense_receipt",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  assignment_attachment: {
    kind: "assignment_attachment",
    limits: ASSIGNMENT_LIMITS,
    defaultVisibility: "private",
    keyCategory: "assignment",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  lesson_resource: {
    kind: "lesson_resource",
    limits: ASSIGNMENT_LIMITS,
    defaultVisibility: "private",
    keyCategory: "lesson_resource",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  submission_attachment: {
    kind: "submission_attachment",
    limits: ASSIGNMENT_LIMITS,
    defaultVisibility: "private",
    keyCategory: "submission",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  lesson_illustration: {
    kind: "lesson_illustration",
    limits: [IMAGE_8MB],
    defaultVisibility: "public",
    keyCategory: "lesson_illustration",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  notice_attachment: {
    kind: "notice_attachment",
    limits: NOTICE_LIMITS,
    defaultVisibility: "private",
    keyCategory: "notice",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  scheme_import: {
    kind: "scheme_import",
    limits: TEACHER_DOCUMENT_LIMITS,
    defaultVisibility: "private",
    keyCategory: "scheme_import",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  academic_calendar_cover: {
    kind: "academic_calendar_cover",
    limits: [IMAGE_8MB],
    defaultVisibility: "public",
    keyCategory: "calendar",
    authPolicy: "authenticated_membership",
    requiresDocumentsStorage: true,
  },
  admission_document: {
    kind: "admission_document",
    limits: ADMISSION_LIMITS,
    defaultVisibility: "private",
    keyCategory: "admission",
    authPolicy: "token_admission",
    requiresDocumentsStorage: false,
  },
  parent_document: {
    kind: "parent_document",
    limits: RECEIPT_LIMITS,
    defaultVisibility: "private",
    keyCategory: "parent_document",
    authPolicy: "token_or_authenticated_parent",
    requiresDocumentsStorage: true,
  },
};

export const FOUNDATION_AUTH_POLICIES: readonly StorageAuthPolicy[] = [
  "authenticated_membership",
  "school_admin_or_platform",
  "library_cover",
];

export function getStorageKindDefinition(kind: StorageKind): StorageKindDefinition {
  return STORAGE_KIND_REGISTRY[kind];
}

export function parseStorageKind(value: unknown): StorageKind {
  if (typeof value !== "string" || !(STORAGE_KINDS as readonly string[]).includes(value)) {
    throw new StorageValidationError("Unknown storage kind");
  }
  return value as StorageKind;
}

export function findMimeLimit(
  kind: StorageKind,
  mimeType: string
): MimeLimit | null {
  const normalized = normalizeMimeType(mimeType);
  return (
    STORAGE_KIND_REGISTRY[kind].limits.find((limit) =>
      limit.mimeTypes.some((allowed) => normalizeMimeType(allowed) === normalized)
    ) ?? null
  );
}

export function assertKindAllowsMime(kind: StorageKind, mimeType: string): MimeLimit {
  const limit = findMimeLimit(kind, mimeType);
  if (!limit) {
    throw new StorageValidationError("This file type is not allowed for this upload");
  }
  return limit;
}

export function maxBytesForKindMime(kind: StorageKind, mimeType: string): number {
  return assertKindAllowsMime(kind, mimeType).maxBytes;
}

export function normalizeMimeType(mimeType: string): string {
  const base = mimeType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  if (base === "image/jpg") return "image/jpeg";
  return base;
}

export function isSafeInlineMime(mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType);
  return (SAFE_INLINE_MIME_TYPES as readonly string[]).includes(normalized);
}

export function allAllowedMimeTypes(kind: StorageKind): string[] {
  return STORAGE_KIND_REGISTRY[kind].limits.flatMap((limit) => [...limit.mimeTypes]);
}
