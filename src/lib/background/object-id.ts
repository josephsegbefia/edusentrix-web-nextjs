import { Types } from "mongoose";

export function optionalObjectId(
  value?: string | Types.ObjectId | null
): Types.ObjectId | null {
  if (!value) return null;
  const raw = String(value);
  if (!Types.ObjectId.isValid(raw)) {
    throw new Error("Invalid ObjectId");
  }
  return new Types.ObjectId(raw);
}

export function requireObjectId(value: string | Types.ObjectId): Types.ObjectId {
  const id = optionalObjectId(value);
  if (!id) throw new Error("Invalid ObjectId");
  return id;
}

export function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000
  );
}
