import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";
import { DemoActionBlockedError } from "@/lib/demo/action-policy";
import { canUploadLibraryBookCover } from "@/lib/library/library-upload-gate";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";
import { requireSchoolFeature } from "@/lib/subscriptions/guards";
import { getStorageKindDefinition } from "./kinds";
import {
  StorageAuthorizationError,
  StorageConfigError,
  StorageConflictError,
  StorageNotFoundError,
  StorageProviderError,
  StorageValidationError,
  type StorageActor,
  type StorageKind,
} from "./types";

export async function resolveStorageActor(): Promise<StorageActor> {
  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    if (active.reason === "unauthorized") {
      throw new StorageAuthorizationError("Unauthorized", 401);
    }
    throw new StorageAuthorizationError("No active school", 403);
  }
  return {
    userId: active.context.userId,
    schoolId: active.context.schoolId,
    roles: active.context.roles,
    isPlatformOperator: active.context.source === "assisted_access",
  };
}

export async function enforceKindUploadPolicy(
  actor: StorageActor,
  kind: StorageKind
): Promise<void> {
  const definition = getStorageKindDefinition(kind);
  if (definition.requiresDocumentsStorage) {
    const feature = await requireSchoolFeature(
      actor.schoolId,
      FEATURE_KEYS.DOCUMENTS_STORAGE
    );
    if (!feature.allowed) {
      throw new StorageAuthorizationError(
        feature.reason || "Document storage is not available for this school"
      );
    }
  }
  if (definition.authPolicy === "library_cover") {
    if (!actor.userId) {
      throw new StorageAuthorizationError(
        "Not allowed to upload library covers for this school"
      );
    }
    const allowed = await canUploadLibraryBookCover({
      schoolId: actor.schoolId,
      userId: actor.userId,
      role: actor.isPlatformOperator
        ? "platform_admin"
        : actor.roles.includes("school_admin")
          ? "school_admin"
          : actor.roles[0] ?? null,
    });
    if (!allowed) {
      throw new StorageAuthorizationError(
        "Not allowed to upload library covers for this school"
      );
    }
  }
}

export function storageErrorResponse(error: unknown): {
  status: number;
  body: { success: false; error: string };
} {
  if (error instanceof DemoActionBlockedError) {
    return { status: 403, body: { success: false, error: error.message } };
  }
  if (error instanceof StorageAuthorizationError) {
    return { status: error.status, body: { success: false, error: error.message } };
  }
  if (error instanceof StorageValidationError) {
    return { status: error.status, body: { success: false, error: error.message } };
  }
  if (error instanceof StorageNotFoundError) {
    return { status: error.status, body: { success: false, error: error.message } };
  }
  if (error instanceof StorageConflictError) {
    return { status: error.status, body: { success: false, error: error.message } };
  }
  if (error instanceof StorageConfigError) {
    return { status: 503, body: { success: false, error: "Storage is not configured" } };
  }
  if (error instanceof StorageProviderError) {
    return { status: error.status, body: { success: false, error: error.message } };
  }
  return { status: 500, body: { success: false, error: "Storage request failed" } };
}
