import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { stubAssessmentRouteDeps, setAssessmentRouteActiveSchool, setAssessmentRoutePremiumDecision } from "./assessment-route/helpers/stub-assessment-route-deps";
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
import { AuditEvent } from "../src/models/AuditEvent";
import { AuditStreamHead } from "../src/models/AuditStreamHead";
import { setR2PortForTests } from "../src/lib/storage/r2";
import { createMockR2Port } from "./storage/helpers/mock-r2";
import { saveMarkingDraft, submitMarkingEvaluation } from "../src/lib/assess/assessment-marking-service";

stubAssessmentRouteDeps();

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
const oid = () => new Types.ObjectId();
const r2 = createMockR2Port();
const digest = "a".repeat(64);
let replSet: MongoMemoryReplSet;
let markingAssignmentsRoute: typeof import("../src/app/api/admin/assess/marking-assignments/route");
let reviewerAssignmentsRoute: typeof import("../src/app/api/admin/assess/marking-review-assignments/route");
let reviewRoute: typeof import("../src/app/api/admin/assess/marking-evaluations/[evaluationId]/review/route");

function request(url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function signedIn(userId = ADMIN, schoolId = SCHOOL) {
  setAssessmentRouteActiveSchool({ ok: true, context: { userId, schoolId, roles: ["school_admin"] } });
}

async function fixture() {
  await School.create({ _id: SCHOOL, name: "Marking Route School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" });
  await AcademicPeriod.create({ _id: PERIOD, schoolId: SCHOOL, yearLabel: "2026/27", term: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-20"), isCurrent: true });
  await Grade.create({ _id: GRADE, schoolId: SCHOOL, name: "JHS 1", isActive: true });
  await ClassGroup.create({ _id: CLASS_GROUP, schoolId: SCHOOL, gradeId: GRADE, name: "A", subjectIds: [], subjectOfferingIds: [], isActive: true });
  await Student.create({ _id: STUDENT, schoolId: SCHOOL, firstName: "Ama", lastName: "Route", admissionNo: "ROUTE-001", gradeId: GRADE, classGroupId: CLASS_GROUP, status: "active", enrolledAt: new Date("2026-09-02") });
  await User.create([
    { _id: ADMIN, schoolId: SCHOOL, email: "route-admin@example.test", firstName: "Route", lastName: "Admin", role: "school_admin" },
    { _id: REVIEWER, schoolId: SCHOOL, email: "route-reviewer@example.test", firstName: "Route", lastName: "Reviewer", role: "school_admin" },
    { _id: MARKER, schoolId: SCHOOL, email: "route-marker@example.test", firstName: "Route", lastName: "Marker", role: "teacher" },
  ]);
  await UserMembership.create([
    { userId: ADMIN, schoolId: SCHOOL, roles: ["school_admin"], status: "active" },
    { userId: REVIEWER, schoolId: SCHOOL, roles: ["school_admin"], status: "active" },
    { userId: MARKER, schoolId: SCHOOL, roles: ["teacher"], status: "active" },
  ]);
  await Teacher.create({ _id: TEACHER, schoolId: SCHOOL, userId: MARKER, status: "active", subjectIds: [], subjectOfferingIds: [], subroles: [] });
  await AssessmentDefinitionVersion.create({
    _id: DEFINITION, schoolId: SCHOOL, definitionKey: "marking-route-definition", sourceExamPaperId: oid(), version: 1,
    status: "published", title: "Route Mathematics", examTypeId: oid(), academicYearId: PERIOD, academicPeriodId: PERIOD,
    scope: "class_group", gradeId: GRADE, classGroupIds: [CLASS_GROUP], subjectId: oid(), durationMinutes: 60,
    instructions: null, candidateInstructions: null, resultBinding: "none", assessmentPlanId: null, assessmentItemId: null,
    scoring: { maximumMarks: 8, questionMarksTotal: 8, policy: "raw_marks", scoreBearing: false, contributesToCanonicalAcademicEngine: false },
    sections: [{ sourceSectionId: oid(), title: "Section A", instructions: null, order: 0, marks: 8, questions: [
      { sourceQuestionId: QUESTION_A, sourceQuestionBankItemId: null, sectionId: null, order: 0, type: "short_answer", prompt: "What is 2 + 2?", plainTextPrompt: "What is 2 + 2?", options: [], subQuestions: [], marks: 5, difficulty: "easy", topic: null, subtopic: null, curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "4", markingGuide: "Award five marks for the correct answer.", explanation: null, attachments: [] },
      { sourceQuestionId: QUESTION_B, sourceQuestionBankItemId: null, sectionId: null, order: 1, type: "short_answer", prompt: "Name a three-sided polygon.", plainTextPrompt: "Name a three-sided polygon.", options: [], subQuestions: [], marks: 3, difficulty: "easy", topic: null, subtopic: null, curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "Triangle", markingGuide: "Award three marks for triangle.", explanation: null, attachments: [] },
    ] }],
    resourceManifest: [], contentHash: digest, contentHashAlgorithm: "sha256", attribution: { authorId: ADMIN, reviewerId: ADMIN, publisherId: ADMIN }, publishedAt: new Date(), supersededAt: null, archivedAt: null,
  });
  await AssessmentDeliveryVersion.create({
    _id: DELIVERY, schoolId: SCHOOL, deliveryKey: "marking-route-delivery", assessmentDefinitionVersionId: DEFINITION, definitionContentHash: digest,
    version: 1, supersedesVersionId: null, title: "Route marking delivery", mode: "paper", academicYearId: PERIOD, academicPeriodId: PERIOD,
    gradeId: GRADE, classGroupIds: [CLASS_GROUP], subjectId: oid(), subjectOfferingId: null,
    schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId: PERIOD, scheduledDate: new Date("2026-11-01"), startTime: null, endTime: null, venueId: null, roomLabel: null, classGroupIds: [CLASS_GROUP] },
    timing: { durationMinutes: 60, lateEntryMinutes: 0, serverAuthoritative: true }, resultBinding: "none", assessmentPlanId: null, assessmentItemId: null,
    reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" }, accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null },
    contentHash: "b".repeat(64), contentHashAlgorithm: "sha256", status: "published", attribution: { createdBy: ADMIN, reviewedBy: ADMIN, publishedBy: ADMIN, supersededBy: null }, publishedAt: new Date(), supersededAt: null, archivedAt: null,
  });
  await AssessmentPaperPacket.create({
    _id: PACKET, schoolId: SCHOOL, assessmentDefinitionVersionId: DEFINITION, assessmentDeliveryVersionId: DELIVERY, deliveryContentHash: "b".repeat(64),
    packetId: "ES-ROUTE-PKT-001", fallbackCode: "ES-ROUTE-001", batchId: "ES-ROUTE-BATCH", batchSequence: 1, batchQuantity: 1, generationIdempotencyKey: "route-packet-001", isBatchLeader: true, batchFingerprint: "c".repeat(64), status: "issued", pageManifest: [{ pageId: "route-page-1", pageNumber: 1, expectedPageCount: 1, fallbackCode: "ES-ROUTE-001-P01", qrPayload: "{}" }], createdBy: ADMIN, issuedBy: ADMIN, issuedAt: new Date(),
  });
  await AssessmentPaperPacketAssignment.create({ _id: PACKET_ASSIGNMENT, schoolId: SCHOOL, assessmentDeliveryVersionId: DELIVERY, assessmentPaperPacketId: PACKET, studentId: STUDENT, academicPeriodId: PERIOD, gradeId: GRADE, classGroupId: CLASS_GROUP, status: "active", assignmentIdempotencyKey: "route-packet-assignment-001", assignedBy: ADMIN, assignedAt: new Date(), replacedByCorrectionId: null, replacedAt: null });
  await AssessmentEvidencePage.create({ _id: EVIDENCE_PAGE, schoolId: SCHOOL, assessmentDeliveryVersionId: DELIVERY, captureSessionId: oid(), packetId: PACKET, observedPacketId: "ES-ROUTE-PKT-001", pageId: "route-page-1", expectedPageNumber: 1, expectedPageCount: 1, captureOrder: 1, assignmentId: PACKET_ASSIGNMENT, assetId: ASSET, clientUploadId: "route-upload-001", expectedDigest: digest, verifiedDigest: digest, digestAlgorithm: "sha256", integrityStatus: "verified", status: "verified", accepted: true, reconciliationOutcome: "valid", retentionPolicyRef: "assess-paper-evidence-default", retentionUntil: null, legalHold: { active: false, reference: null, reason: null, placedBy: null, placedAt: null }, deletionStatus: "not_requested", uploadedAt: new Date(), verifiedAt: new Date(), deletedAt: null });
  await AssessmentEvidenceReceipt.create({ schoolId: SCHOOL, evidencePageId: EVIDENCE_PAGE, receiptKey: `route-evidence:${EVIDENCE_PAGE}`, status: "confirmed", digest, sizeBytes: 15, issuedToUserId: ADMIN, issuedAt: new Date() });
  await StoredAsset.create({ _id: ASSET, schoolId: SCHOOL, ownerUserId: ADMIN, uploadedByUserId: ADMIN, provider: "r2", storageKey: "assess/route/page-1.jpg", fileName: "page-1.jpg", extension: "jpg", mimeType: "image/jpeg", sizeBytes: 15, kind: "assess_script_page", visibility: "private", status: "ready", association: { type: "assessmentEvidencePage", id: EVIDENCE_PAGE }, completedAt: new Date(), deletedAt: null, purgeAfter: null, failedAt: null, failureCode: null, etag: "route-etag", createdAt: new Date(), updatedAt: new Date() });
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGO_DB_NAME = "assessment_marking_route";
  await mongoose.connect(uri, { dbName: "assessment_marking_route" });
  setR2PortForTests(r2);
  await Promise.all([
    School.createIndexes(), AcademicPeriod.createIndexes(), Grade.createIndexes(), ClassGroup.createIndexes(), Student.createIndexes(), User.createIndexes(), UserMembership.createIndexes(), Teacher.createIndexes(), AssessmentDefinitionVersion.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AssessmentPaperPacketAssignment.createIndexes(), AssessmentEvidencePage.createIndexes(), AssessmentEvidenceReceipt.createIndexes(), StoredAsset.createIndexes(), AssessmentMarkingAssignment.createIndexes(), AssessmentMarkingEvaluation.createIndexes(), AssessmentMarkingRevision.createIndexes(), AssessmentMarkingReviewerAssignment.createIndexes(), AssessmentApprovedMarkingOutcome.createIndexes(), AuditEvent.createIndexes(), AuditStreamHead.createIndexes(),
  ]);
  markingAssignmentsRoute = await import("../src/app/api/admin/assess/marking-assignments/route");
  reviewerAssignmentsRoute = await import("../src/app/api/admin/assess/marking-review-assignments/route");
  reviewRoute = await import("../src/app/api/admin/assess/marking-evaluations/[evaluationId]/review/route");
});

beforeEach(async () => {
  await Promise.all([AuditEvent.deleteMany({}), AuditStreamHead.deleteMany({}), AssessmentApprovedMarkingOutcome.collection.deleteMany({}), AssessmentMarkingReviewerAssignment.deleteMany({}), AssessmentMarkingRevision.collection.deleteMany({}), AssessmentMarkingEvaluation.deleteMany({}), AssessmentMarkingAssignment.deleteMany({}), StoredAsset.deleteMany({}), AssessmentEvidenceReceipt.deleteMany({}), AssessmentEvidencePage.deleteMany({}), AssessmentPaperPacketAssignment.deleteMany({}), AssessmentPaperPacket.deleteMany({}), AssessmentDeliveryVersion.deleteMany({}), AssessmentDefinitionVersion.deleteMany({}), Teacher.deleteMany({}), UserMembership.deleteMany({}), User.deleteMany({}), Student.deleteMany({}), ClassGroup.deleteMany({}), Grade.deleteMany({}), AcademicPeriod.deleteMany({}), School.deleteMany({})]);
  setAssessmentRouteActiveSchool(undefined);
  setAssessmentRoutePremiumDecision({ allowed: true });
  r2.objects.clear();
  await fixture();
});

after(async () => {
  setR2PortForTests(null);
  await mongoose.disconnect();
  await replSet.stop();
});

test("admin marking routes enforce authentication, Premium, and verified-script eligibility", async () => {
  const url = `http://localhost/api/admin/assess/marking-assignments?assessmentDeliveryVersionId=${DELIVERY}`;
  assert.equal((await markingAssignmentsRoute.GET(request(url))).status, 401);
  signedIn();
  setAssessmentRoutePremiumDecision({ allowed: false, reason: "Premium denied", statusCode: 403 });
  assert.equal((await markingAssignmentsRoute.GET(request(url))).status, 403);
  setAssessmentRoutePremiumDecision({ allowed: true });
  const queueResponse = await markingAssignmentsRoute.GET(request(url));
  assert.equal(queueResponse.status, 200);
  const queue = (await queueResponse.json()).data as { eligibleScripts: Array<unknown>; markers: Array<unknown> };
  assert.equal(queue.eligibleScripts.length, 1);
  assert.equal(queue.markers.length, 1);
  assert.equal((await markingAssignmentsRoute.POST(request("http://localhost/api/admin/assess/marking-assignments", { packetAssignmentId: String(PACKET_ASSIGNMENT), markerUserId: String(MARKER) }))).status, 400);
  const assigned = await markingAssignmentsRoute.POST(request("http://localhost/api/admin/assess/marking-assignments", { packetAssignmentId: String(PACKET_ASSIGNMENT), markerUserId: String(MARKER), blindMarking: true }, { "x-idempotency-key": "route-marking-assignment-001" }));
  assert.equal(assigned.status, 201);
  const replay = await markingAssignmentsRoute.POST(request("http://localhost/api/admin/assess/marking-assignments", { packetAssignmentId: String(PACKET_ASSIGNMENT), markerUserId: String(MARKER), blindMarking: true }, { "x-idempotency-key": "route-marking-assignment-001" }));
  assert.equal(replay.status, 200);
  assert.equal((await markingAssignmentsRoute.GET(request(url))).status, 200);
});

test("review route requires a different authenticated school admin and preserves tenant scope", async () => {
  signedIn();
  const assigned = await markingAssignmentsRoute.POST(request("http://localhost/api/admin/assess/marking-assignments", { packetAssignmentId: String(PACKET_ASSIGNMENT), markerUserId: String(MARKER) }, { "x-idempotency-key": "route-marking-assignment-002" }));
  assert.equal(assigned.status, 201);
  const assignmentId = (await assigned.json()).data.id as string;
  await saveMarkingDraft({ actor: { userId: MARKER, schoolId: SCHOOL, teacherId: TEACHER, isAdmin: false, premiumPublicationEntitled: true }, markingAssignmentId: new Types.ObjectId(assignmentId), expectedDraftVersion: 0, questionScores: [{ questionId: String(QUESTION_A), score: 4 }, { questionId: String(QUESTION_B), score: 3 }] });
  const submitted = await submitMarkingEvaluation({ actor: { userId: MARKER, schoolId: SCHOOL, teacherId: TEACHER, isAdmin: false, premiumPublicationEntitled: true }, markingAssignmentId: new Types.ObjectId(assignmentId), idempotencyKey: "route-marking-submit-001" });
  signedIn();
  const reviewerAssignment = await reviewerAssignmentsRoute.POST(request("http://localhost/api/admin/assess/marking-review-assignments", { markingAssignmentId: assignmentId, reviewerUserId: String(REVIEWER) }, { "x-idempotency-key": "route-reviewer-assignment-001" }));
  assert.equal(reviewerAssignment.status, 201);
  setAssessmentRouteActiveSchool(undefined);
  const unauthenticated = await reviewRoute.POST(request("http://localhost/api/admin/assess/marking-evaluations/review", { decision: "approve", reason: "Reviewed" }, { "x-idempotency-key": "route-review-unauth" }), { params: Promise.resolve({ evaluationId: String(submitted.evaluation._id) }) });
  assert.equal(unauthenticated.status, 401);
  signedIn(REVIEWER);
  const approved = await reviewRoute.POST(request("http://localhost/api/admin/assess/marking-evaluations/review", { decision: "approve", reason: "Reviewed against the evidence" }, { "x-idempotency-key": "route-review-001" }), { params: Promise.resolve({ evaluationId: String(submitted.evaluation._id) }) });
  assert.equal(approved.status, 200);
  signedIn(ADMIN, OTHER_SCHOOL);
  const crossTenant = await markingAssignmentsRoute.GET(request(`http://localhost/api/admin/assess/marking-assignments?assessmentDeliveryVersionId=${DELIVERY}`));
  assert.equal(crossTenant.status, 200);
  assert.equal(((await crossTenant.json()).data.eligibleScripts as Array<unknown>).length, 0);
});
