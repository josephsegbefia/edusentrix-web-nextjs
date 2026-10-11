import { randomUUID } from "node:crypto";
import { Types, type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireSchoolFeature } from "@/lib/subscriptions/guards";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";
import { ExamPaper } from "@/models/ExamPaper";
import { Student } from "@/models/Student";
import { ScriptSubmission, type IScriptSubmission } from "@/models/ScriptSubmission";
import { StoredAsset } from "@/models/StoredAsset";
import {
  presignUpload,
  completeUpload,
  STORED_ASSET_RECOVERY_DAYS,
} from "@/lib/storage/service";
import { enforceKindUploadPolicy } from "@/lib/storage/http";
import { assertObjectIdHex } from "@/lib/storage/ids";
import type { StorageActor } from "@/lib/storage/types";

type ScriptSubmissionDocument = HydratedDocument<IScriptSubmission>;

async function retireSubmissionAssets(
  schoolId: Types.ObjectId,
  submissionId: Types.ObjectId,
  at = new Date()
) {
  const purgeAfter = new Date(at.getTime() + STORED_ASSET_RECOVERY_DAYS * 24 * 60 * 60 * 1000);
  const result = await StoredAsset.updateMany(
    {
      schoolId,
      kind: "assess_script_page",
      "association.type": "scriptSubmission",
      "association.id": submissionId,
      status: { $in: ["pending", "ready", "failed"] },
    },
    { $set: { status: "deleted", deletedAt: at, purgeAfter } }
  );
  return result.modifiedCount;
}

export const MAX_SCRIPT_PAGES = 40;
export const MAX_SCRIPT_PAGE_BYTES = 8 * 1024 * 1024;
export const SCRIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SCRIPT_DRAFT_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function scannerContext() {
  const ctx = await requireSchoolAdmin();
  const gate = await requireSchoolFeature(ctx.schoolId, FEATURE_KEYS.ASSESSMENT_EXAMINATIONS);
  if (!gate.allowed) {
    throw NextResponse.json({ success: false, error: gate.reason }, { status: gate.statusCode });
  }
  await connectToDatabase();
  const actor: StorageActor = {
    userId: ctx.userId,
    schoolId: ctx.schoolId,
    roles: ["school_admin"],
  };
  return { ...ctx, actor };
}

export function parseId(value: string, label: string): Types.ObjectId {
  return new Types.ObjectId(assertObjectIdHex(value, label));
}

export async function eligibleExam(examPaperId: string, schoolId: Types.ObjectId) {
  const id = parseId(examPaperId, "exam paper id");
  const paper = await ExamPaper.findOne({
    _id: id,
    schoolId,
    status: { $in: ["approved", "printed", "completed"] },
  }).lean();
  if (!paper) throw NextResponse.json({ success: false, error: "Examination is not eligible for scanning." }, { status: 404 });
  return paper;
}

export function serializeSubmission(row: IScriptSubmission) {
  return {
    id: String(row._id),
    schoolId: String(row.schoolId),
    examPaperId: String(row.examPaperId),
    studentId: String(row.studentId),
    submittedByUserId: String(row.submittedByUserId),
    status: row.status,
    pageCount: row.pages.length,
    pages: row.pages.map((page) => ({
      pageId: page.pageId,
      pageNumber: page.pageNumber,
      status: page.status,
      mimeType: page.mimeType,
      sizeBytes: page.sizeBytes,
      assetId: page.assetId ? String(page.assetId) : null,
    })),
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createSubmission(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  examPaperId: string;
  studentId: string;
  idempotencyKey: string;
}) {
  const paper = await eligibleExam(input.examPaperId, input.schoolId);
  const studentId = parseId(input.studentId, "student id");
  const studentFilter = paper.scope === "grade_wide"
    ? { gradeId: paper.gradeId }
    : { classGroupId: { $in: [paper.classGroupId, ...(paper.classGroupIds ?? [])].filter(Boolean) } };
  const student = await Student.findOne({ _id: studentId, schoolId: input.schoolId, status: "active", ...studentFilter }).lean();
  if (!student) throw NextResponse.json({ success: false, error: "Student is not eligible for this examination." }, { status: 403 });

  const existing = await ScriptSubmission.findOne({ schoolId: input.schoolId, idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (String(existing.submittedByUserId) !== String(input.userId)) {
      throw NextResponse.json({ success: false, error: "Idempotency key is already in use." }, { status: 409 });
    }
    if (String(existing.examPaperId) !== String(paper._id) || String(existing.studentId) !== String(studentId)) {
      throw NextResponse.json({ success: false, error: "Idempotency key is already bound to another script." }, { status: 409 });
    }
    return { submission: existing, created: false, paper, student };
  }
  try {
    const submission = await ScriptSubmission.create({
      schoolId: input.schoolId,
      examPaperId: paper._id,
      studentId,
      submittedByUserId: input.userId,
      status: "awaiting_uploads",
      idempotencyKey: input.idempotencyKey,
      pages: [],
      auditEvents: [{ type: "created", actorUserId: input.userId, pageId: null }],
    });
    return { submission, created: true, paper, student };
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      const submission = await ScriptSubmission.findOne({ schoolId: input.schoolId, idempotencyKey: input.idempotencyKey });
      if (submission) {
        if (String(submission.submittedByUserId) !== String(input.userId)) {
          throw NextResponse.json({ success: false, error: "Idempotency key is already in use." }, { status: 409 });
        }
        if (String(submission.examPaperId) !== String(paper._id) || String(submission.studentId) !== String(studentId)) {
          throw NextResponse.json({ success: false, error: "Idempotency key is already bound to another script." }, { status: 409 });
        }
        return { submission, created: false, paper, student };
      }
    }
    throw error;
  }
}

export async function ownSubmission(id: string, schoolId: Types.ObjectId, userId: Types.ObjectId) {
  const submission = await ScriptSubmission.findOne({
    _id: parseId(id, "submission id"),
    schoolId,
    submittedByUserId: userId,
  });
  if (!submission) throw NextResponse.json({ success: false, error: "Submission not found." }, { status: 404 });
  return submission;
}

export async function initializePage(input: {
  submission: ScriptSubmissionDocument;
  userId: Types.ObjectId;
  fileName: string;
  mimeType: string;
  pageNumber: number;
}) {
  if (input.submission.status === "received" || input.submission.status === "cancelled") {
    throw NextResponse.json({ success: false, error: "Finalized submissions cannot be changed." }, { status: 409 });
  }
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > MAX_SCRIPT_PAGES) {
    throw NextResponse.json({ success: false, error: "Invalid page number." }, { status: 400 });
  }
  if (input.submission.pages.some((page) => page.pageNumber === input.pageNumber)) {
    throw NextResponse.json({ success: false, error: "Page number is already registered." }, { status: 409 });
  }
  if (!SCRIPT_MIME_TYPES.includes(input.mimeType as (typeof SCRIPT_MIME_TYPES)[number])) {
    throw NextResponse.json({ success: false, error: "Only JPEG, PNG and WebP pages are supported." }, { status: 400 });
  }
  const actor: StorageActor = {
    userId: input.userId,
    schoolId: input.submission.schoolId,
    roles: ["school_admin"],
  };
  await enforceKindUploadPolicy(actor, "assess_script_page", {
    type: "scriptSubmission",
    id: String(input.submission._id),
  });
  const pageId = randomUUID();
  const asset = await presignUpload({
    actor,
    kind: "assess_script_page",
    fileName: input.fileName,
    mimeType: input.mimeType,
    association: { type: "scriptSubmission", id: String(input.submission._id) },
  });
  const page = { pageId, assetId: new Types.ObjectId(asset.assetId), pageNumber: input.pageNumber, mimeType: input.mimeType, sizeBytes: null, status: "pending" as const, createdAt: new Date(), completedAt: null };
  const updated = await ScriptSubmission.findOneAndUpdate(
    {
      _id: input.submission._id,
      schoolId: input.submission.schoolId,
      status: { $nin: ["received", "cancelled"] },
      pages: { $not: { $elemMatch: { pageNumber: input.pageNumber } } },
    },
    { $push: { pages: page, auditEvents: { type: "page_initialized", actorUserId: input.userId, pageId } } },
    { new: true }
  );
  if (!updated) {
    await retireSubmissionAssets(input.submission.schoolId, input.submission._id);
    throw NextResponse.json({ success: false, error: "Page number is already registered or the submission is locked." }, { status: 409 });
  }
  return { pageId, ...asset };
}

export async function completePage(input: { submission: ScriptSubmissionDocument; pageId: string; assetId: string; actor: StorageActor }) {
  if (input.submission.status === "received" || input.submission.status === "cancelled") {
    throw NextResponse.json({ success: false, error: "Finalized submissions cannot be changed." }, { status: 409 });
  }
  const page = input.submission.pages.find((candidate) => candidate.pageId === input.pageId);
  if (!page || !page.assetId || String(page.assetId) !== input.assetId) throw NextResponse.json({ success: false, error: "Page upload does not belong to this submission." }, { status: 403 });
  const completed = await completeUpload({ actor: input.actor, assetId: input.assetId });
  if (completed.sizeBytes > MAX_SCRIPT_PAGE_BYTES) throw NextResponse.json({ success: false, error: "Page exceeds the maximum size." }, { status: 400 });
  const updated = await ScriptSubmission.findOneAndUpdate(
    {
      _id: input.submission._id,
      schoolId: input.submission.schoolId,
      status: { $nin: ["received", "cancelled"] },
      pages: { $elemMatch: { pageId: input.pageId, assetId: new Types.ObjectId(input.assetId), status: "pending" } },
    },
    {
      $set: { "pages.$.status": "ready", "pages.$.sizeBytes": completed.sizeBytes, "pages.$.completedAt": new Date(), status: "awaiting_uploads" },
      $push: { auditEvents: { type: "page_completed", actorUserId: input.actor.userId, pageId: input.pageId } },
    },
    { new: true }
  );
  if (!updated) {
    const current = await ScriptSubmission.findOne({
      _id: input.submission._id,
      schoolId: input.submission.schoolId,
      submittedByUserId: input.actor.userId,
    });
    const currentPage = current?.pages.find((candidate) => candidate.pageId === input.pageId);
    if (currentPage?.status === "ready" && String(currentPage.assetId) === input.assetId) {
      return completed;
    }
    if (!current || current.status === "received" || current.status === "cancelled") {
      await retireSubmissionAssets(input.submission.schoolId, input.submission._id);
      throw NextResponse.json({ success: false, error: "Submission is no longer accepting pages." }, { status: 409 });
    }
    throw NextResponse.json({ success: false, error: "Page completion could not be recorded." }, { status: 409 });
  }
  return completed;
}

export async function finalizeSubmission(input: { submission: ScriptSubmissionDocument; userId: Types.ObjectId }) {
  if (input.submission.status === "received") return input.submission;
  if (input.submission.status === "cancelled") throw NextResponse.json({ success: false, error: "Submission is cancelled." }, { status: 409 });
  const updated = await ScriptSubmission.findOneAndUpdate(
    {
      _id: input.submission._id,
      schoolId: input.submission.schoolId,
      status: { $nin: ["received", "cancelled"] },
      "pages.0": { $exists: true },
      pages: { $not: { $elemMatch: { status: { $ne: "ready" } } } },
    },
    { $set: { status: "received", finalizedAt: new Date() }, $push: { auditEvents: { type: "finalized", actorUserId: input.userId, pageId: null } } },
    { new: true }
  );
  if (updated) return updated;
  const current = await ScriptSubmission.findById(input.submission._id);
  if (current?.status === "received") return current;
  if (!current || current.status === "cancelled" || current.pages.length === 0 || current.pages.some((page) => page.status !== "ready")) {
    await ScriptSubmission.updateOne(
      { _id: input.submission._id, status: { $nin: ["received", "cancelled"] } },
      { $set: { status: "upload_incomplete" } }
    );
    throw NextResponse.json({ success: false, error: "Every page must finish uploading before finalization." }, { status: 409 });
  }
  return current;
}

export async function cancelSubmission(input: { submission: ScriptSubmissionDocument; userId: Types.ObjectId }) {
  const cancelled = await ScriptSubmission.findOneAndUpdate(
    { _id: input.submission._id, schoolId: input.submission.schoolId, status: { $nin: ["received", "cancelled"] } },
    { $set: { status: "cancelled", cancelledAt: new Date() }, $push: { auditEvents: { type: "cancelled", actorUserId: input.userId, pageId: null } } },
    { new: true }
  );
  if (cancelled) {
    await retireSubmissionAssets(input.submission.schoolId, input.submission._id, cancelled.cancelledAt ?? new Date());
    return cancelled;
  }
  const current = await ScriptSubmission.findById(input.submission._id);
  if (current?.status === "cancelled") return current;
  throw NextResponse.json({ success: false, error: "Received submissions cannot be cancelled." }, { status: 409 });
}

/** Marks abandoned, non-finalized drafts as cancelled. It never touches received rows. */
export async function expireAbandonedSubmissions(now = new Date()) {
  const cutoff = new Date(now.getTime() - SCRIPT_DRAFT_RETENTION_MS);
  const candidates = await ScriptSubmission.find({
    status: { $in: ["draft", "awaiting_uploads", "upload_incomplete"] },
    updatedAt: { $lt: cutoff },
  })
    .select({ _id: 1, schoolId: 1 })
    .limit(500)
    .lean();
  let modifiedCount = 0;
  let assetsMarkedDeleted = 0;
  for (const candidate of candidates) {
    const cancelled = await ScriptSubmission.findOneAndUpdate(
      {
        _id: candidate._id,
        status: { $in: ["draft", "awaiting_uploads", "upload_incomplete"] },
        updatedAt: { $lt: cutoff },
      },
      { $set: { status: "cancelled", cancelledAt: now } },
      { new: true }
    );
    if (!cancelled) continue;
    modifiedCount += 1;
    assetsMarkedDeleted += await retireSubmissionAssets(candidate.schoolId, candidate._id, now);
  }
  return { matchedCount: modifiedCount, modifiedCount, assetsMarkedDeleted };
}
