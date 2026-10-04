import type { Types } from "mongoose";
import type { MembershipRole } from "@/lib/roles";

export const STORAGE_PROVIDER = "r2" as const;
export type StorageProvider = typeof STORAGE_PROVIDER;

export const STORAGE_VISIBILITIES = ["private", "public"] as const;
export type StorageVisibility = (typeof STORAGE_VISIBILITIES)[number];

export const STORAGE_STATUSES = ["pending", "ready", "deleted", "failed"] as const;
export type StorageStatus = (typeof STORAGE_STATUSES)[number];

export const STORAGE_KINDS = [
  "student_avatar",
  "teacher_avatar",
  "parent_avatar",
  "school_admin_avatar",
  "staff_avatar",
  "bursar_avatar",
  "school_brand_image",
  "store_product_image",
  "library_book_cover",
  "teacher_document",
  "student_record_document",
  "expense_receipt",
  "assignment_attachment",
  "lesson_resource",
  "submission_attachment",
  "lesson_illustration",
  "notice_attachment",
  "scheme_import",
  "academic_calendar_cover",
  "admission_document",
  "parent_document",
] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

export const STORAGE_AUTH_POLICIES = [
  "authenticated_membership",
  "school_admin_or_platform",
  "library_cover",
  "token_admission",
  "token_or_authenticated_parent",
] as const;
export type StorageAuthPolicy = (typeof STORAGE_AUTH_POLICIES)[number];

export const STORAGE_ASSOCIATION_TYPES = [
  "student",
  "user",
  "teacher",
  "product",
  "book",
  "event",
  "document",
  "teacherDocument",
  "request",
  "application",
  "cycle",
  "requirement",
  "expense",
  "homework",
  "submission",
  "lesson",
  "resource",
  "notice",
  "job",
] as const;
export type StorageAssociationType = (typeof STORAGE_ASSOCIATION_TYPES)[number];

export type StorageAssociation = {
  type: StorageAssociationType;
  id: string;
};

export type StorageActor = {
  userId: Types.ObjectId | null;
  schoolId: Types.ObjectId;
  roles: MembershipRole[];
  isPlatformOperator?: boolean;
  isPublicToken?: boolean;
};

export type R2ObjectHead = {
  exists: boolean;
  contentType?: string;
  contentLength?: number;
  etag?: string;
};

export type PresignedPutResult = {
  url: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export type PresignedGetResult = {
  url: string;
  expiresInSeconds: number;
};

export type R2Port = {
  createPresignedPut(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<PresignedPutResult>;
  createPresignedGet(input: {
    key: string;
    expiresInSeconds: number;
    contentDisposition: string;
    contentType?: string;
  }): Promise<PresignedGetResult>;
  putObject(input: {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
  }): Promise<{ etag?: string }>;
  headObject(key: string): Promise<R2ObjectHead>;
  getObjectStream(key: string): Promise<{
    body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | null;
    contentType?: string;
    contentLength?: number;
  }>;
  deleteObject(key: string): Promise<void>;
};

export class StorageConfigError extends Error {
  readonly code = "STORAGE_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

export class StorageValidationError extends Error {
  readonly code = "STORAGE_VALIDATION";
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

export class StorageAuthorizationError extends Error {
  readonly code = "STORAGE_AUTHORIZATION";
  readonly status: 401 | 403;
  constructor(message: string, status: 401 | 403 = 403) {
    super(message);
    this.name = "StorageAuthorizationError";
    this.status = status;
  }
}

export class StorageNotFoundError extends Error {
  readonly code = "STORAGE_NOT_FOUND";
  readonly status = 404;
  constructor(message = "Asset not found") {
    super(message);
    this.name = "StorageNotFoundError";
  }
}

export class StorageConflictError extends Error {
  readonly code = "STORAGE_CONFLICT";
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "StorageConflictError";
  }
}

export class StorageProviderError extends Error {
  readonly code = "STORAGE_PROVIDER";
  readonly status = 502;
  constructor(message: string) {
    super(message);
    this.name = "StorageProviderError";
  }
}

export function isStorageKind(value: unknown): value is StorageKind {
  return typeof value === "string" && (STORAGE_KINDS as readonly string[]).includes(value);
}

export function isStorageAssociationType(
  value: unknown
): value is StorageAssociationType {
  return (
    typeof value === "string" &&
    (STORAGE_ASSOCIATION_TYPES as readonly string[]).includes(value)
  );
}
