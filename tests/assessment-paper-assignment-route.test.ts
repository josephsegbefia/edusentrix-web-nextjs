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
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "../src/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment } from "../src/models/AssessmentPaperPacketAssignment";
import { AssessmentPaperPacketCorrection } from "../src/models/AssessmentPaperPacketCorrection";
import { AuditEvent } from "../src/models/AuditEvent";

stubAssessmentRouteDeps();
const SCHOOL = new Types.ObjectId(); const ADMIN = new Types.ObjectId(); const OTHER_ADMIN = new Types.ObjectId();
let replSet: MongoMemoryReplSet; let deliveryId: Types.ObjectId; let packetId: Types.ObjectId; let studentA: Types.ObjectId; let studentB: Types.ObjectId;
const oid = () => new Types.ObjectId();
function request(url: string, body?: unknown, headers: Record<string, string> = {}) { return new Request(url, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); }
function signedIn(userId = ADMIN) { setAssessmentRouteActiveSchool({ ok: true, context: { userId, schoolId: SCHOOL, roles: ["school_admin"] } }); }

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } }); const uri = replSet.getUri(); process.env.MONGODB_URI = uri; process.env.MONGO_DB_NAME = "assessment_paper_assignment_route"; await mongoose.connect(uri, { dbName: "assessment_paper_assignment_route" });
  await Promise.all([School.createIndexes(), AcademicPeriod.createIndexes(), Grade.createIndexes(), ClassGroup.createIndexes(), Student.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AssessmentPaperPacketAssignment.createIndexes(), AssessmentPaperPacketCorrection.createIndexes(), AuditEvent.createIndexes()]);
  ({ POST: postAssignmentRoute, GET: getAssignmentRoute } = await import("../src/app/api/admin/assess/assignments/route"));
  ({ POST: postCorrectionRoute } = await import("../src/app/api/admin/assess/assignments/[assignmentId]/correction/route"));
});
let postAssignmentRoute: (request: Request) => Promise<Response>; let getAssignmentRoute: (request: Request) => Promise<Response>; let postCorrectionRoute: (request: Request, context: { params: Promise<{ assignmentId: string }> }) => Promise<Response>;
beforeEach(async () => {
  await Promise.all([AuditEvent.deleteMany({}), AssessmentPaperPacketCorrection.deleteMany({}), AssessmentPaperPacketAssignment.deleteMany({}), AssessmentPaperPacket.deleteMany({}), AssessmentDeliveryVersion.deleteMany({}), Student.deleteMany({}), ClassGroup.deleteMany({}), Grade.deleteMany({}), AcademicPeriod.deleteMany({}), School.deleteMany({})]);
  setAssessmentRouteActiveSchool(undefined); setAssessmentRoutePremiumDecision({ allowed: true });
  const periodId = oid(); const gradeId = oid(); const classGroupId = oid(); deliveryId = oid(); packetId = oid();
  await School.create({ _id: SCHOOL, name: "Route Assignment School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" });
  await AcademicPeriod.create({ _id: periodId, schoolId: SCHOOL, yearLabel: "2026/27", term: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-20"), isCurrent: true });
  await Grade.create({ _id: gradeId, schoolId: SCHOOL, name: "JHS 1", isActive: true }); await ClassGroup.create({ _id: classGroupId, schoolId: SCHOOL, gradeId, name: "A", subjectIds: [], subjectOfferingIds: [], isActive: true });
  studentA = (await Student.create({ _id: oid(), schoolId: SCHOOL, firstName: "Ada", lastName: "One", gradeId, classGroupId, status: "active", enrolledAt: new Date("2026-09-02") }))._id;
  studentB = (await Student.create({ _id: oid(), schoolId: SCHOOL, firstName: "Bola", lastName: "Two", gradeId, classGroupId, status: "active", enrolledAt: new Date("2026-09-02") }))._id;
  await AssessmentDeliveryVersion.create({ _id: deliveryId, schoolId: SCHOOL, deliveryKey: "route-assignment", assessmentDefinitionVersionId: oid(), definitionContentHash: "a".repeat(64), version: 1, title: "Route assignment delivery", mode: "paper", academicYearId: periodId, academicPeriodId: periodId, gradeId, classGroupIds: [classGroupId], subjectId: oid(), schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId: periodId, scheduledDate: new Date("2026-11-01"), classGroupIds: [classGroupId] }, timing: { durationMinutes: 45, lateEntryMinutes: 0, serverAuthoritative: true }, resultBinding: "none", reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" }, accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null }, contentHash: "b".repeat(64), contentHashAlgorithm: "sha256", status: "published", attribution: { createdBy: ADMIN, reviewedBy: ADMIN, publishedBy: ADMIN, supersededBy: null }, publishedAt: new Date() });
  await AssessmentPaperPacket.create({ _id: packetId, schoolId: SCHOOL, assessmentDefinitionVersionId: oid(), assessmentDeliveryVersionId: deliveryId, deliveryContentHash: "b".repeat(64), packetId: "ES-PKT-ROUTE-001", fallbackCode: "ES-ROUTE-001", batchId: "ES-BATCH-ROUTE", batchSequence: 1, batchQuantity: 1, generationIdempotencyKey: "route-packet-001", isBatchLeader: true, batchFingerprint: "c".repeat(64), status: "issued", pageManifest: [{ pageId: "route-page", pageNumber: 1, expectedPageCount: 1, fallbackCode: "ES-ROUTE-001-P01", qrPayload: "{}" }], createdBy: ADMIN, issuedBy: ADMIN, issuedAt: new Date() });
});
after(async () => { await mongoose.disconnect(); await replSet.stop(); });

test("assignment routes enforce identity, Premium, and authorized tenant context", async () => {
  assert.equal((await getAssignmentRoute(request(`http://localhost/api/admin/assess/assignments?assessmentDeliveryVersionId=${deliveryId}`))).status, 401);
  signedIn(); setAssessmentRoutePremiumDecision({ allowed: false, reason: "Premium denied", statusCode: 403 });
  assert.equal((await getAssignmentRoute(request(`http://localhost/api/admin/assess/assignments?assessmentDeliveryVersionId=${deliveryId}`))).status, 403);
  signedIn(); setAssessmentRoutePremiumDecision({ allowed: true });
  const response = await postAssignmentRoute(request("http://localhost/api/admin/assess/assignments", { packetId: String(packetId), studentId: String(studentA) }, { "x-idempotency-key": "route-assignment-001" }));
  assert.equal(response.status, 201); assert.equal((await getAssignmentRoute(request(`http://localhost/api/admin/assess/assignments?assessmentDeliveryVersionId=${deliveryId}`))).status, 200);
});

test("correction route creates a pending request and does not expose it without school auth", async () => {
  signedIn();
  const assigned = await postAssignmentRoute(request("http://localhost/api/admin/assess/assignments", { packetId: String(packetId), studentId: String(studentA) }, { "x-idempotency-key": "route-assignment-002" }));
  const assignment = (await assigned.json()).data as { id: string };
  const correction = await postCorrectionRoute(request("http://localhost/api/admin/assess/assignments/correction", { proposedStudentId: String(studentB), reason: "Registrar correction" }, { "x-idempotency-key": "route-correction-001" }), { params: Promise.resolve({ assignmentId: assignment.id }) });
  assert.equal(correction.status, 201);
  setAssessmentRouteActiveSchool(undefined);
  assert.equal((await postCorrectionRoute(request("http://localhost/api/admin/assess/assignments/correction", { proposedStudentId: String(studentB), reason: "No auth" }, { "x-idempotency-key": "route-correction-002" }), { params: Promise.resolve({ assignmentId: assignment.id }) })).status, 401);
});

test("different reviewer identity is represented by a separate authenticated route actor", async () => {
  signedIn(OTHER_ADMIN); assert.equal((await getAssignmentRoute(request(`http://localhost/api/admin/assess/assignments?assessmentDeliveryVersionId=${deliveryId}`))).status, 200);
});

