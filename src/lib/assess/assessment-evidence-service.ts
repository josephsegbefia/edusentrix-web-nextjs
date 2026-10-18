import { createHash, randomUUID } from "node:crypto";
import mongoose, { Types, type ClientSession } from "mongoose";
import { AssessmentDeliveryVersion, type IAssessmentDeliveryVersion } from "@/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket, type IAssessmentPaperPacket } from "@/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment } from "@/models/AssessmentPaperPacketAssignment";
import { AssessmentPaperPacketCorrection } from "@/models/AssessmentPaperPacketCorrection";
import { AssessmentEvidenceCaptureSession, type IAssessmentEvidenceCaptureSession } from "@/models/AssessmentEvidenceCaptureSession";
import { AssessmentEvidencePage, type IAssessmentEvidencePage, type AssessmentEvidenceReconciliationOutcome } from "@/models/AssessmentEvidencePage";
import { AssessmentEvidenceReceipt, type IAssessmentEvidenceReceipt } from "@/models/AssessmentEvidenceReceipt";
import { AssessmentEvidenceDeletionRequest } from "@/models/AssessmentEvidenceDeletionRequest";
import { StoredAsset } from "@/models/StoredAsset";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import type { AuditRequestContext } from "@/lib/audit/types";
import { getStorageKindDefinition, maxBytesForKindMime, normalizeMimeType } from "@/lib/storage/kinds";
import { buildStorageKey } from "@/lib/storage/key-builder";
import { getR2Port } from "@/lib/storage/r2";
import { DEFAULT_SIGNED_URL_TTL_SECONDS, getR2Config, isR2Configured } from "@/lib/storage/config";
import { contentDispositionValue, sanitizeDisplayFileName } from "@/lib/storage/filename";
import { getStoredAssetUrl } from "@/lib/storage/urls";
import { assertObjectIdHex } from "@/lib/storage/ids";
import { StorageAuthorizationError, StorageConflictError, StorageNotFoundError, StorageValidationError, type PresignedPutResult, type R2Port, type StorageActor } from "@/lib/storage/types";

const TRANSACTION_OPTIONS = { readConcern: { level: "snapshot" as const }, writeConcern: { w: "majority" as const }, maxCommitTimeMS: 10_000 };
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSION_PAGES = 500;
const EVIDENCE_KIND = "assess_script_page" as const;
const EVIDENCE_ASSOCIATION = "assessmentEvidencePage" as const;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class AssessmentEvidenceError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 502 | 503;
  constructor(message: string, status: 400 | 401 | 403 | 404 | 409 | 413 | 502 | 503 = 409) { super(message); this.name = "AssessmentEvidenceError"; this.status = status; }
}

export type AssessmentEvidenceActor = {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  isAdmin: boolean;
  premiumPublicationEntitled: boolean;
};

type AuditInput = { context?: AuditRequestContext; idempotencyKey: string };

function oid(value: string | Types.ObjectId | null | undefined, label: string) {
  if (!value || !Types.ObjectId.isValid(String(value))) throw new AssessmentEvidenceError(`${label} is invalid`, 400);
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}
function same(left: unknown, right: unknown) { return String(left) === String(right); }
function duplicate(error: unknown) { return Boolean(error && typeof error === "object" && (error as { code?: number }).code === 11000); }
function transient(error: unknown) {
  const value = error as { errorLabels?: unknown; message?: string } | null;
  const message = String(value?.message ?? "").toLowerCase();
  return Array.isArray(value?.errorLabels) && (value.errorLabels.includes("TransientTransactionError") || value.errorLabels.includes("UnknownTransactionCommitResult")) || message.includes("write conflict") || message.includes("temporarily unavailable");
}
async function transaction<T>(callback: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let last: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { return await session.withTransaction(() => callback(session), TRANSACTION_OPTIONS); }
      catch (error) { last = error; if (!transient(error) || attempt === 4) throw error; }
    }
    throw last instanceof Error ? last : new Error("Evidence transaction failed");
  } finally { await session.endSession(); }
}
function assertActor(actor: AssessmentEvidenceActor) {
  if (!actor.isAdmin) throw new AssessmentEvidenceError("Only school administrators can manage examination evidence", 403);
  if (!actor.premiumPublicationEntitled) throw new AssessmentEvidenceError("Premium Assess evidence entitlement is required", 403);
}
function context(actor: AssessmentEvidenceActor, input: AuditInput, suffix: string): AuditRequestContext {
  const c = input.context;
  return { requestId: c?.requestId || randomUUID(), correlationId: c?.correlationId || c?.requestId || randomUUID(), idempotencyKey: `${input.idempotencyKey}:${suffix}`, actorType: "user", actorId: actor.userId, actorRole: "school_admin", actorEmail: c?.actorEmail ?? null, actorName: c?.actorName ?? null, schoolId: actor.schoolId, ipAddress: c?.ipAddress ?? null, userAgent: c?.userAgent ?? null, routePath: c?.routePath ?? null, clientSurface: c?.clientSurface ?? "api" };
}
function assertKey(value: string, label: string) {
  const key = value.trim();
  if (key.length < 8 || key.length > 240) throw new AssessmentEvidenceError(`A valid ${label} is required`, 400);
  return key;
}
function signedTtlSeconds() {
  if (isR2Configured()) return getR2Config().signedUrlTtlSeconds;
  const raw = process.env.R2_SIGNED_URL_TTL_SECONDS?.trim();
  const ttl = raw ? Number(raw) : DEFAULT_SIGNED_URL_TTL_SECONDS;
  return Number.isFinite(ttl) && ttl >= 30 && ttl <= 900 ? ttl : DEFAULT_SIGNED_URL_TTL_SECONDS;
}
function serializeSession(row: IAssessmentEvidenceCaptureSession) {
  return { id: String(row._id), schoolId: String(row.schoolId), deliveryId: String(row.assessmentDeliveryVersionId), operatorUserId: String(row.operatorUserId), deviceSessionId: row.deviceSessionId, status: row.status, expiresAt: row.expiresAt, revokedAt: row.revokedAt, closedAt: row.closedAt, lastSeenAt: row.lastSeenAt, createdAt: row.createdAt };
}
function serializePage(row: IAssessmentEvidencePage, receipt?: IAssessmentEvidenceReceipt | null) {
  return { id: String(row._id), schoolId: String(row.schoolId), deliveryId: String(row.assessmentDeliveryVersionId), sessionId: String(row.captureSessionId), packetId: row.packetId ? String(row.packetId) : null, observedPacketId: row.observedPacketId, pageId: row.pageId, expectedPageNumber: row.expectedPageNumber, expectedPageCount: row.expectedPageCount, captureOrder: row.captureOrder, assignmentId: row.assignmentId ? String(row.assignmentId) : null, assetId: row.assetId ? String(row.assetId) : null, digestAlgorithm: row.digestAlgorithm, verifiedDigest: row.verifiedDigest, integrityStatus: row.integrityStatus, status: row.status, reconciliationOutcome: row.reconciliationOutcome, retentionPolicyRef: row.retentionPolicyRef, retentionUntil: row.retentionUntil, legalHold: row.legalHold, deletionStatus: row.deletionStatus, uploadedAt: row.uploadedAt, verifiedAt: row.verifiedAt, receipt: receipt ? { id: String(receipt._id), receiptKey: receipt.receiptKey, status: receipt.status, digest: receipt.digest, sizeBytes: receipt.sizeBytes, issuedAt: receipt.issuedAt } : null };
}
async function deliveryForActor(schoolId: Types.ObjectId, deliveryId: Types.ObjectId, session?: ClientSession) {
  const query = AssessmentDeliveryVersion.findOne({ _id: deliveryId, schoolId });
  const delivery = await (session ? query.session(session) : query).lean<IAssessmentDeliveryVersion | null>();
  if (!delivery) throw new AssessmentEvidenceError("Assessment delivery not found", 404);
  if (delivery.mode !== "paper" || !["published", "active"].includes(delivery.status)) throw new AssessmentEvidenceError("Only published or active paper deliveries can receive evidence", 409);
  return delivery;
}
async function liveSession(input: { actor: AssessmentEvidenceActor; sessionId: Types.ObjectId; session?: ClientSession }) {
  const query = AssessmentEvidenceCaptureSession.findOne({ _id: input.sessionId, schoolId: input.actor.schoolId, operatorUserId: input.actor.userId });
  const row = await (input.session ? query.session(input.session) : query).lean<IAssessmentEvidenceCaptureSession | null>();
  if (!row) throw new AssessmentEvidenceError("Capture session not found", 404);
  if (row.status !== "active") throw new AssessmentEvidenceError("Capture session is not active", 403);
  if (row.expiresAt.getTime() <= Date.now()) {
    await AssessmentEvidenceCaptureSession.updateOne({ _id: row._id, status: "active" }, { $set: { status: "expired" } });
    throw new AssessmentEvidenceError("Capture session has expired", 403);
  }
  return row;
}
function initialReconciliation(input: { packet: IAssessmentPaperPacket | null; expectedPageNumber: number | null; captureOrder: number | null; assignmentId: Types.ObjectId | null; assignmentCorrectionPending: boolean; packetDeliveryMatches: boolean }) {
  if (!input.packet) return input.packetDeliveryMatches ? "unknown_packet" : "wrong_delivery";
  if (!input.packetDeliveryMatches) return "wrong_delivery";
  if (input.packet.status === "voided") return "voided_packet";
  if (input.expectedPageNumber === null) return "unknown_page";
  if (input.captureOrder !== null && input.captureOrder !== input.expectedPageNumber) return "out_of_order";
  if (input.assignmentCorrectionPending) return "assignment_correction_pending";
  if (!input.assignmentId) return "unassigned_packet";
  return "valid";
}
async function expectedPacket(input: { actor: AssessmentEvidenceActor; deliveryId: Types.ObjectId; packetId: string; pageId: string; session?: ClientSession }) {
  const packetQuery = AssessmentPaperPacket.findOne({ schoolId: input.actor.schoolId, packetId: input.packetId });
  const packet = await (input.session ? packetQuery.session(input.session) : packetQuery).lean<IAssessmentPaperPacket | null>();
  if (!packet) return { packet: null, page: null, assignment: null, correctionPending: false, packetDeliveryMatches: false };
  const packetDeliveryMatches = same(packet.assessmentDeliveryVersionId, input.deliveryId);
  const page = packetDeliveryMatches ? packet.pageManifest.find((candidate) => candidate.pageId === input.pageId) ?? null : null;
  const assignment = packetDeliveryMatches ? await AssessmentPaperPacketAssignment.findOne({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: input.deliveryId, assessmentPaperPacketId: packet._id, status: "active" }).session(input.session ?? null).lean() : null;
  const correctionPending = Boolean(assignment && await AssessmentPaperPacketCorrection.exists({ schoolId: input.actor.schoolId, assignmentId: assignment._id, status: "pending" }));
  return { packet, page, assignment, correctionPending, packetDeliveryMatches };
}

export async function createEvidenceCaptureSession(input: { actor: AssessmentEvidenceActor; assessmentDeliveryVersionId: Types.ObjectId; deviceSessionId: string; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertActor(input.actor);
  const deliveryId = oid(input.assessmentDeliveryVersionId, "Assessment delivery id");
  const deviceSessionId = input.deviceSessionId.trim();
  if (deviceSessionId.length < 8 || deviceSessionId.length > 160) throw new AssessmentEvidenceError("A valid device session id is required", 400);
  const key = assertKey(input.idempotencyKey, "capture session idempotency key");
  const result = await transaction(async (session) => {
    const existing = await AssessmentEvidenceCaptureSession.findOne({ schoolId: input.actor.schoolId, idempotencyKey: key }).session(session).lean<IAssessmentEvidenceCaptureSession | null>();
    if (existing) {
      if (!same(existing.operatorUserId, input.actor.userId) || !same(existing.assessmentDeliveryVersionId, deliveryId) || existing.deviceSessionId !== deviceSessionId) throw new AssessmentEvidenceError("Capture session idempotency key is already bound to another session", 409);
      return { session: serializeSession(existing), replayed: true };
    }
    await deliveryForActor(input.actor.schoolId, deliveryId, session);
    const now = new Date();
    const row = new AssessmentEvidenceCaptureSession({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: deliveryId, operatorUserId: input.actor.userId, deviceSessionId, idempotencyKey: key, status: "active", expiresAt: new Date(now.getTime() + SESSION_TTL_MS), revokedAt: null, revokedBy: null, revokeReason: null, closedAt: null, lastSeenAt: now });
    await row.save({ session });
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.evidence.session_created", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentEvidenceCaptureSession", targetEntityId: row._id }, context: context(input.actor, { idempotencyKey: key, context: input.auditContext }, `created:${row._id}`), payload: { metadata: { assessmentDeliveryVersionId: String(deliveryId), deviceSessionId } }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { session: serializeSession(row.toObject() as IAssessmentEvidenceCaptureSession), replayed: false };
  });
  return result;
}

export async function revokeEvidenceCaptureSession(input: { actor: AssessmentEvidenceActor; sessionId: Types.ObjectId; reason: string; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertActor(input.actor);
  const sessionId = oid(input.sessionId, "Capture session id");
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 1000) throw new AssessmentEvidenceError("A revocation reason is required", 400);
  const key = assertKey(input.idempotencyKey, "revocation idempotency key");
  return transaction(async (session) => {
    const row = await AssessmentEvidenceCaptureSession.findOne({ _id: sessionId, schoolId: input.actor.schoolId, operatorUserId: input.actor.userId }).session(session);
    if (!row) throw new AssessmentEvidenceError("Capture session not found", 404);
    if (row.status === "revoked") return { session: serializeSession(row.toObject() as IAssessmentEvidenceCaptureSession), replayed: true };
    if (row.status !== "active") throw new AssessmentEvidenceError("Only active capture sessions can be revoked", 409);
    const before = { status: row.status, expiresAt: row.expiresAt };
    row.status = "revoked"; row.revokedAt = new Date(); row.revokedBy = input.actor.userId; row.revokeReason = reason;
    await row.save({ session });
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.evidence.session_revoked", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentEvidenceCaptureSession", targetEntityId: row._id }, context: context(input.actor, { idempotencyKey: key, context: input.auditContext }, `revoked:${row._id}`), reason: { reasonCode: "capture_session_revoked", reason }, payload: { before, after: { status: row.status, revokedAt: row.revokedAt }, changedFields: ["status", "revokedAt", "revokedBy", "revokeReason"] }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { session: serializeSession(row.toObject() as IAssessmentEvidenceCaptureSession), replayed: false };
  });
}

export async function reserveEvidencePage(input: { actor: AssessmentEvidenceActor; sessionId: Types.ObjectId; packetId: string; pageId: string; fileName: string; mimeType: string; clientUploadId: string; expectedDigest?: string | null; captureOrder?: number | null; auditContext?: AuditRequestContext }) {
  assertActor(input.actor);
  const sessionId = oid(input.sessionId, "Capture session id");
  const key = assertKey(input.clientUploadId, "client upload id");
  const packetId = input.packetId.trim(); const pageId = input.pageId.trim();
  const mimeType = normalizeMimeType(input.mimeType);
  if (!packetId || packetId.length > 160 || !pageId || pageId.length > 160) throw new AssessmentEvidenceError("Packet and page identifiers are required", 400);
  if (!IMAGE_MIME_TYPES.has(mimeType)) throw new AssessmentEvidenceError("Only JPEG, PNG and WebP evidence pages are supported", 400);
  const expectedDigest = input.expectedDigest?.trim().toLowerCase() || null;
  if (expectedDigest && !/^[a-f0-9]{64}$/.test(expectedDigest)) throw new AssessmentEvidenceError("Expected digest must be a SHA-256 hexadecimal value", 400);
  const result = await transaction(async (session) => {
    const capture = await liveSession({ actor: input.actor, sessionId, session });
    const existing = await AssessmentEvidencePage.findOne({ schoolId: input.actor.schoolId, captureSessionId: capture._id, clientUploadId: key }).session(session).lean<IAssessmentEvidencePage | null>();
    if (existing) {
      if (existing.observedPacketId !== packetId || existing.pageId !== pageId) throw new AssessmentEvidenceError("Client upload id is already bound to another page", 409);
      return { existing, replayed: true };
    }
    const count = await AssessmentEvidencePage.countDocuments({ schoolId: input.actor.schoolId, captureSessionId: capture._id }).session(session);
    if (count >= MAX_SESSION_PAGES) throw new AssessmentEvidenceError("Capture session page limit reached", 413);
    const expected = await expectedPacket({ actor: input.actor, deliveryId: capture.assessmentDeliveryVersionId, packetId, pageId, session });
    const outcome = initialReconciliation({ packet: expected.packet, expectedPageNumber: expected.page?.pageNumber ?? null, captureOrder: input.captureOrder ?? null, assignmentId: expected.assignment?._id ?? null, assignmentCorrectionPending: expected.correctionPending, packetDeliveryMatches: expected.packetDeliveryMatches });
    const row = new AssessmentEvidencePage({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: capture.assessmentDeliveryVersionId, captureSessionId: capture._id, packetId: expected.packet?._id ?? null, observedPacketId: packetId, pageId, expectedPageNumber: expected.page?.pageNumber ?? null, expectedPageCount: expected.page?.expectedPageCount ?? null, captureOrder: input.captureOrder ?? null, assignmentId: expected.assignment?._id ?? null, assetId: null, clientUploadId: key, expectedDigest, verifiedDigest: null, digestAlgorithm: "sha256", integrityStatus: "unverified", status: "reserved", reconciliationOutcome: outcome, retentionPolicyRef: "assess-paper-evidence-default", retentionUntil: null, legalHold: { active: false, reference: null, reason: null, placedBy: null, placedAt: null }, deletionStatus: "not_requested", uploadedAt: null, verifiedAt: null, deletedAt: null, accepted: false });
    await row.save({ session });
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.evidence.page_reserved", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentEvidencePage", targetEntityId: row._id }, context: context(input.actor, { idempotencyKey: key, context: input.auditContext }, `reserved:${row._id}`), payload: { metadata: { assessmentDeliveryVersionId: String(capture.assessmentDeliveryVersionId), captureSessionId: String(capture._id), packetId, pageId, reconciliationOutcome: outcome } }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { row, capture };
  }).catch((error) => { if (duplicate(error)) throw new AssessmentEvidenceError("Evidence reservation conflicted with another upload", 409); throw error; });
  if ("replayed" in result && result.existing) {
    const existingAsset = result.existing.assetId ? await StoredAsset.findById(result.existing.assetId).lean() : null;
    let upload: { assetId: string; uploadUrl: string; headers: Record<string, string>; expiresInSeconds: number; assetUrl: string } | null = null;
    if (existingAsset?.status === "pending") {
      const signed = await getR2Port().createPresignedPut({ key: existingAsset.storageKey, contentType: existingAsset.mimeType, expiresInSeconds: signedTtlSeconds() });
      upload = { assetId: String(existingAsset._id), uploadUrl: signed.url, headers: signed.headers, expiresInSeconds: signed.expiresInSeconds, assetUrl: getStoredAssetUrl(String(existingAsset._id)) };
    }
    return { page: serializePage(result.existing), upload, replayed: true };
  }
  const definition = getStorageKindDefinition(EVIDENCE_KIND);
  const built = buildStorageKey({ schoolId: String(input.actor.schoolId), kind: EVIDENCE_KIND, mimeType, association: { type: EVIDENCE_ASSOCIATION, id: String(result.row._id) } });
  const asset = await StoredAsset.create({ schoolId: input.actor.schoolId, ownerUserId: input.actor.userId, uploadedByUserId: input.actor.userId, provider: "r2", storageKey: built.storageKey, fileName: sanitizeDisplayFileName(input.fileName), extension: built.extension, mimeType, sizeBytes: 0, kind: EVIDENCE_KIND, visibility: definition.defaultVisibility, status: "pending", association: { type: EVIDENCE_ASSOCIATION, id: result.row._id } });
  let signed: PresignedPutResult;
  try { signed = await getR2Port().createPresignedPut({ key: built.storageKey, contentType: mimeType, expiresInSeconds: signedTtlSeconds() }); }
  catch (error) { await StoredAsset.updateOne({ _id: asset._id, status: "pending" }, { $set: { status: "failed", failedAt: new Date(), failureCode: "presign_failed" } }); await AssessmentEvidencePage.updateOne({ _id: result.row._id, status: "reserved" }, { $set: { status: "rejected", reconciliationOutcome: "rejected" } }); throw error; }
  await AssessmentEvidencePage.updateOne({ _id: result.row._id, status: "reserved", assetId: null }, { $set: { assetId: asset._id } });
  return { page: serializePage({ ...(result.row.toObject() as IAssessmentEvidencePage), assetId: asset._id }), upload: { assetId: String(asset._id), uploadUrl: signed.url, headers: signed.headers, expiresInSeconds: signed.expiresInSeconds, assetUrl: getStoredAssetUrl(String(asset._id)) }, replayed: false };
}

async function streamToBuffer(body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | null, maxBytes: number) {
  if (!body) return Buffer.alloc(0);
  const chunks: Buffer[] = []; let size = 0;
  if (Symbol.asyncIterator in (body as object)) {
    for await (const chunk of body as AsyncIterable<Uint8Array>) { size += chunk.byteLength; if (size > maxBytes) throw new AssessmentEvidenceError("Evidence page exceeds the maximum size", 413); chunks.push(Buffer.from(chunk)); }
  } else {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    while (true) { const { done, value } = await reader.read(); if (done) break; if (value) { size += value.byteLength; if (size > maxBytes) throw new AssessmentEvidenceError("Evidence page exceeds the maximum size", 413); chunks.push(Buffer.from(value)); } }
  }
  return Buffer.concat(chunks);
}
async function markEvidenceFailure(pageId: Types.ObjectId, assetId: Types.ObjectId, code: AssessmentEvidenceReconciliationOutcome, r2: R2Port) {
  await AssessmentEvidencePage.updateOne({ _id: pageId, status: "reserved" }, { $set: { status: "rejected", integrityStatus: "rejected", reconciliationOutcome: code } });
  await StoredAsset.updateOne({ _id: assetId, status: "pending" }, { $set: { status: "failed", failedAt: new Date(), failureCode: code } });
  try { const asset = await StoredAsset.findById(assetId).lean(); if (asset) await r2.deleteObject(asset.storageKey); } catch { /* cleanup is retried by storage operations; no receipt is issued */ }
}

export async function completeEvidencePage(input: { actor: AssessmentEvidenceActor; pageId: Types.ObjectId; clientDigest?: string | null; auditContext?: AuditRequestContext }) {
  assertActor(input.actor);
  const pageId = oid(input.pageId, "Evidence page id");
  const page = await AssessmentEvidencePage.findOne({ _id: pageId, schoolId: input.actor.schoolId }).lean<IAssessmentEvidencePage | null>();
  if (!page) throw new AssessmentEvidenceError("Evidence page not found", 404);
  const capture = await liveSession({ actor: input.actor, sessionId: page.captureSessionId });
  if (!page.assetId) throw new AssessmentEvidenceError("Evidence upload reservation is incomplete", 409);
  const asset = await StoredAsset.findOne({ _id: page.assetId, schoolId: input.actor.schoolId, kind: EVIDENCE_KIND, visibility: "private", association: { type: EVIDENCE_ASSOCIATION, id: page._id }, status: { $in: ["pending", "ready"] } });
  if (!asset) throw new AssessmentEvidenceError("Evidence asset is not available for this page", 403);
  const r2 = getR2Port();
  if (page.status !== "reserved") {
    const receipt = await AssessmentEvidenceReceipt.findOne({ schoolId: input.actor.schoolId, evidencePageId: page._id }).lean<IAssessmentEvidenceReceipt | null>();
    if (receipt) return { page: serializePage(page, receipt), receipt: { id: String(receipt._id), receiptKey: receipt.receiptKey, digest: receipt.digest, sizeBytes: receipt.sizeBytes, status: receipt.status }, replayed: true };
    if (page.status === "rejected") throw new AssessmentEvidenceError("Evidence page was rejected", 409);
  }
  const head = await r2.headObject(asset.storageKey);
  if (!head.exists) { await markEvidenceFailure(page._id, asset._id, "missing_object", r2); throw new AssessmentEvidenceError("Uploaded evidence object was not found", 409); }
  const actualMime = normalizeMimeType(head.contentType || "");
  if (actualMime !== asset.mimeType || !IMAGE_MIME_TYPES.has(actualMime)) { await markEvidenceFailure(page._id, asset._id, "invalid_mime", r2); throw new AssessmentEvidenceError("Uploaded evidence MIME type is invalid", 400); }
  const maxBytes = maxBytesForKindMime(EVIDENCE_KIND, actualMime);
  const object = await r2.getObjectStream(asset.storageKey);
  let bytes: Buffer;
  try { bytes = await streamToBuffer(object.body, maxBytes); } catch (error) { await markEvidenceFailure(page._id, asset._id, "invalid_size", r2); throw error; }
  if (!bytes.length || bytes.length > maxBytes || (head.contentLength != null && head.contentLength !== bytes.length)) { await markEvidenceFailure(page._id, asset._id, "invalid_size", r2); throw new AssessmentEvidenceError("Uploaded evidence size is invalid", 400); }
  const digest = createHash("sha256").update(bytes).digest("hex");
  const clientDigest = input.clientDigest?.trim().toLowerCase() || null;
  if ((clientDigest && !/^[a-f0-9]{64}$/.test(clientDigest)) || (clientDigest && clientDigest !== digest) || (page.expectedDigest && page.expectedDigest !== digest)) {
    await StoredAsset.updateOne({ _id: asset._id, status: "pending" }, { $set: { status: "ready", sizeBytes: bytes.length, etag: head.etag ?? null, completedAt: new Date() } });
    await AssessmentEvidencePage.updateOne({ _id: page._id, status: "reserved" }, { $set: { status: "rejected", integrityStatus: "rejected", verifiedDigest: digest, reconciliationOutcome: "invalid_digest", uploadedAt: new Date() } });
    throw new AssessmentEvidenceError("Server-verified evidence digest does not match the supplied digest", 409);
  }
  // The reservation key remains writable until its presigned PUT expires. Move the
  // verified bytes to a server-owned, digest-addressed key before issuing a receipt
  // so a late/replayed client upload cannot replace the object named by that receipt.
  const immutableKey = buildStorageKey({
    schoolId: String(input.actor.schoolId),
    kind: EVIDENCE_KIND,
    mimeType: actualMime,
    association: { type: EVIDENCE_ASSOCIATION, id: String(page._id) },
    assetUuid: `${String(asset._id)}-${digest}`,
  }).storageKey;
  try {
    const immutableWrite = await r2.putObject({ key: immutableKey, body: bytes, contentType: actualMime });
    const immutableHead = await r2.headObject(immutableKey);
    if (!immutableHead.exists || immutableHead.contentLength !== bytes.length || normalizeMimeType(immutableHead.contentType || "") !== actualMime) {
      throw new Error("Immutable evidence object verification failed");
    }
    const immutableObject = await r2.getObjectStream(immutableKey);
    const immutableBytes = await streamToBuffer(immutableObject.body, maxBytes);
    const immutableDigest = createHash("sha256").update(immutableBytes).digest("hex");
    if (immutableDigest !== digest || immutableBytes.length !== bytes.length) {
      throw new Error("Immutable evidence digest verification failed");
    }
    await StoredAsset.updateOne({ _id: asset._id, status: "pending" }, { $set: { storageKey: immutableKey, status: "ready", sizeBytes: bytes.length, etag: immutableWrite.etag ?? immutableHead.etag ?? null, completedAt: new Date(), failedAt: null, failureCode: null } });
    try { if (asset.storageKey !== immutableKey) await r2.deleteObject(asset.storageKey); } catch { /* stale reservation cleanup is best effort; receipt uses immutableKey */ }
  } catch {
    await AssessmentEvidencePage.updateOne({ _id: page._id, status: "reserved" }, { $set: { status: "rejected", integrityStatus: "rejected", reconciliationOutcome: "rejected", uploadedAt: new Date(), verifiedDigest: digest } });
    await StoredAsset.updateOne({ _id: asset._id, status: "pending" }, { $set: { status: "failed", failedAt: new Date(), failureCode: "immutable_integrity_failure" } });
    try { await r2.deleteObject(immutableKey); } catch { /* cleanup is retried by storage operations; no receipt is issued */ }
    try { if (asset.storageKey !== immutableKey) await r2.deleteObject(asset.storageKey); } catch { /* cleanup is retried by storage operations; no receipt is issued */ }
    throw new AssessmentEvidenceError("Verified evidence could not be placed in immutable storage", 502);
  }
  try {
    const result = await transaction(async (session) => {
      const current = await AssessmentEvidencePage.findOne({ _id: page._id, schoolId: input.actor.schoolId }).session(session);
      if (!current) throw new AssessmentEvidenceError("Evidence page not found", 404);
      const existingReceipt = await AssessmentEvidenceReceipt.findOne({ schoolId: input.actor.schoolId, evidencePageId: current._id }).session(session).lean<IAssessmentEvidenceReceipt | null>();
      if (existingReceipt) return { current: current.toObject() as IAssessmentEvidencePage, receipt: existingReceipt, replayed: true };
      const accepted = current.reconciliationOutcome === "valid";
      const existingAccepted = accepted ? await AssessmentEvidencePage.findOne({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: current.assessmentDeliveryVersionId, packetId: current.packetId, pageId: current.pageId, accepted: true }).session(session).lean<IAssessmentEvidencePage | null>() : null;
      let outcome: AssessmentEvidenceReconciliationOutcome = current.reconciliationOutcome;
      let isAccepted = accepted;
      if (existingAccepted) { outcome = existingAccepted.verifiedDigest === digest ? "duplicate" : "conflict"; isAccepted = false; }
      const status = isAccepted ? "verified" : "pending_reconciliation";
      current.status = status; current.integrityStatus = "verified"; current.verifiedDigest = digest; current.uploadedAt = current.uploadedAt ?? new Date(); current.verifiedAt = new Date(); current.reconciliationOutcome = outcome; current.accepted = isAccepted;
      await current.save({ session });
      const receipt = new AssessmentEvidenceReceipt({ schoolId: input.actor.schoolId, evidencePageId: current._id, receiptKey: `evidence:${String(current._id)}:${digest}`, status: "confirmed", digest, sizeBytes: bytes.length, issuedToUserId: input.actor.userId, issuedAt: new Date() });
      await receipt.save({ session });
      await writeTransactionalAuditEvent(session, { actionCode: "assessment.evidence.page_verified", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentEvidencePage", targetEntityId: current._id, secondaryEntityType: "AssessmentEvidenceReceipt", secondaryEntityId: receipt._id }, context: context(input.actor, { idempotencyKey: `complete:${String(current._id)}`, context: input.auditContext }, `verified:${current._id}`), payload: { metadata: { packetId: current.observedPacketId, pageId: current.pageId, digest, sizeBytes: bytes.length, integrityStatus: current.integrityStatus, reconciliationOutcome: outcome, accepted: isAccepted } }, streamKey: `school:${String(input.actor.schoolId)}` });
      return { current: current.toObject() as IAssessmentEvidencePage, receipt: receipt.toObject() as IAssessmentEvidenceReceipt, replayed: false };
    });
    return { page: serializePage(result.current, result.receipt), receipt: { id: String(result.receipt._id), receiptKey: result.receipt.receiptKey, digest: result.receipt.digest, sizeBytes: result.receipt.sizeBytes, status: result.receipt.status }, replayed: result.replayed };
  } catch (error) {
    if (!duplicate(error)) throw error;
    const current = await AssessmentEvidencePage.findById(page._id).lean<IAssessmentEvidencePage>();
    const receipt = await AssessmentEvidenceReceipt.findOne({ schoolId: input.actor.schoolId, evidencePageId: page._id }).lean<IAssessmentEvidenceReceipt | null>();
    if (current && receipt) return { page: serializePage(current, receipt), receipt: { id: String(receipt._id), receiptKey: receipt.receiptKey, digest: receipt.digest, sizeBytes: receipt.sizeBytes, status: receipt.status }, replayed: true };
    throw new AssessmentEvidenceError("Evidence completion conflicted and requires reconciliation", 409);
  } finally { await AssessmentEvidenceCaptureSession.updateOne({ _id: capture._id, status: "active" }, { $set: { lastSeenAt: new Date() } }); }
}

export async function listEvidenceReconciliation(input: { actor: AssessmentEvidenceActor; assessmentDeliveryVersionId?: Types.ObjectId | null; sessionId?: Types.ObjectId | null }) {
  assertActor(input.actor);
  const filter: Record<string, unknown> = { schoolId: input.actor.schoolId };
  if (input.assessmentDeliveryVersionId) filter.assessmentDeliveryVersionId = oid(input.assessmentDeliveryVersionId, "Assessment delivery id");
  if (input.sessionId) filter.captureSessionId = oid(input.sessionId, "Capture session id");
  const pages = await AssessmentEvidencePage.find(filter).sort({ createdAt: -1 }).limit(1000).lean<IAssessmentEvidencePage[]>();
  const deliveryIds = [...new Set(pages.map((row) => String(row.assessmentDeliveryVersionId)))].map((value) => new Types.ObjectId(value));
  const packets = deliveryIds.length ? await AssessmentPaperPacket.find({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: { $in: deliveryIds } }).lean<IAssessmentPaperPacket[]>() : [];
  const expected = packets.reduce((sum, packet) => sum + packet.pageManifest.length, 0);
  const accepted = pages.filter((row) => row.accepted).length;
  const received = pages.filter((row) => ["verified", "pending_reconciliation"].includes(row.status)).length;
  const missing = packets.flatMap((packet) => packet.pageManifest.filter((page) => !pages.some((row) => row.accepted && same(row.packetId, packet._id) && row.pageId === page.pageId)).map((page) => ({ packetId: packet.packetId, pageId: page.pageId, pageNumber: page.pageNumber })));
  const receipts = await AssessmentEvidenceReceipt.find({ schoolId: input.actor.schoolId, evidencePageId: { $in: pages.map((row) => row._id) } }).lean<IAssessmentEvidenceReceipt[]>();
  const receiptByPage = new Map(receipts.map((receipt) => [String(receipt.evidencePageId), receipt]));
  return { summary: { expectedPages: expected, receivedPages: received, acceptedPages: accepted, missingPages: missing.length, warnings: pages.filter((row) => row.reconciliationOutcome !== "valid").length }, missing, pages: pages.map((row) => serializePage(row, receiptByPage.get(String(row._id)) ?? null)) };
}

export async function getEvidencePreview(input: { actor: AssessmentEvidenceActor; evidencePageId: Types.ObjectId; r2?: R2Port }) {
  assertActor(input.actor);
  const pageId = oid(input.evidencePageId, "Evidence page id");
  const page = await AssessmentEvidencePage.findOne({ _id: pageId, schoolId: input.actor.schoolId }).lean<IAssessmentEvidencePage | null>();
  if (!page || !page.assetId) throw new StorageNotFoundError();
  const asset = await StoredAsset.findOne({ _id: page.assetId, schoolId: input.actor.schoolId, kind: EVIDENCE_KIND, visibility: "private" }).lean();
  if (!asset || asset.status !== "ready") throw new StorageNotFoundError();
  const signed = await (input.r2 ?? getR2Port()).createPresignedGet({ key: asset.storageKey, expiresInSeconds: signedTtlSeconds(), contentDisposition: contentDispositionValue(asset.fileName, "inline"), contentType: asset.mimeType });
  return { evidence: serializePage(page), redirectUrl: signed.url, expiresInSeconds: signed.expiresInSeconds };
}

export async function placeEvidenceLegalHold(input: { actor: AssessmentEvidenceActor; evidencePageId: Types.ObjectId; reference: string; reason: string; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertActor(input.actor); const pageId = oid(input.evidencePageId, "Evidence page id"); const reference = input.reference.trim(); const reason = input.reason.trim(); const key = assertKey(input.idempotencyKey, "legal-hold idempotency key");
  if (!reference || reference.length > 180 || reason.length < 3 || reason.length > 1000) throw new AssessmentEvidenceError("A legal-hold reference and reason are required", 400);
  return transaction(async (session) => {
    const page = await AssessmentEvidencePage.findOne({ _id: pageId, schoolId: input.actor.schoolId }).session(session);
    if (!page) throw new AssessmentEvidenceError("Evidence page not found", 404);
    if (page.legalHold.active) return { evidence: serializePage(page.toObject() as IAssessmentEvidencePage), replayed: true };
    const before = { active: page.legalHold.active, reference: page.legalHold.reference };
    page.legalHold = { active: true, reference, reason, placedBy: input.actor.userId, placedAt: new Date() };
    await page.save({ session });
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.evidence.legal_hold_placed", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentEvidencePage", targetEntityId: page._id }, context: context(input.actor, { idempotencyKey: key, context: input.auditContext }, `hold:${page._id}`), reason: { reasonCode: "legal_hold", reason }, payload: { before, after: { active: true, reference }, changedFields: ["legalHold"] }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { evidence: serializePage(page.toObject() as IAssessmentEvidencePage), replayed: false };
  });
}

export async function requestEvidenceDeletion(input: { actor: AssessmentEvidenceActor; evidencePageId: Types.ObjectId; reason: string; requestKey: string; auditContext?: AuditRequestContext }) {
  assertActor(input.actor); const pageId = oid(input.evidencePageId, "Evidence page id"); const reason = input.reason.trim(); const requestKey = assertKey(input.requestKey, "deletion request key");
  if (reason.length < 3 || reason.length > 2000) throw new AssessmentEvidenceError("A deletion reason is required", 400);
  return transaction(async (session) => {
    const page = await AssessmentEvidencePage.findOne({ _id: pageId, schoolId: input.actor.schoolId }).session(session);
    if (!page) throw new AssessmentEvidenceError("Evidence page not found", 404);
    const existing = await AssessmentEvidenceDeletionRequest.findOne({ schoolId: input.actor.schoolId, requestKey }).session(session).lean();
    if (existing) return { request: existing, replayed: true };
    const held = page.legalHold.active;
    const request = new AssessmentEvidenceDeletionRequest({ schoolId: input.actor.schoolId, evidencePageId: page._id, requestedBy: input.actor.userId, requestKey, reason, status: held ? "denied" : "requested", denialReason: held ? "Evidence is subject to an active legal hold" : null });
    await request.save({ session });
    if (!held) { page.deletionStatus = "requested"; await page.save({ session }); }
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.evidence.deletion_requested", scopeType: "school", scopeId: String(input.actor.schoolId), result: held ? "failed" : "succeeded", target: { targetEntityType: "AssessmentEvidenceDeletionRequest", targetEntityId: request._id, secondaryEntityType: "AssessmentEvidencePage", secondaryEntityId: page._id }, context: context(input.actor, { idempotencyKey: requestKey, context: input.auditContext }, `deletion:${request._id}`), reason: { reasonCode: held ? "legal_hold" : "retention_review", reason: held ? "Evidence is subject to an active legal hold" : reason }, payload: { before: { deletionStatus: page.deletionStatus, legalHold: held }, after: { requestStatus: request.status, deletionStatus: page.deletionStatus }, changedFields: ["deletionStatus", "requestStatus"] }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { request: request.toObject(), replayed: false };
  });
}
