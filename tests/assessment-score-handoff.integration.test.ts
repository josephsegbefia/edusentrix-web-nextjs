import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { School } from "../src/models/School";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { Grade } from "../src/models/Grade";
import { ClassGroup } from "../src/models/ClassGroup";
import { Student } from "../src/models/Student";
import { User } from "../src/models/User";
import { UserMembership } from "../src/models/UserMembership";
import { AssessmentPlan } from "../src/models/AssessmentPlan";
import { AssessmentItem } from "../src/models/AssessmentItem";
import { AssessmentScore } from "../src/models/AssessmentScore";
import { AssessmentScoreHandoffReceipt } from "../src/models/AssessmentScoreHandoffReceipt";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "../src/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment } from "../src/models/AssessmentPaperPacketAssignment";
import { AssessmentPaperPacketCorrection } from "../src/models/AssessmentPaperPacketCorrection";
import { AssessmentEvidencePage } from "../src/models/AssessmentEvidencePage";
import { AssessmentEvidenceReceipt } from "../src/models/AssessmentEvidenceReceipt";
import { StoredAsset } from "../src/models/StoredAsset";
import { AssessmentMarkingAssignment } from "../src/models/AssessmentMarkingAssignment";
import { AssessmentMarkingEvaluation } from "../src/models/AssessmentMarkingEvaluation";
import { AssessmentMarkingRevision } from "../src/models/AssessmentMarkingRevision";
import { AssessmentMarkingReviewerAssignment } from "../src/models/AssessmentMarkingReviewerAssignment";
import { AssessmentApprovedMarkingOutcome } from "../src/models/AssessmentApprovedMarkingOutcome";
import { AuditEvent } from "../src/models/AuditEvent";
import { AuditStreamHead } from "../src/models/AuditStreamHead";
import {
  AssessmentScoreHandoffError,
  handoffApprovedMarkingOutcome,
} from "../src/lib/assess/assessment-score-handoff-service";
import {
  AssessmentPaperAssignmentError,
  reviewAssessmentPacketCorrection,
} from "../src/lib/assess/assessment-paper-assignment-service";

let replSet: MongoMemoryReplSet;
const SCHOOL = new Types.ObjectId();
const OTHER_SCHOOL = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
const REVIEWER = new Types.ObjectId();
const MARKER = new Types.ObjectId();
const TEACHER = new Types.ObjectId();
const PERIOD = new Types.ObjectId();
const GRADE = new Types.ObjectId();
const CLASS_GROUP = new Types.ObjectId();
const SUBJECT = new Types.ObjectId();
const PLAN = new Types.ObjectId();
const ITEM = new Types.ObjectId();
const DEFINITION = new Types.ObjectId();
const DELIVERY = new Types.ObjectId();
const PACKET = new Types.ObjectId();
const PACKET_ASSIGNMENT = new Types.ObjectId();
const EVIDENCE_PAGE = new Types.ObjectId();
const ASSET = new Types.ObjectId();
const MARKING_ASSIGNMENT = new Types.ObjectId();
const EVALUATION = new Types.ObjectId();
const REVIEWER_ASSIGNMENT = new Types.ObjectId();
const REVISION = new Types.ObjectId();
const OUTCOME = new Types.ObjectId();
const QUESTION_A = new Types.ObjectId();
const QUESTION_B = new Types.ObjectId();
const DIGEST = "a".repeat(64);
const DEFINITION_HASH = "b".repeat(64);
const DELIVERY_HASH = "c".repeat(64);
const oid = () => new Types.ObjectId();

function actor(schoolId = SCHOOL, userId = ADMIN, entitled = true) {
  return { userId, schoolId, isAdmin: true, premiumPublicationEntitled: entitled };
}

function auditContext(key: string, actorId = ADMIN) {
  return {
    requestId: key,
    correlationId: key,
    idempotencyKey: key,
    actorType: "user" as const,
    actorId,
    actorRole: "school_admin",
    schoolId: SCHOOL,
    clientSurface: "test",
  };
}

async function fixture(options: { resultBinding?: "none" | "score_bearing"; sourceMaximumMarks?: number; totalMarks?: number } = {}) {
  const resultBinding = options.resultBinding ?? "score_bearing";
  const sourceMaximumMarks = options.sourceMaximumMarks ?? 8;
  const totalMarks = options.totalMarks ?? 7;
  await School.create({ _id: SCHOOL, name: "Handoff School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" });
  await School.create({ _id: OTHER_SCHOOL, name: "Other Handoff School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" });
  await AcademicPeriod.create({ _id: PERIOD, schoolId: SCHOOL, yearLabel: "2026/27", term: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-20"), isCurrent: true });
  await Grade.create({ _id: GRADE, schoolId: SCHOOL, name: "JHS 1", isActive: true });
  await ClassGroup.create({ _id: CLASS_GROUP, schoolId: SCHOOL, gradeId: GRADE, name: "A", subjectIds: [], subjectOfferingIds: [], isActive: true });
  await User.create([
    { _id: ADMIN, schoolId: SCHOOL, email: "handoff-admin@example.test", firstName: "Handoff", lastName: "Admin", role: "school_admin" },
    { _id: REVIEWER, schoolId: SCHOOL, email: "handoff-reviewer@example.test", firstName: "Handoff", lastName: "Reviewer", role: "school_admin" },
    { _id: MARKER, schoolId: SCHOOL, email: "handoff-marker@example.test", firstName: "Handoff", lastName: "Marker", role: "teacher" },
  ]);
  await UserMembership.create([
    { userId: ADMIN, schoolId: SCHOOL, roles: ["school_admin"], status: "active" },
    { userId: REVIEWER, schoolId: SCHOOL, roles: ["school_admin"], status: "active" },
    { userId: MARKER, schoolId: SCHOOL, roles: ["teacher"], status: "active" },
  ]);
  const studentId = new Types.ObjectId("680000000000000000000001");
  await Student.create({ _id: studentId, schoolId: SCHOOL, firstName: "Ama", lastName: "Handoff", admissionNo: "HAND-001", gradeId: GRADE, classGroupId: CLASS_GROUP, status: "active", enrolledAt: new Date() });
  await AssessmentPlan.create({ _id: PLAN, schoolId: SCHOOL, name: "Term plan", academicPeriodId: PERIOD, gradingPolicyId: oid(), appliesToGradeId: GRADE, appliesToGradeIds: [GRADE], appliesToClassGroupIds: [CLASS_GROUP], status: "active", componentRules: [], teacherCanCreateReportItems: true, teacherCanMarkItemsAsReportContributing: true, allowOfflineMarks: true, allowAppAssignmentImport: true, allowCsvImport: false, minimumCompletionRules: [] });
  await AssessmentItem.create({ _id: ITEM, schoolId: SCHOOL, academicPeriodId: PERIOD, assessmentPlanId: PLAN, classGroupId: CLASS_GROUP, gradeId: GRADE, subjectId: SUBJECT, teacherId: TEACHER, title: "Premium examination", assessmentType: "exam", sourceType: "manual", maxScore: 8, contributesToReport: true, contributionLockedByRule: true, missingPolicy: "block_submission", visibility: "teacher_only", status: "open", createdBy: ADMIN, updatedBy: ADMIN });
  await AssessmentDefinitionVersion.create({ _id: DEFINITION, schoolId: SCHOOL, definitionKey: "handoff-definition", sourceExamPaperId: oid(), version: 1, status: "published", title: "Premium examination", examTypeId: oid(), academicYearId: PERIOD, academicPeriodId: PERIOD, scope: "class_group", gradeId: GRADE, classGroupIds: [CLASS_GROUP], subjectId: SUBJECT, durationMinutes: 60, instructions: null, candidateInstructions: null, resultBinding, assessmentPlanId: resultBinding === "score_bearing" ? PLAN : null, assessmentItemId: resultBinding === "score_bearing" ? ITEM : null, scoring: { maximumMarks: sourceMaximumMarks, questionMarksTotal: sourceMaximumMarks, policy: "raw_marks", scoreBearing: resultBinding === "score_bearing", contributesToCanonicalAcademicEngine: resultBinding === "score_bearing" }, sections: [{ sourceSectionId: oid(), title: "Section A", instructions: null, order: 0, marks: sourceMaximumMarks, questions: [{ sourceQuestionId: QUESTION_A, sourceQuestionBankItemId: null, sectionId: null, order: 0, type: "short_answer", prompt: "Question A", plainTextPrompt: "Question A", options: [], subQuestions: [], marks: 5, difficulty: "easy", topic: null, subtopic: null, curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "A", markingGuide: "Award five", explanation: null, attachments: [] }, { sourceQuestionId: QUESTION_B, sourceQuestionBankItemId: null, sectionId: null, order: 1, type: "short_answer", prompt: "Question B", plainTextPrompt: "Question B", options: [], subQuestions: [], marks: 3, difficulty: "easy", topic: null, subtopic: null, curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "B", markingGuide: "Award three", explanation: null, attachments: [] }] }], resourceManifest: [], contentHash: DEFINITION_HASH, contentHashAlgorithm: "sha256", attribution: { authorId: ADMIN, reviewerId: ADMIN, publisherId: ADMIN }, publishedAt: new Date(), supersededAt: null, archivedAt: null });
  await AssessmentDeliveryVersion.create({ _id: DELIVERY, schoolId: SCHOOL, deliveryKey: "handoff-delivery", assessmentDefinitionVersionId: DEFINITION, definitionContentHash: DEFINITION_HASH, version: 1, supersedesVersionId: null, title: "Handoff delivery", mode: "paper", academicYearId: PERIOD, academicPeriodId: PERIOD, gradeId: GRADE, classGroupIds: [CLASS_GROUP], subjectId: SUBJECT, subjectOfferingId: null, schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId: PERIOD, scheduledDate: new Date("2026-11-01"), startTime: null, endTime: null, venueId: null, roomLabel: null, classGroupIds: [CLASS_GROUP] }, timing: { durationMinutes: 60, lateEntryMinutes: 0, serverAuthoritative: true }, resultBinding, assessmentPlanId: resultBinding === "score_bearing" ? PLAN : null, assessmentItemId: resultBinding === "score_bearing" ? ITEM : null, reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" }, accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null }, contentHash: DELIVERY_HASH, contentHashAlgorithm: "sha256", status: "published", attribution: { createdBy: ADMIN, reviewedBy: ADMIN, publishedBy: ADMIN, supersededBy: null }, publishedAt: new Date(), supersededAt: null, archivedAt: null });
  await AssessmentPaperPacket.create({ _id: PACKET, schoolId: SCHOOL, assessmentDefinitionVersionId: DEFINITION, assessmentDeliveryVersionId: DELIVERY, deliveryContentHash: DELIVERY_HASH, packetId: "ES-HANDOFF-PKT-001", fallbackCode: "ES-HANDOFF-001", batchId: "ES-HANDOFF-BATCH", batchSequence: 1, batchQuantity: 1, generationIdempotencyKey: "handoff-packet-001", isBatchLeader: true, batchFingerprint: "d".repeat(64), status: "issued", pageManifest: [{ pageId: "handoff-page-1", pageNumber: 1, expectedPageCount: 1, fallbackCode: "ES-HANDOFF-001-P01", qrPayload: "{}" }], createdBy: ADMIN, issuedBy: ADMIN, issuedAt: new Date() });
  await AssessmentPaperPacketAssignment.create({ _id: PACKET_ASSIGNMENT, schoolId: SCHOOL, assessmentDeliveryVersionId: DELIVERY, assessmentPaperPacketId: PACKET, studentId, academicPeriodId: PERIOD, gradeId: GRADE, classGroupId: CLASS_GROUP, status: "active", assignmentIdempotencyKey: "handoff-assignment-001", assignedBy: ADMIN, assignedAt: new Date(), replacedByCorrectionId: null, replacedAt: null });
  await AssessmentEvidencePage.create({ _id: EVIDENCE_PAGE, schoolId: SCHOOL, assessmentDeliveryVersionId: DELIVERY, captureSessionId: oid(), packetId: PACKET, observedPacketId: "ES-HANDOFF-PKT-001", pageId: "handoff-page-1", expectedPageNumber: 1, expectedPageCount: 1, captureOrder: 1, assignmentId: PACKET_ASSIGNMENT, assetId: ASSET, clientUploadId: "handoff-upload-001", expectedDigest: DIGEST, verifiedDigest: DIGEST, digestAlgorithm: "sha256", integrityStatus: "verified", status: "verified", accepted: true, reconciliationOutcome: "valid", retentionPolicyRef: "assess-paper-evidence-default", retentionUntil: null, legalHold: { active: false, reference: null, reason: null, placedBy: null, placedAt: null }, deletionStatus: "not_requested", uploadedAt: new Date(), verifiedAt: new Date(), deletedAt: null });
  await AssessmentEvidenceReceipt.create({ schoolId: SCHOOL, evidencePageId: EVIDENCE_PAGE, receiptKey: "handoff-evidence-001", status: "confirmed", digest: DIGEST, sizeBytes: 15, issuedToUserId: ADMIN, issuedAt: new Date() });
  await StoredAsset.create({ _id: ASSET, schoolId: SCHOOL, ownerUserId: ADMIN, uploadedByUserId: ADMIN, provider: "r2", storageKey: "assess/handoff/page-1.jpg", fileName: "page-1.jpg", extension: "jpg", mimeType: "image/jpeg", sizeBytes: 15, kind: "assess_script_page", visibility: "private", status: "ready", association: { type: "assessmentEvidencePage", id: EVIDENCE_PAGE }, completedAt: new Date(), deletedAt: null, purgeAfter: null, failedAt: null, failureCode: null, etag: "handoff-etag", createdAt: new Date(), updatedAt: new Date() });
  await AssessmentMarkingAssignment.create({ _id: MARKING_ASSIGNMENT, schoolId: SCHOOL, assessmentDefinitionVersionId: DEFINITION, assessmentDeliveryVersionId: DELIVERY, assessmentPaperPacketId: PACKET, packetAssignmentId: PACKET_ASSIGNMENT, studentId, markerUserId: MARKER, markerTeacherId: TEACHER, assignedBy: ADMIN, assignedAt: new Date(), status: "active", blindMarking: true, idempotencyKey: "handoff-marking-assignment-001", reassignedAt: null, reassignedBy: null, reassignReason: null, closedAt: null });
  const scores = [{ questionId: String(QUESTION_A), sectionId: null, questionOrder: 0, maximumMarks: 5, criteriaDigest: "e".repeat(64), score: 4, feedback: null }, { questionId: String(QUESTION_B), sectionId: null, questionOrder: 1, maximumMarks: 3, criteriaDigest: "f".repeat(64), score: 3, feedback: null }];
  await AssessmentMarkingEvaluation.create({ _id: EVALUATION, schoolId: SCHOOL, markingAssignmentId: MARKING_ASSIGNMENT, assessmentDefinitionVersionId: DEFINITION, assessmentDeliveryVersionId: DELIVERY, packetAssignmentId: PACKET_ASSIGNMENT, studentId, markerUserId: MARKER, status: "approved", blindMarking: true, draftVersion: 1, questionScores: scores, totalMarks, unmarkedQuestionCount: 0, submittedRevision: 1, submittedAt: new Date(), returnedAt: null, returnReason: null, reviewedBy: REVIEWER, reviewedAt: new Date(), reviewDecision: "approved", approvedAt: new Date() });
  await AssessmentMarkingReviewerAssignment.create({ _id: REVIEWER_ASSIGNMENT, schoolId: SCHOOL, assessmentDefinitionVersionId: DEFINITION, assessmentDeliveryVersionId: DELIVERY, assessmentPaperPacketId: PACKET, packetAssignmentId: PACKET_ASSIGNMENT, markingAssignmentId: MARKING_ASSIGNMENT, markingEvaluationId: EVALUATION, reviewerUserId: REVIEWER, assignedBy: ADMIN, assignedAt: new Date(), status: "completed", idempotencyKey: "handoff-reviewer-assignment-001", revokedAt: null, revokedBy: null, revokeReason: null, completedAt: new Date() });
  await AssessmentMarkingRevision.create({ _id: REVISION, schoolId: SCHOOL, markingAssignmentId: MARKING_ASSIGNMENT, markingEvaluationId: EVALUATION, revisionNumber: 1, kind: "approved", questionScores: scores, totalMarks, unmarkedQuestionCount: 0, actorUserId: REVIEWER, reason: "Independent review complete", idempotencyKey: "handoff-approved-revision-001", createdAt: new Date() });
  const student = await Student.findOne({ _id: studentId, schoolId: SCHOOL }).lean();
  await AssessmentApprovedMarkingOutcome.create({ _id: OUTCOME, schoolId: SCHOOL, assessmentDefinitionVersionId: DEFINITION, assessmentDeliveryVersionId: DELIVERY, assessmentPaperPacketId: PACKET, packetAssignmentId: PACKET_ASSIGNMENT, studentId: student!._id, markingAssignmentId: MARKING_ASSIGNMENT, markingEvaluationId: EVALUATION, reviewerAssignmentId: REVIEWER_ASSIGNMENT, approvedRevisionId: REVISION, approvedRevisionNumber: 1, outcomeKey: "handoff-outcome-001", questionScores: scores, maximumAvailableMarks: sourceMaximumMarks, totalMarks, unmarkedQuestionCount: 0, definitionContentHash: DEFINITION_HASH, deliveryContentHash: DELIVERY_HASH, questionCatalogDigest: "1".repeat(64), evidenceProvenance: [{ evidencePageId: EVIDENCE_PAGE, pageId: "handoff-page-1", pageNumber: 1, assetId: ASSET, receiptId: (await AssessmentEvidenceReceipt.findOne({ evidencePageId: EVIDENCE_PAGE }))!._id, digest: DIGEST, sizeBytes: 15 }], evidenceProvenanceDigest: "2".repeat(64), integrityReference: "3".repeat(64), approvedBy: REVIEWER, approvedAt: new Date(), status: "current", coreResultStatus: "not_written", scoreHandoffStatus: "not_authorized" });
  return { studentId };
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  await mongoose.connect(replSet.getUri(), { dbName: "assessment_score_handoff" });
  await Promise.all([
    School.createIndexes(), AcademicPeriod.createIndexes(), Grade.createIndexes(), ClassGroup.createIndexes(), Student.createIndexes(), User.createIndexes(), UserMembership.createIndexes(), AssessmentPlan.createIndexes(), AssessmentItem.createIndexes(), AssessmentScore.createIndexes(), AssessmentScoreHandoffReceipt.createIndexes(), AssessmentDefinitionVersion.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AssessmentPaperPacketAssignment.createIndexes(), AssessmentPaperPacketCorrection.createIndexes(), AssessmentEvidencePage.createIndexes(), AssessmentEvidenceReceipt.createIndexes(), StoredAsset.createIndexes(), AssessmentMarkingAssignment.createIndexes(), AssessmentMarkingEvaluation.createIndexes(), AssessmentMarkingRevision.createIndexes(), AssessmentMarkingReviewerAssignment.createIndexes(), AssessmentApprovedMarkingOutcome.createIndexes(), AuditEvent.createIndexes(), AuditStreamHead.createIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    AssessmentPaperPacketCorrection.deleteMany({}),
    AssessmentScoreHandoffReceipt.collection.deleteMany({}), AssessmentScore.deleteMany({}), AuditEvent.deleteMany({}), AuditStreamHead.deleteMany({}), AssessmentApprovedMarkingOutcome.collection.deleteMany({}), AssessmentMarkingReviewerAssignment.deleteMany({}), AssessmentMarkingRevision.collection.deleteMany({}), AssessmentMarkingEvaluation.deleteMany({}), AssessmentMarkingAssignment.deleteMany({}), StoredAsset.deleteMany({}), AssessmentEvidenceReceipt.deleteMany({}), AssessmentEvidencePage.deleteMany({}), AssessmentPaperPacketAssignment.deleteMany({}), AssessmentPaperPacket.deleteMany({}), AssessmentDeliveryVersion.deleteMany({}), AssessmentDefinitionVersion.deleteMany({}), AssessmentItem.deleteMany({}), AssessmentPlan.deleteMany({}), UserMembership.deleteMany({}), User.deleteMany({}), Student.deleteMany({}), ClassGroup.deleteMany({}), Grade.deleteMany({}), AcademicPeriod.deleteMany({}), School.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test("valid handoff writes one canonical score, receipt, and Tier 0 audit atomically", async () => {
  await fixture();
  const result = await handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-001", auditContext: auditContext("handoff-request-001") });
  assert.equal(result.replayed, false);
  assert.equal(result.receipt.appliedScore, 7);
  assert.equal(await AssessmentScore.countDocuments({ schoolId: SCHOOL, assessmentItemId: ITEM, studentId: (await fixtureStudent()).studentId }), 1);
  const score = await AssessmentScore.findOne({ schoolId: SCHOOL, assessmentItemId: ITEM });
  assert.equal(score?.score, 7);
  assert.equal(score?.maxScoreSnapshot, 8);
  assert.equal(score?.percentage, 87.5);
  assert.equal(await AssessmentScoreHandoffReceipt.countDocuments({ schoolId: SCHOOL, status: "completed" }), 1);
  assert.equal(await AuditEvent.countDocuments({ actionCode: "assessment.score_handoff.completed" }), 1);
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ schoolId: SCHOOL, coreResultStatus: "not_written" }), 1);
});

async function fixtureStudent() {
  return { studentId: new Types.ObjectId("680000000000000000000001") };
}

test("retries return the original receipt and never duplicate the Core score", async () => {
  await fixture();
  const first = await handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-002", auditContext: auditContext("handoff-request-002") });
  const replay = await handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-002-retry", auditContext: auditContext("handoff-request-002-retry") });
  assert.equal(replay.replayed, true);
  assert.equal(replay.receipt.id, first.receipt.id);
  assert.equal(await AssessmentScore.countDocuments({ schoolId: SCHOOL }), 1);
  assert.equal(await AuditEvent.countDocuments({ actionCode: "assessment.score_handoff.completed" }), 1);
});

test("an existing canonical score is a conflict and is never overwritten", async () => {
  await fixture();
  const studentId = (await fixtureStudent()).studentId;
  await AssessmentScore.create({ schoolId: SCHOOL, academicPeriodId: PERIOD, assessmentItemId: ITEM, assessmentPlanId: PLAN, classGroupId: CLASS_GROUP, subjectId: SUBJECT, studentId, teacherId: TEACHER, score: 6, maxScoreSnapshot: 8, percentage: 75, status: "recorded", recordedBy: ADMIN, updatedBy: ADMIN });
  await assert.rejects(() => handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-003" }), (error: unknown) => error instanceof AssessmentScoreHandoffError && error.status === 409);
  assert.equal((await AssessmentScore.findOne({ schoolId: SCHOOL }))?.score, 6);
  assert.equal(await AssessmentScoreHandoffReceipt.countDocuments({}), 0);
});

test("non-reporting delivery fails closed", async () => {
  await fixture({ resultBinding: "none" });
  await assert.rejects(() => handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-004" }), (error: unknown) => error instanceof AssessmentScoreHandoffError && error.status === 409);
  assert.equal(await AssessmentScore.countDocuments({}), 0);
});

test("unsupported maximum mapping fails closed without a score write", async () => {
  await fixture({ sourceMaximumMarks: 10 });
  await assert.rejects(() => handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-005" }), (error: unknown) => error instanceof AssessmentScoreHandoffError && error.status === 409);
  assert.equal(await AssessmentScore.countDocuments({}), 0);
});

test("wrong school, missing membership, and expired entitlement are denied", async () => {
  await fixture();
  await assert.rejects(() => handoffApprovedMarkingOutcome({ actor: actor(OTHER_SCHOOL, ADMIN), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-006" }), (error: unknown) => error instanceof AssessmentScoreHandoffError && error.status === 403);
  await assert.rejects(() => handoffApprovedMarkingOutcome({ actor: actor(SCHOOL, MARKER), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-007" }), (error: unknown) => error instanceof AssessmentScoreHandoffError && error.status === 403);
  await assert.rejects(() => handoffApprovedMarkingOutcome({ actor: actor(SCHOOL, ADMIN, false), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-008" }), (error: unknown) => error instanceof AssessmentScoreHandoffError && error.status === 403);
  assert.equal(await AssessmentScore.countDocuments({}), 0);
});

test("failure injection rolls back Core score, receipt, and audit", async () => {
  await fixture();
  await assert.rejects(() => handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-009", failureInjection: "after_core_score" }), /Injected failure/);
  assert.equal(await AssessmentScore.countDocuments({}), 0);
  assert.equal(await AssessmentScoreHandoffReceipt.countDocuments({}), 0);
  assert.equal(await AuditEvent.countDocuments({ actionCode: "assessment.score_handoff.completed" }), 0);
  await assert.rejects(() => handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-010", failureInjection: "after_receipt_save" }), /Injected failure/);
  assert.equal(await AssessmentScore.countDocuments({}), 0);
  assert.equal(await AssessmentScoreHandoffReceipt.countDocuments({}), 0);
  assert.equal(await AuditEvent.countDocuments({ actionCode: "assessment.score_handoff.completed" }), 0);
});

test("candidate correction cannot cross an approved handoff in either order or on retry", async () => {
  await fixture();
  const correctionId = oid();
  await AssessmentPaperPacketCorrection.create({
    _id: correctionId,
    schoolId: SCHOOL,
    assessmentDeliveryVersionId: DELIVERY,
    assessmentPaperPacketId: PACKET,
    assignmentId: PACKET_ASSIGNMENT,
    originalStudentId: new Types.ObjectId("680000000000000000000001"),
    proposedStudentId: oid(),
    reason: "Register identity check",
    status: "pending",
    correctionIdempotencyKey: "handoff-correction-001",
    requestedBy: ADMIN,
    requestedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    decisionReason: null,
    resultingAssignmentId: null,
  });

  await assert.rejects(
    () => reviewAssessmentPacketCorrection({ actor: actor(SCHOOL, REVIEWER), correctionId, decision: "approve", decisionReason: "Approved outcome already exists", idempotencyKey: "handoff-correction-review-before-001" }),
    (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 409,
  );
  assert.equal((await AssessmentPaperPacketAssignment.findById(PACKET_ASSIGNMENT).lean())?.status, "active");

  const concurrent = await Promise.allSettled([
    handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-correction-race-001" }),
    reviewAssessmentPacketCorrection({ actor: actor(SCHOOL, REVIEWER), correctionId, decision: "approve", decisionReason: "Approved outcome already exists", idempotencyKey: "handoff-correction-review-race-001" }),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 0, JSON.stringify(concurrent, (_key, value) => value instanceof Error ? { name: value.name, message: value.message } : value));
  assert.equal(await AssessmentScore.countDocuments({ schoolId: SCHOOL }), 0);

  const pending = await AssessmentPaperPacketCorrection.findById(correctionId);
  assert.ok(pending);
  pending.status = "rejected";
  pending.reviewedBy = REVIEWER;
  pending.reviewedAt = new Date();
  pending.decisionReason = "Correction was not authorized before handoff";
  await pending.save();
  const applied = await handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-correction-after-resolution-001" });
  assert.equal(applied.replayed, false);

  const postApprovedCorrectionId = oid();
  await AssessmentPaperPacketCorrection.create({
    _id: postApprovedCorrectionId,
    schoolId: SCHOOL,
    assessmentDeliveryVersionId: DELIVERY,
    assessmentPaperPacketId: PACKET,
    assignmentId: PACKET_ASSIGNMENT,
    originalStudentId: new Types.ObjectId("680000000000000000000001"),
    proposedStudentId: oid(),
    reason: "Late register correction",
    status: "pending",
    correctionIdempotencyKey: "handoff-correction-after-approved-001",
    requestedBy: ADMIN,
    requestedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    decisionReason: null,
    resultingAssignmentId: null,
  });

  const replay = await handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-correction-race-retry-001" });
  assert.equal(replay.replayed, true);
  await assert.rejects(
    () => reviewAssessmentPacketCorrection({ actor: actor(SCHOOL, REVIEWER), correctionId: postApprovedCorrectionId, decision: "approve", decisionReason: "Approved outcome already exists", idempotencyKey: "handoff-correction-review-retry-001" }),
    (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 409,
  );
  assert.equal(await AssessmentScore.countDocuments({ schoolId: SCHOOL, studentId: new Types.ObjectId("680000000000000000000001") }), 1);
  assert.equal(await AssessmentPaperPacketAssignment.countDocuments({ schoolId: SCHOOL, status: "active", studentId: new Types.ObjectId("680000000000000000000001") }), 1);
});

test("concurrent handoffs produce at most one canonical score and one completed receipt", async () => {
  await fixture();
  const results = await Promise.allSettled([
    handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-011-a" }),
    handoffApprovedMarkingOutcome({ actor: actor(), approvedOutcomeId: OUTCOME, requestIdempotencyKey: "handoff-request-011-b" }),
  ]);
  assert.equal(await AssessmentScore.countDocuments({ schoolId: SCHOOL }), 1, JSON.stringify(results, (_key, value) => value instanceof Error ? { name: value.name, message: value.message } : value));
  assert.equal(await AssessmentScoreHandoffReceipt.countDocuments({ schoolId: SCHOOL, status: "completed" }), 1);
  const fulfilledValues = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const rejectedCount = results.filter((result) => result.status === "rejected").length;
  assert.equal(fulfilledValues.filter((value) => value.replayed === false).length, 1);
  assert.equal(fulfilledValues.filter((value) => value.replayed === true).length + rejectedCount, 1);
});
