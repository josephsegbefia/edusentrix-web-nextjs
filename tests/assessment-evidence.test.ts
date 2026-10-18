import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { School } from "../src/models/School";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "../src/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment } from "../src/models/AssessmentPaperPacketAssignment";
import { AssessmentPaperPacketCorrection } from "../src/models/AssessmentPaperPacketCorrection";
import { AssessmentEvidenceCaptureSession } from "../src/models/AssessmentEvidenceCaptureSession";
import { AssessmentEvidencePage } from "../src/models/AssessmentEvidencePage";
import { AssessmentEvidenceReceipt } from "../src/models/AssessmentEvidenceReceipt";
import { AssessmentEvidenceDeletionRequest } from "../src/models/AssessmentEvidenceDeletionRequest";
import { StoredAsset } from "../src/models/StoredAsset";
import { AuditEvent } from "../src/models/AuditEvent";
import { AuditStreamHead } from "../src/models/AuditStreamHead";
import { setR2PortForTests } from "../src/lib/storage/r2";
import { createMockR2Port } from "./storage/helpers/mock-r2";
import {
  AssessmentEvidenceError,
  completeEvidencePage,
  createEvidenceCaptureSession,
  getEvidencePreview,
  listEvidenceReconciliation,
  placeEvidenceLegalHold,
  requestEvidenceDeletion,
  reserveEvidencePage,
  revokeEvidenceCaptureSession,
} from "../src/lib/assess/assessment-evidence-service";

const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN_A = new Types.ObjectId();
const ADMIN_B = new Types.ObjectId();
const DELIVERY = new Types.ObjectId();
const PACKET = new Types.ObjectId();
const PERIOD = new Types.ObjectId();
const r2 = createMockR2Port();
let replSet: MongoMemoryReplSet;

const actor = (schoolId = SCHOOL_A, userId = ADMIN_A, entitled = true, isAdmin = true) => ({ userId, schoolId, isAdmin, premiumPublicationEntitled: entitled });
const digest = (body: Buffer) => createHash("sha256").update(body).digest("hex");
const auditContext = (key: string) => ({ requestId: key, correlationId: key, actorType: "user" as const, actorId: ADMIN_A, actorRole: "school_admin", schoolId: SCHOOL_A, idempotencyKey: key, clientSurface: "test" });

async function fixture() {
  await School.create([
    { _id: SCHOOL_A, name: "Evidence School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" },
    { _id: SCHOOL_B, name: "Other Evidence School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" },
  ]);
  await AcademicPeriod.create({ _id: PERIOD, schoolId: SCHOOL_A, yearLabel: "2026/27", term: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-20"), isCurrent: true });
  await AssessmentDeliveryVersion.create({ _id: DELIVERY, schoolId: SCHOOL_A, deliveryKey: "evidence-delivery", assessmentDefinitionVersionId: new Types.ObjectId(), definitionContentHash: "a".repeat(64), version: 1, title: "Evidence delivery", mode: "paper", academicYearId: PERIOD, academicPeriodId: PERIOD, gradeId: new Types.ObjectId(), classGroupIds: [], subjectId: new Types.ObjectId(), subjectOfferingId: null, schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId: PERIOD, scheduledDate: new Date("2026-11-01"), startTime: null, endTime: null, venueId: null, roomLabel: null, classGroupIds: [] }, timing: { durationMinutes: 60, lateEntryMinutes: 0, serverAuthoritative: true }, resultBinding: "none", assessmentPlanId: null, assessmentItemId: null, reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" }, accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null }, contentHash: "b".repeat(64), contentHashAlgorithm: "sha256", status: "published", attribution: { createdBy: ADMIN_A, reviewedBy: ADMIN_A, publishedBy: ADMIN_A, supersededBy: null }, publishedAt: new Date() });
  await AssessmentPaperPacket.create({ _id: PACKET, schoolId: SCHOOL_A, assessmentDefinitionVersionId: new Types.ObjectId(), assessmentDeliveryVersionId: DELIVERY, deliveryContentHash: "b".repeat(64), packetId: "ES-PKT-EVIDENCE-001", fallbackCode: "ES-EVIDENCE-001", batchId: "ES-BATCH-EVIDENCE", batchSequence: 1, batchQuantity: 1, generationIdempotencyKey: "evidence-packet-001", isBatchLeader: true, batchFingerprint: "c".repeat(64), status: "issued", pageManifest: [{ pageId: "page-1", pageNumber: 1, expectedPageCount: 2, fallbackCode: "ES-EVIDENCE-001-P01", qrPayload: "{\"route\":\"only\"}" }, { pageId: "page-2", pageNumber: 2, expectedPageCount: 2, fallbackCode: "ES-EVIDENCE-001-P02", qrPayload: "{\"route\":\"only\"}" }], createdBy: ADMIN_A, issuedBy: ADMIN_A, issuedAt: new Date() });
  await AssessmentPaperPacketAssignment.create({ schoolId: SCHOOL_A, assessmentDeliveryVersionId: DELIVERY, assessmentPaperPacketId: PACKET, studentId: new Types.ObjectId(), academicPeriodId: PERIOD, gradeId: new Types.ObjectId(), classGroupId: new Types.ObjectId(), status: "active", assignmentIdempotencyKey: "evidence-assignment-001", assignedBy: ADMIN_A, assignedAt: new Date(), replacedByCorrectionId: null, replacedAt: null });
}

async function reserve(clientUploadId: string, pageId = "page-1", sessionId?: Types.ObjectId, expectedDigest?: string) {
  const session = sessionId ?? (await createEvidenceCaptureSession({ actor: actor(), assessmentDeliveryVersionId: DELIVERY, deviceSessionId: `device-${clientUploadId}`, idempotencyKey: `session-${clientUploadId}`, auditContext: auditContext(`session-${clientUploadId}`) })).session.id;
  const result = await reserveEvidencePage({ actor: actor(), sessionId: new Types.ObjectId(String(session)), packetId: "ES-PKT-EVIDENCE-001", pageId, fileName: `${clientUploadId}.jpg`, mimeType: "image/jpeg", clientUploadId, expectedDigest, auditContext: auditContext(clientUploadId) });
  return { sessionId: new Types.ObjectId(String(session)), result };
}

async function upload(result: { upload: { assetId: string } | null }, body: Buffer, contentType = "image/jpeg") {
  const assetId = result.upload?.assetId;
  ensure(assetId);
  const asset = await StoredAsset.findById(assetId).lean();
  ensure(asset);
  await r2.putObject({ key: asset.storageKey, body, contentType });
  return new Types.ObjectId(assetId);
}
function ensure<T>(value: T): asserts value { assert.ok(value); }

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { dbName: "assessment_evidence" });
  setR2PortForTests(r2);
  await Promise.all([School.createIndexes(), AcademicPeriod.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AssessmentPaperPacketAssignment.createIndexes(), AssessmentPaperPacketCorrection.createIndexes(), AssessmentEvidenceCaptureSession.createIndexes(), AssessmentEvidencePage.createIndexes(), AssessmentEvidenceReceipt.createIndexes(), AssessmentEvidenceDeletionRequest.createIndexes(), StoredAsset.createIndexes(), AuditEvent.createIndexes(), AuditStreamHead.createIndexes()]);
});
beforeEach(async () => {
  r2.objects.clear(); r2.deletedKeys.length = 0;
  await Promise.all([AuditEvent.deleteMany({}), AuditStreamHead.deleteMany({}), AssessmentEvidenceDeletionRequest.deleteMany({}), AssessmentEvidenceReceipt.deleteMany({}), AssessmentEvidencePage.deleteMany({}), AssessmentEvidenceCaptureSession.deleteMany({}), StoredAsset.deleteMany({}), AssessmentPaperPacketAssignment.deleteMany({}), AssessmentPaperPacket.deleteMany({}), AssessmentDeliveryVersion.deleteMany({}), AcademicPeriod.deleteMany({}), School.deleteMany({})]);
  await fixture();
});
after(async () => { setR2PortForTests(null); await mongoose.disconnect(); await replSet.stop(); });

test("binds sessions to the operator, verifies bytes, issues a durable receipt, and reconciles missing pages", async () => {
  const session = await createEvidenceCaptureSession({ actor: actor(), assessmentDeliveryVersionId: DELIVERY, deviceSessionId: "device-valid-001", idempotencyKey: "session-valid-001", auditContext: auditContext("session-valid-001") });
  const reserved = await reserveEvidencePage({ actor: actor(), sessionId: new Types.ObjectId(session.session.id), packetId: "ES-PKT-EVIDENCE-001", pageId: "page-1", fileName: "page.jpg", mimeType: "image/jpeg", clientUploadId: "upload-valid-001", auditContext: auditContext("upload-valid-001") });
  const reservationReplay = await reserveEvidencePage({ actor: actor(), sessionId: new Types.ObjectId(session.session.id), packetId: "ES-PKT-EVIDENCE-001", pageId: "page-1", fileName: "page.jpg", mimeType: "image/jpeg", clientUploadId: "upload-valid-001" });
  assert.equal(reservationReplay.replayed, true); assert.equal(reservationReplay.upload?.assetId, reserved.upload?.assetId);
  const body = Buffer.from("synthetic-jpeg-page");
  await upload(reserved, body);
  const completed = await completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(reserved.page.id), clientDigest: digest(body), auditContext: auditContext("complete-valid-001") });
  assert.equal(completed.receipt.status, "confirmed");
  assert.equal(completed.page.status, "verified");
  assert.equal(completed.page.reconciliationOutcome, "valid");
  const stored = await StoredAsset.findById(reserved.upload?.assetId).lean();
  ensure(stored);
  assert.match(stored.storageKey, new RegExp(`${reserved.upload?.assetId}-[a-f0-9]{64}\\.jpg$`));
  assert.equal(Buffer.from(r2.objects.get(stored.storageKey)?.body ?? []).toString(), body.toString());
  const reservationKey = [...r2.deletedKeys].find((key) => key !== stored.storageKey);
  assert.ok(reservationKey);
  r2.objects.set(reservationKey!, { body: new Uint8Array(Buffer.from("late-overwrite")), contentType: "image/jpeg", etag: '"late"' });
  const replay = await completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(reserved.page.id) });
  assert.equal(replay.replayed, true);
  const queue = await listEvidenceReconciliation({ actor: actor(), assessmentDeliveryVersionId: DELIVERY });
  assert.equal(queue.summary.expectedPages, 2); assert.equal(queue.summary.acceptedPages, 1); assert.equal(queue.summary.missingPages, 1);
  const preview = await getEvidencePreview({ actor: actor(), evidencePageId: new Types.ObjectId(reserved.page.id) });
  assert.match(preview.redirectUrl, /presign-get/);
  assert.ok(preview.redirectUrl.includes(encodeURIComponent(stored.storageKey)));
  assert.ok(!preview.redirectUrl.includes(encodeURIComponent(reservationKey!)));
  assert.equal(await AssessmentEvidenceReceipt.countDocuments(), 1);
});

test("fails closed for Premium, school, revoked-session, wrong-page, and private-asset boundaries", async () => {
  await assert.rejects(() => createEvidenceCaptureSession({ actor: actor(SCHOOL_A, ADMIN_A, false), assessmentDeliveryVersionId: DELIVERY, deviceSessionId: "device-denied-001", idempotencyKey: "session-denied-001" }), (error: unknown) => error instanceof AssessmentEvidenceError && error.status === 403);
  await assert.rejects(() => createEvidenceCaptureSession({ actor: actor(SCHOOL_B, ADMIN_B), assessmentDeliveryVersionId: DELIVERY, deviceSessionId: "device-other-001", idempotencyKey: "session-other-001" }), (error: unknown) => error instanceof AssessmentEvidenceError && error.status === 404);
  const created = await createEvidenceCaptureSession({ actor: actor(), assessmentDeliveryVersionId: DELIVERY, deviceSessionId: "device-revoke-001", idempotencyKey: "session-revoke-001", auditContext: auditContext("session-revoke-001") });
  await revokeEvidenceCaptureSession({ actor: actor(), sessionId: new Types.ObjectId(created.session.id), reason: "Device reported lost", idempotencyKey: "revoke-001", auditContext: auditContext("revoke-001") });
  await assert.rejects(() => reserveEvidencePage({ actor: actor(), sessionId: new Types.ObjectId(created.session.id), packetId: "ES-PKT-EVIDENCE-001", pageId: "page-1", fileName: "page.jpg", mimeType: "image/jpeg", clientUploadId: "upload-revoked-001" }), (error: unknown) => error instanceof AssessmentEvidenceError && error.status === 403);
  const reserved = await reserve("upload-unknown-page-001", "page-unknown");
  assert.equal(reserved.result.page.reconciliationOutcome, "unknown_page");
  const asset = await StoredAsset.findById(reserved.result.upload?.assetId).lean(); ensure(asset); assert.equal(asset.visibility, "private");
});

test("server digest rejects altered evidence and missing objects without issuing a receipt", async () => {
  const body = Buffer.from("synthetic-page-original");
  const reserved = await reserve("upload-digest-001", "page-1", undefined, digest(Buffer.from("different")));
  await upload(reserved.result, body);
  await assert.rejects(() => completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(reserved.result.page.id) }), (error: unknown) => error instanceof AssessmentEvidenceError && error.status === 409);
  assert.equal(await AssessmentEvidenceReceipt.countDocuments(), 0);
  const missing = await reserve("upload-missing-001", "page-2");
  await assert.rejects(() => completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(missing.result.page.id) }), (error: unknown) => error instanceof AssessmentEvidenceError && error.status === 409);
  assert.equal((await AssessmentEvidencePage.findById(missing.result.page.id).lean())?.reconciliationOutcome, "missing_object");
});

test("temporary-object mutation after the source read cannot change the immutable receipt bytes", async () => {
  const reserved = await reserve("upload-overwrite-race-001", "page-1");
  const body = Buffer.from("race-original-bytes");
  await upload(reserved.result, body);
  const asset = await StoredAsset.findById(reserved.result.upload?.assetId).lean(); ensure(asset);
  const reservationKey = asset.storageKey;
  const originalGetObjectStream = r2.getObjectStream;
  r2.getObjectStream = async (key) => {
    const result = await originalGetObjectStream(key);
    if (key !== reservationKey || !result.body) return result;
    async function* mutateAfterRead() {
      for await (const chunk of result.body as AsyncIterable<Uint8Array>) yield chunk;
      r2.objects.set(key, { body: new Uint8Array(Buffer.from("race-late-overwrite")), contentType: "image/jpeg", etag: '"late-race"' });
    }
    return { ...result, body: mutateAfterRead() };
  };
  try {
    const completed = await completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(reserved.result.page.id) });
    assert.equal(completed.receipt.digest, digest(body));
    const stored = await StoredAsset.findById(reserved.result.upload?.assetId).lean(); ensure(stored);
    assert.equal(digest(Buffer.from(r2.objects.get(stored.storageKey)?.body ?? [])), completed.receipt.digest);
  } finally {
    r2.getObjectStream = originalGetObjectStream;
  }
});

test("final-object digest mismatch fails closed without issuing a receipt", async () => {
  const reserved = await reserve("upload-final-corruption-001", "page-1");
  const body = Buffer.from("final-object-original");
  await upload(reserved.result, body);
  const asset = await StoredAsset.findById(reserved.result.upload?.assetId).lean(); ensure(asset);
  const originalPutObject = r2.putObject;
  r2.putObject = async (input) => {
    const result = await originalPutObject(input);
    if (input.key !== asset.storageKey) {
      r2.objects.set(input.key, { body: new Uint8Array(Buffer.from("final-object-altered")), contentType: input.contentType, etag: '"altered"' });
    }
    return result;
  };
  try {
    await assert.rejects(() => completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(reserved.result.page.id) }), (error: unknown) => error instanceof AssessmentEvidenceError && error.status === 502);
    assert.equal(await AssessmentEvidenceReceipt.countDocuments(), 0);
    const page = await AssessmentEvidencePage.findById(reserved.result.page.id).lean();
    assert.equal(page?.status, "rejected");
    assert.equal(page?.reconciliationOutcome, "rejected");
  } finally {
    r2.putObject = originalPutObject;
  }
});

test("concurrent same-page uploads keep one current image and classify the other", async () => {
  const left = await reserve("upload-race-left-001", "page-1");
  const right = await reserve("upload-race-right-001", "page-1");
  const body = Buffer.from("same-page-bytes");
  await upload(left.result, body); await upload(right.result, body);
  const results = await Promise.all([completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(left.result.page.id) }), completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(right.result.page.id) })]);
  assert.equal(results.filter((result) => result.page.reconciliationOutcome === "valid").length, 1);
  assert.equal(results.filter((result) => result.page.reconciliationOutcome === "duplicate").length, 1);
  assert.equal(await AssessmentEvidencePage.countDocuments({ accepted: true }), 1);
});

test("legal holds deny deletion requests and preserve an auditable decision", async () => {
  const reserved = await reserve("upload-retention-001", "page-1");
  const body = Buffer.from("retained-evidence"); await upload(reserved.result, body); await completeEvidencePage({ actor: actor(), pageId: new Types.ObjectId(reserved.result.page.id) });
  await placeEvidenceLegalHold({ actor: actor(), evidencePageId: new Types.ObjectId(reserved.result.page.id), reference: "legal-2026-001", reason: "Registrar preservation request", idempotencyKey: "hold-001", auditContext: auditContext("hold-001") });
  const request = await requestEvidenceDeletion({ actor: actor(), evidencePageId: new Types.ObjectId(reserved.result.page.id), reason: "Routine retention review", requestKey: "delete-001", auditContext: auditContext("delete-001") });
  assert.equal(request.request.status, "denied");
  assert.equal(request.request.denialReason, "Evidence is subject to an active legal hold");
  assert.equal((await AssessmentEvidencePage.findById(reserved.result.page.id).lean())?.deletionStatus, "not_requested");
  assert.equal(await AuditEvent.countDocuments({ actionCode: "assessment.evidence.deletion_requested", result: "failed" }), 1);
});
