import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { School } from "../src/models/School";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { Grade } from "../src/models/Grade";
import { ClassGroup } from "../src/models/ClassGroup";
import { Student } from "../src/models/Student";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "../src/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment } from "../src/models/AssessmentPaperPacketAssignment";
import { AssessmentPaperPacketCorrection } from "../src/models/AssessmentPaperPacketCorrection";
import { AuditEvent } from "../src/models/AuditEvent";
import {
  AssessmentPaperAssignmentError,
  assignAssessmentPaperPacket,
  getAssessmentPacketAssignment,
  listEligibleAssessmentCandidates,
  requestAssessmentPacketCorrection,
  reviewAssessmentPacketCorrection,
} from "../src/lib/assess/assessment-paper-assignment-service";

const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN_A = new Types.ObjectId();
const ADMIN_B = new Types.ObjectId();
const ACTOR = { userId: ADMIN_A, schoolId: SCHOOL_A, isAdmin: true, premiumPublicationEntitled: true };
let replSet: MongoMemoryReplSet;
let deliveryId: Types.ObjectId;
let packetId: Types.ObjectId;
let studentA: Types.ObjectId;
let studentB: Types.ObjectId;
let studentC: Types.ObjectId;

const oid = () => new Types.ObjectId();
function actor(userId = ADMIN_A, schoolId = SCHOOL_A, entitled = true, isAdmin = true) { return { userId, schoolId, isAdmin, premiumPublicationEntitled: entitled }; }

async function fixture() {
  const periodId = oid();
  const gradeId = oid();
  const classGroupId = oid();
  const delivery = oid();
  const packet = oid();
  await School.create([{ _id: SCHOOL_A, name: "Assignment School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" }, { _id: SCHOOL_B, name: "Other School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" }]);
  await AcademicPeriod.create({ _id: periodId, schoolId: SCHOOL_A, yearLabel: "2026/27", term: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-20"), isCurrent: true });
  await Grade.create({ _id: gradeId, schoolId: SCHOOL_A, name: "JHS 1", isActive: true });
  await ClassGroup.create({ _id: classGroupId, schoolId: SCHOOL_A, gradeId, name: "A", subjectIds: [], subjectOfferingIds: [], isActive: true });
  const makeStudent = async (input: { schoolId?: Types.ObjectId; gradeId?: Types.ObjectId; classGroupId?: Types.ObjectId; status?: "active" | "inactive"; enrolledAt?: Date | null }) => (await Student.create({ _id: oid(), schoolId: input.schoolId ?? SCHOOL_A, firstName: "Student", lastName: String(Math.random()).slice(2, 8), gradeId: input.gradeId ?? gradeId, classGroupId: input.classGroupId ?? classGroupId, status: input.status ?? "active", enrolledAt: input.enrolledAt ?? new Date("2026-09-02") }))._id;
  studentA = await makeStudent({});
  studentB = await makeStudent({});
  studentC = await makeStudent({ enrolledAt: new Date("2027-01-01") });
  await AssessmentDeliveryVersion.create({ _id: delivery, schoolId: SCHOOL_A, deliveryKey: "assignment-delivery", assessmentDefinitionVersionId: oid(), definitionContentHash: "a".repeat(64), version: 1, supersedesVersionId: null, title: "Assignment delivery", mode: "paper", academicYearId: periodId, academicPeriodId: periodId, gradeId, classGroupIds: [classGroupId], subjectId: oid(), subjectOfferingId: null, schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId: periodId, scheduledDate: new Date("2026-11-01"), startTime: null, endTime: null, venueId: null, roomLabel: null, classGroupIds: [classGroupId] }, timing: { durationMinutes: 60, lateEntryMinutes: 0, serverAuthoritative: true }, resultBinding: "none", assessmentPlanId: null, assessmentItemId: null, reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" }, accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null }, contentHash: "b".repeat(64), contentHashAlgorithm: "sha256", status: "published", attribution: { createdBy: ADMIN_A, reviewedBy: ADMIN_A, publishedBy: ADMIN_A, supersededBy: null }, publishedAt: new Date() });
  await AssessmentPaperPacket.create({ _id: packet, schoolId: SCHOOL_A, assessmentDefinitionVersionId: oid(), assessmentDeliveryVersionId: delivery, deliveryContentHash: "b".repeat(64), packetId: "ES-PKT-ASSIGN-001", fallbackCode: "ES-ASSIGN-001", batchId: "ES-BATCH-ASSIGN", batchSequence: 1, batchQuantity: 1, generationIdempotencyKey: "packet-fixture-001", isBatchLeader: true, batchFingerprint: "c".repeat(64), status: "issued", pageManifest: [{ pageId: "page-1", pageNumber: 1, expectedPageCount: 1, fallbackCode: "ES-ASSIGN-001-P01", qrPayload: JSON.stringify({ v: 1, t: "paper-page", id: "opaque" }) }], createdBy: ADMIN_A, issuedBy: ADMIN_A, issuedAt: new Date() });
  deliveryId = delivery; packetId = packet;
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  const uri = replSet.getUri(); process.env.MONGODB_URI = uri; process.env.MONGO_DB_NAME = "assessment_paper_assignment";
  await mongoose.connect(uri, { dbName: "assessment_paper_assignment" });
  await Promise.all([School.createIndexes(), AcademicPeriod.createIndexes(), Grade.createIndexes(), ClassGroup.createIndexes(), Student.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AssessmentPaperPacketAssignment.createIndexes(), AssessmentPaperPacketCorrection.createIndexes(), AuditEvent.createIndexes()]);
});
beforeEach(async () => {
  await Promise.all([AuditEvent.deleteMany({}), AssessmentPaperPacketCorrection.deleteMany({}), AssessmentPaperPacketAssignment.deleteMany({}), AssessmentPaperPacket.deleteMany({}), AssessmentDeliveryVersion.deleteMany({}), Student.deleteMany({}), ClassGroup.deleteMany({}), Grade.deleteMany({}), AcademicPeriod.deleteMany({}), School.deleteMany({})]);
  await fixture();
});
after(async () => { await mongoose.disconnect(); await replSet.stop(); });

test("assigns eligible students, scopes candidates, and replays identical requests", async () => {
  const candidates = await listEligibleAssessmentCandidates({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId });
  assert.equal(candidates.candidates.length, 2);
  const first = await assignAssessmentPaperPacket({ actor: ACTOR, assessmentPaperPacketId: packetId, studentId: studentA, idempotencyKey: "assignment-retry-001" });
  const replay = await assignAssessmentPaperPacket({ actor: ACTOR, assessmentPaperPacketId: packetId, studentId: studentA, idempotencyKey: "assignment-retry-001" });
  assert.equal(first.replayed, false); assert.equal(replay.replayed, true); assert.equal(String(first.assignment.studentId), String(studentA));
  assert.equal(await AuditEvent.countDocuments({ actionCode: "assessment.paper_assignment.assigned" }), 1);
});

test("fails closed for wrong school, inactive/mismatched enrollment, void packets, and duplicate active identities", async () => {
  await assert.rejects(() => assignAssessmentPaperPacket({ actor: actor(ADMIN_A, SCHOOL_B), assessmentPaperPacketId: packetId, studentId: studentA, idempotencyKey: "wrong-school-001" }), (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 404);
  await assert.rejects(() => assignAssessmentPaperPacket({ actor: ACTOR, assessmentPaperPacketId: packetId, studentId: studentC, idempotencyKey: "period-mismatch-001" }), (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 409);
  await AssessmentPaperPacket.collection.updateOne({ _id: packetId }, { $set: { status: "voided" } });
  await assert.rejects(() => assignAssessmentPaperPacket({ actor: ACTOR, assessmentPaperPacketId: packetId, studentId: studentA, idempotencyKey: "void-packet-001" }), (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 409);
  const newPacket = await AssessmentPaperPacket.create({ _id: oid(), schoolId: SCHOOL_A, assessmentDefinitionVersionId: oid(), assessmentDeliveryVersionId: deliveryId, deliveryContentHash: "b".repeat(64), packetId: "ES-PKT-ASSIGN-002", fallbackCode: "ES-ASSIGN-002", batchId: "ES-BATCH-ASSIGN-2", batchSequence: 1, batchQuantity: 1, generationIdempotencyKey: "packet-fixture-002", isBatchLeader: true, batchFingerprint: "d".repeat(64), status: "issued", pageManifest: [{ pageId: "page-2", pageNumber: 1, expectedPageCount: 1, fallbackCode: "ES-ASSIGN-002-P01", qrPayload: "{}" }], createdBy: ADMIN_A, issuedBy: ADMIN_A, issuedAt: new Date() });
  await assignAssessmentPaperPacket({ actor: ACTOR, assessmentPaperPacketId: newPacket._id, studentId: studentA, idempotencyKey: "duplicate-student-001" });
  await assert.rejects(() => assignAssessmentPaperPacket({ actor: ACTOR, assessmentPaperPacketId: newPacket._id, studentId: studentB, idempotencyKey: "duplicate-packet-001" }), (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 409);
});

test("concurrent assignment permits one active packet/student result", async () => {
  const results = await Promise.allSettled(["race-a-001", "race-b-001"].map((key) => assignAssessmentPaperPacket({ actor: ACTOR, assessmentPaperPacketId: packetId, studentId: studentA, idempotencyKey: key })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await AssessmentPaperPacketAssignment.countDocuments({ status: "active" }), 1);
});

test("requires independent review and preserves correction history", async () => {
  const assigned = await assignAssessmentPaperPacket({ actor: ACTOR, assessmentPaperPacketId: packetId, studentId: studentA, idempotencyKey: "correction-assignment-001" });
  const request = await requestAssessmentPacketCorrection({ actor: ACTOR, assignmentId: new Types.ObjectId(assigned.assignment.id), proposedStudentId: studentB, reason: "Registrar confirmed the packet was issued to the wrong student", idempotencyKey: "correction-request-001" });
  await assert.rejects(() => reviewAssessmentPacketCorrection({ actor: ACTOR, correctionId: new Types.ObjectId(request.correction.id), decision: "approve", decisionReason: "Self review", idempotencyKey: "correction-review-self-001" }), (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 403);
  const rejected = await reviewAssessmentPacketCorrection({ actor: actor(ADMIN_B), correctionId: new Types.ObjectId(request.correction.id), decision: "reject", decisionReason: "Evidence was not sufficient", idempotencyKey: "correction-review-001" });
  assert.equal(rejected.correction.status, "rejected");
  const current = await getAssessmentPacketAssignment({ actor: ACTOR, assignmentId: new Types.ObjectId(assigned.assignment.id) });
  assert.equal(current?.assignment.status, "active"); assert.equal(current?.corrections.length, 1);
  const request2 = await requestAssessmentPacketCorrection({ actor: ACTOR, assignmentId: new Types.ObjectId(assigned.assignment.id), proposedStudentId: studentB, reason: "Second officer received the corrected register", idempotencyKey: "correction-request-002" });
  const approved = await reviewAssessmentPacketCorrection({ actor: actor(ADMIN_B), correctionId: new Types.ObjectId(request2.correction.id), decision: "approve", decisionReason: "Verified against the school register", idempotencyKey: "correction-review-002" });
  assert.equal(approved.correction.status, "approved");
  assert.equal(await AssessmentPaperPacketAssignment.countDocuments({ assessmentPaperPacketId: packetId, status: "active" }), 1);
  assert.equal(await AssessmentPaperPacketAssignment.countDocuments({ assessmentPaperPacketId: packetId, status: "replaced" }), 1);
});

test("unauthorized and non-Premium actors fail closed", async () => {
  await assert.rejects(() => assignAssessmentPaperPacket({ actor: actor(ADMIN_A, SCHOOL_A, false), assessmentPaperPacketId: packetId, studentId: studentA, idempotencyKey: "no-premium-001" }), (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 403);
  await assert.rejects(() => assignAssessmentPaperPacket({ actor: actor(ADMIN_A, SCHOOL_A, true, false), assessmentPaperPacketId: packetId, studentId: studentA, idempotencyKey: "no-admin-001" }), (error: unknown) => error instanceof AssessmentPaperAssignmentError && error.status === 403);
});
