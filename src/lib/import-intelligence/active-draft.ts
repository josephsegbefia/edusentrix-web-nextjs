import type { Model } from "mongoose";

export const ACTIVE_IMPORT_STATUSES = ["uploaded", "analyzing", "review_ready", "failed"] as const;

export class ActiveImportDraftError extends Error {
  readonly code = "ACTIVE_IMPORT_DRAFT_EXISTS";
  readonly importJobId: string;

  constructor(importJobId: unknown) {
    super("You already have an unfinished import draft for this school and import type.");
    this.name = "ActiveImportDraftError";
    this.importJobId = String(importJobId);
  }
}

export async function findActiveImportDraft<T>(input: {
  model: Pick<Model<T>, "findOne">;
  schoolId: unknown;
  createdByUserId: unknown;
}) {
  return input.model.findOne({
    schoolId: input.schoolId,
    createdByUserId: input.createdByUserId,
    status: { $in: [...ACTIVE_IMPORT_STATUSES] },
  }).sort({ updatedAt: -1 });
}

export async function assertNoActiveImportDraft<T>(input: {
  model: Pick<Model<T>, "findOne">;
  schoolId: unknown;
  createdByUserId: unknown;
}) {
  const existing = await findActiveImportDraft(input);
  if (existing) throw new ActiveImportDraftError((existing as { _id?: unknown })._id);
}

export function importDomainFromActiveDraftError(error: unknown) {
  return error instanceof ActiveImportDraftError ? { code: error.code, importJobId: error.importJobId } : null;
}
