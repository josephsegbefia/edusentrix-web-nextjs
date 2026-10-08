import { z } from "zod";
import { parseStoredAssetId } from "@/lib/storage/urls";

const PHOTO_URL_MESSAGE = "Invalid photo URL";

/** `{uuid}.{jpg|jpeg|png|webp}` object file written by the storage key builder. */
const PHOTO_OBJECT_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i;

/** Tenant storage key, e.g. `schools/{schoolId}/pending/student_avatar/{uuid}.png`. */
const STORAGE_KEY =
  /^schools\/[a-fA-F0-9]{24}\/.+\.(?:jpe?g|png|webp)$/i;

export function isPhotoObjectName(value: string): boolean {
  return PHOTO_OBJECT_NAME.test(value);
}

export function isEduSentrixStorageKey(value: string): boolean {
  if (value.includes("..") || value.includes("://") || /\s/.test(value)) return false;
  return STORAGE_KEY.test(value);
}

/** Blank, an internal asset path, a legacy http(s) URL, or the R2 key/object name from upload. */
export function isAcceptablePhotoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return false;
  if (parseStoredAssetId(trimmed)) return true;
  if (isPhotoObjectName(trimmed) || isEduSentrixStorageKey(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Photo saved from ImageUploader: `/api/storage/assets/{id}`, a legacy
 * absolute URL, an R2 storage key, the uploaded `{uuid}.ext` object name, or blank.
 * Callers that persist the value should resolve keys and object names to the
 * internal asset path before writing.
 */
export const optionalPhotoUrlSchema = z
  .string()
  .trim()
  .refine(isAcceptablePhotoUrl, { message: PHOTO_URL_MESSAGE })
  .optional()
  .nullable();
