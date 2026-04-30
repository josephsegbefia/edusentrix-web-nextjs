import mongoose from "mongoose";
import { LibraryNotice, type ILibraryNotice } from "@/models/LibraryNotice";
import type { z } from "zod";
import type {
  createLibraryNoticeBodySchema,
  listAdminLibraryNoticesQuerySchema,
  updateLibraryNoticeBodySchema,
} from "@/lib/library/library.validators";

export type LibraryPatronNoticeContext =
  | {
      kind: "student";
      classGroupId: mongoose.Types.ObjectId;
      gradeId: mongoose.Types.ObjectId;
    }
  | {
      kind: "teacher";
      homeroomClassGroupId?: mongoose.Types.ObjectId | null;
    }
  | {
      kind: "parent";
      wardClassGroupIds: mongoose.Types.ObjectId[];
      wardGradeIds: mongoose.Types.ObjectId[];
    };

type CreateNotice = z.infer<typeof createLibraryNoticeBodySchema>;
type UpdateNotice = z.infer<typeof updateLibraryNoticeBodySchema>;
type ListAdminQuery = z.infer<typeof listAdminLibraryNoticesQuerySchema>;

function noticeMatchesPatron(doc: ILibraryNotice, ctx: LibraryPatronNoticeContext): boolean {
  switch (doc.audience) {
    case "all":
      return true;
    case "students":
      return ctx.kind === "student";
    case "teachers":
      return ctx.kind === "teacher";
    case "parents":
      return ctx.kind === "parent";
    case "class_group": {
      if (!doc.audienceRefId) return false;
      const ref = String(doc.audienceRefId);
      if (ctx.kind === "student") return String(ctx.classGroupId) === ref;
      if (ctx.kind === "teacher")
        return ctx.homeroomClassGroupId ? String(ctx.homeroomClassGroupId) === ref : false;
      return ctx.wardClassGroupIds.some((id) => String(id) === ref);
    }
    case "grade": {
      if (!doc.audienceRefId) return false;
      const ref = String(doc.audienceRefId);
      if (ctx.kind === "student") return String(ctx.gradeId) === ref;
      if (ctx.kind === "parent") return ctx.wardGradeIds.some((id) => String(id) === ref);
      return false;
    }
    default:
      return false;
  }
}

function isPublishedAndActive(doc: ILibraryNotice, now: Date): boolean {
  if (doc.status !== "published") return false;
  if (!doc.publishedAt || doc.publishedAt.getTime() > now.getTime()) return false;
  if (doc.expiresAt && doc.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export async function listPublishedLibraryNoticesForPatron(
  schoolId: mongoose.Types.ObjectId,
  ctx: LibraryPatronNoticeContext,
  opts: { limit: number }
): Promise<ILibraryNotice[]> {
  const now = new Date();
  const limit = Math.min(Math.max(opts.limit, 1), 100);
  const raw = await LibraryNotice.find({
    schoolId,
    status: "published",
    publishedAt: { $lte: now },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ publishedAt: -1 })
    .limit(limit * 4)
    .lean<ILibraryNotice[]>();

  const filtered = raw.filter((d) => isPublishedAndActive(d, now) && noticeMatchesPatron(d, ctx));
  return filtered.slice(0, limit);
}

export async function listAdminLibraryNotices(
  schoolId: mongoose.Types.ObjectId,
  q: ListAdminQuery
): Promise<{ items: ILibraryNotice[]; total: number }> {
  const filter: Record<string, unknown> = { schoolId };
  if (q.status !== "all") {
    filter.status = q.status;
  }
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    LibraryNotice.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean<ILibraryNotice[]>(),
    LibraryNotice.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getLibraryNoticeById(
  schoolId: mongoose.Types.ObjectId,
  noticeId: mongoose.Types.ObjectId
): Promise<ILibraryNotice | null> {
  return LibraryNotice.findOne({ _id: noticeId, schoolId }).lean<ILibraryNotice | null>();
}

export async function createLibraryNotice(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  input: CreateNotice
): Promise<ILibraryNotice> {
  const audienceRefId =
    input.audienceRefId && mongoose.Types.ObjectId.isValid(input.audienceRefId)
      ? new mongoose.Types.ObjectId(input.audienceRefId)
      : undefined;
  if (
    (input.audience === "class_group" || input.audience === "grade") &&
    !audienceRefId
  ) {
    throw new Error("audienceRefId is required for class_group and grade audiences");
  }
  const publishedAt =
    input.status === "published"
      ? new Date()
      : undefined;
  const doc = await LibraryNotice.create({
    schoolId,
    title: input.title,
    message: input.message,
    audience: input.audience,
    audienceRefId:
      input.audience === "class_group" || input.audience === "grade"
        ? audienceRefId
        : undefined,
    expiresAt: input.expiresAt ?? undefined,
    status: input.status ?? "draft",
    publishedAt,
    createdBy: userId,
  });
  return doc.toObject() as ILibraryNotice;
}

export async function updateLibraryNotice(
  schoolId: mongoose.Types.ObjectId,
  noticeId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  patch: UpdateNotice
): Promise<ILibraryNotice | null> {
  const existing = await LibraryNotice.findOne({ _id: noticeId, schoolId });
  if (!existing) return null;

  if (patch.title !== undefined) existing.title = patch.title;
  if (patch.message !== undefined) existing.message = patch.message;
  if (patch.audience !== undefined) existing.audience = patch.audience;
  if (patch.expiresAt !== undefined) {
    existing.expiresAt = patch.expiresAt ?? undefined;
  }
  if (patch.status !== undefined) {
    existing.status = patch.status;
    if (patch.status === "published" && !existing.publishedAt) {
      existing.publishedAt = new Date();
    }
  }

  if (patch.audienceRefId !== undefined) {
    if (patch.audienceRefId === "") {
      existing.audienceRefId = undefined;
    } else if (mongoose.Types.ObjectId.isValid(patch.audienceRefId)) {
      existing.audienceRefId = new mongoose.Types.ObjectId(patch.audienceRefId);
    }
  }

  const aud = existing.audience;
  if ((aud === "class_group" || aud === "grade") && !existing.audienceRefId) {
    throw new Error("audienceRefId is required for class_group and grade audiences");
  }
  if (aud !== "class_group" && aud !== "grade") {
    existing.audienceRefId = undefined;
  }

  existing.updatedBy = userId;
  await existing.save();
  return existing.toObject() as ILibraryNotice;
}

export function serializeLibraryNoticeAdmin(doc: ILibraryNotice) {
  return {
    id: String(doc._id),
    title: doc.title,
    message: doc.message,
    audience: doc.audience,
    audienceRefId: doc.audienceRefId ? String(doc.audienceRefId) : undefined,
    status: doc.status,
    publishedAt: doc.publishedAt?.toISOString() ?? null,
    expiresAt: doc.expiresAt?.toISOString() ?? null,
    createdBy: String(doc.createdBy),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
    createdAt: doc.createdAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

export function serializeLibraryNoticePatron(doc: ILibraryNotice) {
  return {
    id: String(doc._id),
    title: doc.title,
    message: doc.message,
    audience: doc.audience,
    publishedAt: doc.publishedAt?.toISOString() ?? null,
    expiresAt: doc.expiresAt?.toISOString() ?? null,
  };
}
