import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createHash } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { School } from "../src/models/School";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { Grade } from "../src/models/Grade";
import { ClassGroup } from "../src/models/ClassGroup";
import { Student } from "../src/models/Student";
import { User } from "../src/models/User";
import { UserMembership } from "../src/models/UserMembership";
import { Teacher } from "../src/models/Teacher";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "../src/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment } from "../src/models/AssessmentPaperPacketAssignment";
import { AssessmentEvidencePage } from "../src/models/AssessmentEvidencePage";
import { AssessmentEvidenceReceipt } from "../src/models/AssessmentEvidenceReceipt";
import { StoredAsset } from "../src/models/StoredAsset";
import { AssessmentMarkingAssignment } from "../src/models/AssessmentMarkingAssignment";
import { AssessmentMarkingEvaluation } from "../src/models/AssessmentMarkingEvaluation";
import { AssessmentMarkingRevision } from "../src/models/AssessmentMarkingRevision";
import { AssessmentMarkingReviewerAssignment } from "../src/models/AssessmentMarkingReviewerAssignment";
import { AssessmentApprovedMarkingOutcome } from "../src/models/AssessmentApprovedMarkingOutcome";
import { AssessmentPaperPacketCorrection } from "../src/models/AssessmentPaperPacketCorrection";
import { AuditEvent } from "../src/models/AuditEvent";
import { AuditStreamHead } from "../src/models/AuditStreamHead";
import { setR2PortForTests } from "../src/lib/storage/r2";
import { createMockR2Port } from "./storage/helpers/mock-r2";
import {
  AssessmentMarkingError,
  assignMarkingScript,
  assignMarkingReviewer,
  getMarkingEvidencePreview,
  getMarkerEvaluation,
  reviewMarkingEvaluation,
  saveMarkingDraft,
  submitMarkingEvaluation,
} from "../src/lib/assess/assessment-marking-service";

const SCHOOL = new Types.ObjectId();
const OTHER_SCHOOL = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
const REVIEWER = new Types.ObjectId();
const MARKER = new Types.ObjectId();
const TEACHER = new Types.ObjectId();
const PERIOD = new Types.ObjectId();
const GRADE = new Types.ObjectId();
const CLASS_GROUP = new Types.ObjectId();
const STUDENT = new Types.ObjectId();
const DEFINITION = new Types.ObjectId();
const DELIVERY = new Types.ObjectId();
const PACKET = new Types.ObjectId();
const PACKET_ASSIGNMENT = new Types.ObjectId();
const EVIDENCE_PAGE = new Types.ObjectId();
const ASSET = new Types.ObjectId();
const QUESTION_A = new Types.ObjectId();
const QUESTION_B = new Types.ObjectId();
let replSet: MongoMemoryReplSet;
const r2 = createMockR2Port();
const oid = () => new Types.ObjectId();
const digest = createHash("sha256").update("synthetic-page").digest("hex");
const adminActor = (schoolId = SCHOOL, userId = ADMIN, entitled = true) => ({ userId, schoolId, isAdmin: true, premiumPublicationEntitled: entitled });
const markerActor = (userId = MARKER, schoolId = SCHOOL, entitled = true) => ({ userId, schoolId, teacherId: TEACHER, isAdmin: false, premiumPublicationEntitled: entitled });
const auditContext = (idempotencyKey: string, actorId = ADMIN) => ({ requestId: idempotencyKey, correlationId: idempotencyKey, actorType: "user" as const, actorId, actorRole: "school_admin", schoolId: SCHOOL, idempotencyKey, clientSurface: "test" });

async function fixture() {
  await School.create([{ _id: SCHOOL, name: "Marking School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" }, { _id: OTHER_SCHOOL, name: "Other School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" }]);
  await AcademicPeriod.create({ _id: PERIOD, schoolId: SCHOOL, yearLabel: "2026/27", term: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-20"), isCurrent: true });
  await Grade.create({ _id: GRADE, schoolId: SCHOOL, name: "JHS 1", isActive: true });
  await ClassGroup.create({ _id: CLASS_GROUP, schoolId: SCHOOL, gradeId: GRADE, name: "A", subjectIds: [], subjectOfferingIds: [], isActive: true });
  await Student.create({ _id: STUDENT, schoolId: SCHOOL, firstName: "Ama", lastName: "Marker", admissionNo: "ST-001", gradeId: GRADE, classGroupId: CLASS_GROUP, status: "active", enrolledAt: new Date("2026-09-02") });
  await User.create([{ _id: MARKER, schoolId: SCHOOL, email: "marker@example.test", firstName: "Mark", lastName: "Teacher", role: "teacher" }, { _id: ADMIN, schoolId: SCHOOL, email: "admin@example.test", firstName: "School", lastName: "Admin", role: "school_admin" }, { _id: REVIEWER, schoolId: SCHOOL, email: "reviewer@example.test", firstName: "Independent", lastName: "Reviewer", role: "school_admin" }]);
  await UserMembership.create([{ userId: MARKER, schoolId: SCHOOL, roles: ["teacher"], status: "active" }, { userId: ADMIN, schoolId: SCHOOL, roles: ["school_admin"], status: "active" }, { userId: REVIEWER, schoolId: SCHOOL, roles: ["school_admin"], status: "active" }]);
  await Teacher.create({ _id: TEACHER, schoolId: SCHOOL, userId: MARKER, status: "active", subjectIds: [], subjectOfferingIds: [], subroles: [] });
  await AssessmentDefinitionVersion.create({ _id: DEFINITION, schoolId: SCHOOL, definitionKey: "marking-definition", sourceExamPaperId: oid(), version: 1, status: "published", title: "Synthetic Mathematics", examTypeId: oid(), academicYearId: PERIOD, academicPeriodId: PERIOD, scope: "class_group", gradeId: GRADE, classGroupIds: [CLASS_GROUP], subjectId: oid(), durationMinutes: 60, instructions: null, candidateInstructions: null, resultBinding: "none", assessmentPlanId: null, assessmentItemId: null, scoring: { maximumMarks: 8, questionMarksTotal: 8, policy: "raw_marks", scoreBearing: false, contributesToCanonicalAcademicEngine: false }, sections: [{ sourceSectionId: oid(), title: "Section A", instructions: null, order: 0, marks: 8, questions: [{ sourceQuestionId: QUESTION_A, sourceQuestionBankItemId: null, sectionId: null, order: 0, type: "short_answer", prompt: "What is 2 + 2?", plainTextPrompt: "What is 2 + 2?", options: [], subQuestions: [], marks: 5, difficulty: "easy", topic: null, subtopic: null, curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "4", markingGuide: "Award up to five marks for the correct method and answer.", explanation: null, attachments: [] }, { sourceQuestionId: QUESTION_B, sourceQuestionBankItemId: null, sectionId: null, order: 1, type: "short_answer", prompt: "Name a polygon with three sides.", plainTextPrompt: "Name a polygon with three sides.", options: [], subQuestions: [], marks: 3, difficulty: "easy", topic: null, subtopic: null, curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "Triangle", markingGuide: "Award three marks for triangle with a valid explanation.", explanation: null, attachments: [] }] }], resourceManifest: [], contentHash: "d".repeat(64), contentHashAlgorithm: "sha256", attribution: { authorId: ADMIN, reviewerId: ADMIN, publisherId: ADMIN }, publishedAt: new Date(), supersededAt: null, archivedAt: null });
  await AssessmentDeliveryVersion.create({ _id: DELIVERY, schoolId: SCHOOL, deliveryKey: "marking-delivery", assessmentDefinitionVersionId: DEFINITION, definitionContentHash: "d".repeat(64), version: 1, supersedesVersionId: null, title: "Synthetic marking delivery", mode: "paper", academicYearId: PERIOD, academicPeriodId: PERIOD, gradeId: GRADE, classGroupIds: [CLASS_GROUP], subjectId: oid(), subjectOfferingId: null, schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId: PERIOD, scheduledDate: new Date("2026-11-01"), startTime: null, endTime: null, venueId: null, roomLabel: null, classGroupIds: [CLASS_GROUP] }, timing: { durationMinutes: 60, lateEntryMinutes: 0, serverAuthoritative: true }, resultBinding: "none", assessmentPlanId: null, assessmentItemId: null, reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" }, accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null }, contentHash: "e".repeat(64), contentHashAlgorithm: "sha256", status: "published", attribution: { createdBy: ADMIN, reviewedBy: ADMIN, publishedBy: ADMIN, supersededBy: null }, publishedAt: new Date(), supersededAt: null, archivedAt: null });
  await AssessmentPaperPacket.create({ _id: PACKET, schoolId: SCHOOL, assessmentDefinitionVersionId: DEFINITION, assessmentDeliveryVersionId: DELIVERY, deliveryContentHash: "e".repeat(64), packetId: "ES-PKT-MARK-001", fallbackCode: "ES-MARK-001", batchId: "ES-BATCH-MARK", batchSequence: 1, batchQuantity: 1, generationIdempotencyKey: "marking-packet-001", isBatchLeader: true, batchFingerprint: "f".repeat(64), status: "issued", pageManifest: [{ pageId: "page-1", pageNumber: 1, expectedPageCount: 1, fallbackCode: "ES-MARK-001-P01", qrPayload: "{}" }], createdBy: ADMIN, issuedBy: ADMIN, issuedAt: new Date() });
  await AssessmentPaperPacketAssignment.create({ _id: PACKET_ASSIGNMENT, schoolId: SCHOOL, assessmentDeliveryVersionId: DELIVERY, assessmentPaperPacketId: PACKET, studentId: STUDENT, academicPeriodId: PERIOD, gradeId: GRADE, classGroupId: CLASS_GROUP, status: "active", assignmentIdempotencyKey: "marking-packet-assignment-001", assignedBy: ADMIN, assignedAt: new Date(), replacedByCorrectionId: null, replacedAt: null });
  await AssessmentEvidencePage.create({ _id: EVIDENCE_PAGE, schoolId: SCHOOL, assessmentDeliveryVersionId: DELIVERY, captureSessionId: oid(), packetId: PACKET, observedPacketId: "ES-PKT-MARK-001", pageId: "page-1", expectedPageNumber: 1, expectedPageCount: 1, captureOrder: 1, assignmentId: PACKET_ASSIGNMENT, assetId: ASSET, clientUploadId: "marking-upload-001", expectedDigest: digest, verifiedDigest: digest, digestAlgorithm: "sha256", integrityStatus: "verified", status: "verified", accepted: true, reconciliationOutcome: "valid", retentionPolicyRef: "assess-paper-evidence-default", retentionUntil: null, legalHold: { active: false, reference: null, reason: null, placedBy: null, placedAt: null }, deletionStatus: "not_requested", uploadedAt: new Date(), verifiedAt: new Date(), deletedAt: null });
  await AssessmentEvidenceReceipt.create({ schoolId: SCHOOL, evidencePageId: EVIDENCE_PAGE, receiptKey: `evidence:${EVIDENCE_PAGE.toString()}:${digest}`, status: "confirmed", digest, sizeBytes: 15, issuedToUserId: ADMIN, issuedAt: new Date() });
  await StoredAsset.create({ _id: ASSET, schoolId: SCHOOL, ownerUserId: ADMIN, uploadedByUserId: ADMIN, provider: "r2", storageKey: "assess/script/page-1.jpg", fileName: "page-1.jpg", extension: "jpg", mimeType: "image/jpeg", sizeBytes: 15, kind: "assess_script_page", visibility: "private", status: "ready", association: { type: "assessmentEvidencePage", id: EVIDENCE_PAGE }, completedAt: new Date(), deletedAt: null, purgeAfter: null, failedAt: null, failureCode: null, etag: "etag", createdAt: new Date(), updatedAt: new Date() });
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  await mongoose.connect(replSet.getUri(), { dbName: "assessment_marking" });
  setR2PortForTests(r2);
  await Promise.all([School.createIndexes(), AcademicPeriod.createIndexes(), Grade.createIndexes(), ClassGroup.createIndexes(), Student.createIndexes(), User.createIndexes(), UserMembership.createIndexes(), Teacher.createIndexes(), AssessmentDefinitionVersion.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AssessmentPaperPacketAssignment.createIndexes(), AssessmentPaperPacketCorrection.createIndexes(), AssessmentEvidencePage.createIndexes(), AssessmentEvidenceReceipt.createIndexes(), StoredAsset.createIndexes(), AssessmentMarkingAssignment.createIndexes(), AssessmentMarkingEvaluation.createIndexes(), AssessmentMarkingRevision.createIndexes(), AssessmentMarkingReviewerAssignment.createIndexes(), AssessmentApprovedMarkingOutcome.createIndexes(), AuditEvent.createIndexes(), AuditStreamHead.createIndexes()]);
});
beforeEach(async () => {
  r2.objects.clear(); r2.deletedKeys.length = 0;
  await Promise.all([AuditEvent.deleteMany({}), AuditStreamHead.deleteMany({}), AssessmentApprovedMarkingOutcome.collection.deleteMany({}), AssessmentMarkingReviewerAssignment.deleteMany({}), AssessmentMarkingRevision.collection.deleteMany({}), AssessmentMarkingEvaluation.deleteMany({}), AssessmentMarkingAssignment.deleteMany({}), AssessmentPaperPacketCorrection.deleteMany({}), StoredAsset.deleteMany({}), AssessmentEvidenceReceipt.deleteMany({}), AssessmentEvidencePage.deleteMany({}), AssessmentPaperPacketAssignment.deleteMany({}), AssessmentPaperPacket.deleteMany({}), AssessmentDeliveryVersion.deleteMany({}), AssessmentDefinitionVersion.deleteMany({}), Teacher.deleteMany({}), UserMembership.deleteMany({}), User.deleteMany({}), Student.deleteMany({}), ClassGroup.deleteMany({}), Grade.deleteMany({}), AcademicPeriod.deleteMany({}), School.deleteMany({})]);
  await fixture();
});
after(async () => { setR2PortForTests(null); await mongoose.disconnect(); await replSet.stop(); });

async function assign() {
  const result = await assignMarkingScript({ actor: adminActor(), packetAssignmentId: PACKET_ASSIGNMENT, markerUserId: MARKER, blindMarking: true, idempotencyKey: "marking-assignment-001", auditContext: auditContext("marking-assignment-001") });
  return new Types.ObjectId(String(result.assignment.id));
}

async function assignReviewer(markingAssignmentId: Types.ObjectId, reviewerUserId = REVIEWER) {
  return assignMarkingReviewer({ actor: adminActor(), markingAssignmentId, reviewerUserId, idempotencyKey: `reviewer-assignment-${String(markingAssignmentId)}-${String(reviewerUserId)}`, auditContext: auditContext(`reviewer-assignment-${String(markingAssignmentId)}-${String(reviewerUserId)}`) });
}

async function prepareSubmitted() {
  const assignmentId = await assign();
  const draft = await saveMarkingDraft({ actor: markerActor(), markingAssignmentId: assignmentId, expectedDraftVersion: 0, questionScores: [{ questionId: String(QUESTION_A), score: 4, feedback: "Method shown" }, { questionId: String(QUESTION_B), score: 3, feedback: "Correct" }] });
  const submitted = await submitMarkingEvaluation({ actor: markerActor(), markingAssignmentId: assignmentId, idempotencyKey: `submit:${String(assignmentId)}` });
  await assignReviewer(assignmentId);
  return { assignmentId, draft, submitted };
}

test("requires assigned active teacher, Premium, verified evidence, and school scope", async () => {
  await assert.rejects(() => assignMarkingScript({ actor: adminActor(SCHOOL, ADMIN, false), packetAssignmentId: PACKET_ASSIGNMENT, markerUserId: MARKER, idempotencyKey: "marking-denied-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 403);
  await assert.rejects(() => assignMarkingScript({ actor: adminActor(OTHER_SCHOOL), packetAssignmentId: PACKET_ASSIGNMENT, markerUserId: MARKER, idempotencyKey: "marking-cross-school-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 409);
  await AssessmentEvidencePage.updateOne({ _id: EVIDENCE_PAGE }, { $set: { accepted: false, status: "pending_reconciliation" } });
  await assert.rejects(() => assignMarkingScript({ actor: adminActor(), packetAssignmentId: PACKET_ASSIGNMENT, markerUserId: MARKER, idempotencyKey: "marking-missing-evidence-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 409);
});

test("supports blind assignment, server-side score validation, stale draft protection, and append-only review history", async () => {
  const assignmentId = await assign();
  const detail = await getMarkerEvaluation({ actor: markerActor(), markingAssignmentId: assignmentId });
  assert.equal(detail.assignment.candidate, null);
  assert.equal(detail.evaluation.status, "assigned");
  await assert.rejects(() => saveMarkingDraft({ actor: markerActor(), markingAssignmentId: assignmentId, expectedDraftVersion: 0, questionScores: [{ questionId: String(QUESTION_A), score: 6 }] }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 400);
  await assert.rejects(() => saveMarkingDraft({ actor: markerActor(), markingAssignmentId: assignmentId, expectedDraftVersion: 0, questionScores: [{ questionId: String(QUESTION_A), score: 1.001 }] }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 400);
  const firstSave = await saveMarkingDraft({ actor: markerActor(), markingAssignmentId: assignmentId, expectedDraftVersion: 0, questionScores: [{ questionId: String(QUESTION_A), score: 4, feedback: "Good method" }] });
  assert.equal(firstSave.evaluation.unmarkedQuestionCount, 1);
  await assert.rejects(() => submitMarkingEvaluation({ actor: markerActor(), markingAssignmentId: assignmentId, idempotencyKey: "marking-submit-incomplete-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 409);
  await assert.rejects(() => saveMarkingDraft({ actor: markerActor(), markingAssignmentId: assignmentId, expectedDraftVersion: 0, questionScores: [{ questionId: String(QUESTION_A), score: 4 }, { questionId: String(QUESTION_B), score: 3 }] }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 409);
  const complete = await saveMarkingDraft({ actor: markerActor(), markingAssignmentId: assignmentId, expectedDraftVersion: 1, questionScores: [{ questionId: String(QUESTION_A), score: 4 }, { questionId: String(QUESTION_B), score: 3, feedback: "Correct" }] });
  assert.equal(complete.evaluation.totalMarks, 7);
  const submitted = await submitMarkingEvaluation({ actor: markerActor(), markingAssignmentId: assignmentId, idempotencyKey: "marking-submit-001" });
  assert.equal(submitted.evaluation.status, "submitted");
  const replay = await submitMarkingEvaluation({ actor: markerActor(), markingAssignmentId: assignmentId, idempotencyKey: "marking-submit-001" });
  assert.equal(replay.replayed, true);
  await assignReviewer(assignmentId);
  await assert.rejects(() => reviewMarkingEvaluation({ actor: adminActor( SCHOOL, MARKER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Self review", idempotencyKey: "marking-review-self-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 403);
  const returned = await reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "return", reason: "Explain the second response", idempotencyKey: "marking-review-return-001" });
  assert.equal(returned.evaluation.status, "returned");
  assert.equal(await AssessmentMarkingRevision.countDocuments({ markingAssignmentId: assignmentId }), 2);
  const corrected = await saveMarkingDraft({ actor: markerActor(), markingAssignmentId: assignmentId, expectedDraftVersion: complete.evaluation.draftVersion, questionScores: [{ questionId: String(QUESTION_A), score: 5 }, { questionId: String(QUESTION_B), score: 3 }] });
  await submitMarkingEvaluation({ actor: markerActor(), markingAssignmentId: assignmentId, idempotencyKey: "marking-submit-002" });
  const approved = await reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: corrected.evaluation._id, decision: "approve", reason: "Reviewed against the evidence", idempotencyKey: "marking-review-approve-001" });
  assert.equal(approved.evaluation.status, "approved");
  assert.equal(await AssessmentMarkingRevision.countDocuments({ markingAssignmentId: assignmentId }), 4);
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ markingAssignmentId: assignmentId, status: "current" }), 1);
  assert.equal(approved.approvedOutcome?.totalMarks, 8);
  assert.equal(await AssessmentMarkingEvaluation.countDocuments({}), 1);
  await assert.rejects(() => AssessmentMarkingRevision.updateOne({ markingAssignmentId: assignmentId }, { $set: { totalMarks: 99 } }), /append-only/);
});

test("private evidence preview requires the assigned marker and uses the ready private asset", async () => {
  const assignmentId = await assign();
  const preview = await getMarkingEvidencePreview({ actor: markerActor(), markingAssignmentId: assignmentId, evidencePageId: EVIDENCE_PAGE });
  assert.match(preview.redirectUrl, /presign-get/);
  await assert.rejects(() => getMarkingEvidencePreview({ actor: markerActor(oid()), markingAssignmentId: assignmentId, evidencePageId: EVIDENCE_PAGE }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 404);
});

test("review authority is explicit, independent, school-scoped, and membership-sensitive", async () => {
  const { assignmentId, submitted } = await prepareSubmitted();
  await assert.rejects(() => assignReviewer(assignmentId, MARKER), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 403);
  await assert.rejects(() => assignMarkingReviewer({ actor: adminActor(OTHER_SCHOOL), markingAssignmentId: assignmentId, reviewerUserId: REVIEWER, idempotencyKey: "reviewer-wrong-school-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 404);
  await UserMembership.updateOne({ userId: REVIEWER, schoolId: SCHOOL }, { $set: { status: "suspended" } });
  await assert.rejects(() => reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Membership revoked", idempotencyKey: "reviewer-revoked-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 409);
});

test("approval creates one immutable Premium outcome and idempotent replay cannot create a second current result", async () => {
  const { assignmentId, submitted } = await prepareSubmitted();
  const first = await reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Independent evidence review complete", idempotencyKey: "moderation-approve-001" });
  assert.equal(first.approvedOutcome?.totalMarks, 7);
  assert.equal(first.approvedOutcome?.maximumAvailableMarks, 8);
  assert.equal(first.approvedOutcome?.coreResultStatus, "not_written");
  assert.equal(first.approvedOutcome?.scoreHandoffStatus, "not_authorized");
  const replay = await reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Independent evidence review complete", idempotencyKey: "moderation-approve-001" });
  assert.equal(replay.replayed, true);
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ markingAssignmentId: assignmentId, status: "current" }), 1);
  await assert.rejects(() => reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "return", reason: "Conflicting second decision", idempotencyKey: "moderation-return-after-approval-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 409);
  const outcome = await AssessmentApprovedMarkingOutcome.findOne({ markingAssignmentId: assignmentId });
  assert.ok(outcome);
  await assert.rejects(() => AssessmentApprovedMarkingOutcome.updateOne({ _id: outcome!._id }, { $set: { totalMarks: 99 } }), /immutable/);
  const evaluation = await AssessmentMarkingEvaluation.findOne({ _id: submitted.evaluation._id });
  assert.ok(evaluation);
  evaluation!.questionScores[0]!.score = 0;
  await assert.rejects(() => evaluation!.save(), /Approved marking scores are immutable/);
  const reopened = await AssessmentMarkingEvaluation.findOne({ _id: submitted.evaluation._id });
  assert.ok(reopened);
  reopened!.status = "returned";
  await assert.rejects(() => reopened!.save(), /Approved marking evaluations cannot be reopened/);
});

test("approval revalidates evidence and candidate state after submission", async () => {
  const { assignmentId, submitted } = await prepareSubmitted();
  await AssessmentEvidencePage.updateOne({ _id: EVIDENCE_PAGE }, { $set: { accepted: false, status: "pending_reconciliation" } });
  await assert.rejects(() => reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Evidence should block this", idempotencyKey: "moderation-missing-evidence-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 409);
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ markingAssignmentId: assignmentId }), 0);
  assert.equal((await AssessmentMarkingEvaluation.findById(submitted.evaluation._id))?.status, "submitted");
});

test("pending candidate correction blocks moderation approval", async () => {
  const { assignmentId, submitted } = await prepareSubmitted();
  await AssessmentPaperPacketCorrection.create({ schoolId: SCHOOL, assessmentDeliveryVersionId: DELIVERY, assessmentPaperPacketId: PACKET, assignmentId: PACKET_ASSIGNMENT, originalStudentId: STUDENT, proposedStudentId: STUDENT, reason: "Identity review required", status: "pending", correctionIdempotencyKey: "moderation-correction-pending-001", requestedBy: ADMIN, requestedAt: new Date(), reviewedBy: null, reviewedAt: null, decisionReason: null, resultingAssignmentId: null });
  await assert.rejects(() => reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Pending correction should block", idempotencyKey: "moderation-correction-block-001" }), (error: unknown) => error instanceof AssessmentMarkingError && error.status === 409);
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ markingAssignmentId: assignmentId }), 0);
});

test("concurrent approval and return leave one legal outcome and preserve the submitted revision", async () => {
  const { assignmentId, submitted } = await prepareSubmitted();
  const results = await Promise.allSettled([
    reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Approve concurrent test", idempotencyKey: "moderation-concurrent-approve-001" }),
    reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "return", reason: "Return concurrent test", idempotencyKey: "moderation-concurrent-return-001" }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(await AssessmentMarkingRevision.countDocuments({ markingAssignmentId: assignmentId }), 2);
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ markingAssignmentId: assignmentId, status: "current" }), (await AssessmentMarkingEvaluation.findById(submitted.evaluation._id))?.status === "approved" ? 1 : 0);
});

test("Tier 0 audit failure rolls back the approved outcome and evaluation transition", async () => {
  const { assignmentId, submitted } = await prepareSubmitted();
  const model = AuditEvent as unknown as Record<string, unknown>;
  const original = model.create;
  model.create = async () => { throw new Error("injected moderation audit failure"); };
  try {
    await assert.rejects(() => reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Audit rollback test", idempotencyKey: "moderation-audit-failure-001" }), /injected moderation audit failure/);
  } finally { model.create = original; }
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ markingAssignmentId: assignmentId }), 0);
  assert.equal((await AssessmentMarkingEvaluation.findById(submitted.evaluation._id))?.status, "submitted");
  assert.equal(await AssessmentMarkingRevision.countDocuments({ markingAssignmentId: assignmentId }), 1);
});

test("ambiguous transaction commit is reconciled by the review idempotency record", async () => {
  const { assignmentId, submitted } = await prepareSubmitted();
  const originalStartSession = mongoose.startSession;
  let injected = false;
  const runtime = mongoose as unknown as { startSession: typeof mongoose.startSession };
  runtime.startSession = async (...args: Parameters<typeof mongoose.startSession>) => {
    const session = await originalStartSession.apply(mongoose, args);
    const originalWithTransaction = session.withTransaction.bind(session);
    const mutableSession = session as unknown as { withTransaction: typeof session.withTransaction };
    mutableSession.withTransaction = (async (...transactionArgs: Parameters<typeof session.withTransaction>) => {
      const result = await originalWithTransaction(...transactionArgs);
      if (!injected) {
        injected = true;
        const error = new Error("synthetic unknown commit result") as Error & { errorLabels: string[] };
        error.errorLabels = ["UnknownTransactionCommitResult"];
        throw error;
      }
      return result;
    }) as typeof session.withTransaction;
    return session;
  };
  try {
    const result = await reviewMarkingEvaluation({ actor: adminActor(SCHOOL, REVIEWER), markingEvaluationId: submitted.evaluation._id, decision: "approve", reason: "Ambiguous commit reconciliation", idempotencyKey: "moderation-ambiguous-001" });
    assert.equal(result.replayed, true);
  } finally { runtime.startSession = originalStartSession; }
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ markingAssignmentId: assignmentId, status: "current" }), 1);
});
