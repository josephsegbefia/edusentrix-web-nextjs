import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { PDFDocument } from "pdf-lib";
import { stubAssessmentRouteDeps, setAssessmentRouteActiveSchool, setAssessmentRoutePremiumDecision } from "./assessment-route/helpers/stub-assessment-route-deps";
import { School } from "../src/models/School";
import { Subject } from "../src/models/Subject";
import { Grade } from "../src/models/Grade";
import { ClassGroup } from "../src/models/ClassGroup";
import { ExamType } from "../src/models/ExamType";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "../src/models/AssessmentPaperPacket";
import { AuditEvent } from "../src/models/AuditEvent";

stubAssessmentRouteDeps();

const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
let replSet: MongoMemoryReplSet;
let postRoute: (request: Request) => Promise<Response>;
let listRoute: (request: Request) => Promise<Response>;
let pdfRoute: (request: Request, context: { params: Promise<{ packetId: string }> }) => Promise<Response>;
let previewRoute: (request: Request, context: { params: Promise<{ deliveryId: string }> }) => Promise<Response>;

const oid = () => new Types.ObjectId();

async function createPublishedDelivery(schoolId = SCHOOL_A) {
  const academicPeriodId = oid();
  const subjectId = oid();
  const gradeId = oid();
  const classGroupId = oid();
  const examTypeId = oid();
  const questionId = oid();
  await School.create({ _id: schoolId, name: "Route Packet School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" });
  await Subject.create({ _id: subjectId, schoolId, name: `Mathematics ${schoolId}`, normalizedKey: `math-${schoolId}`, isActive: true });
  await Grade.create({ _id: gradeId, schoolId, name: `JHS 1 ${schoolId}`, isActive: true });
  await ClassGroup.create({ _id: classGroupId, schoolId, gradeId, name: "A", subjectIds: [], subjectOfferingIds: [], isActive: true });
  await ExamType.create({ _id: examTypeId, schoolId, name: `End of Term ${schoolId}`, requiresApproval: true, appearsOnReportCard: false, contributesToFinalGrade: false, canBePrinted: true, allowCandidateNumbers: true, allowAnswerSheet: false, status: "active" });
  const definition = await AssessmentDefinitionVersion.create({ _id: oid(), schoolId, definitionKey: `route-definition-${schoolId}`, sourceExamPaperId: oid(), version: 1, status: "published", title: "Route paper", examTypeId, academicYearId: academicPeriodId, academicPeriodId, scope: "class_group", gradeId, classGroupIds: [classGroupId], subjectId, subjectOfferingId: null, durationMinutes: 30, instructions: null, candidateInstructions: "Answer the question.", resultBinding: "none", assessmentPlanId: null, assessmentItemId: null, scoring: { maximumMarks: 2, questionMarksTotal: 2, policy: "raw_marks", scoreBearing: false, contributesToCanonicalAcademicEngine: false }, sections: [{ sourceSectionId: oid(), title: "Section A", instructions: null, order: 0, marks: 2, questions: [{ sourceQuestionId: questionId, sourceQuestionBankItemId: null, sectionId: null, order: 0, type: "short_answer", prompt: "Route snapshot question", plainTextPrompt: "Route snapshot question", options: [], subQuestions: [], marks: 2, difficulty: "easy", topic: null, subtopic: null, curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "private answer", markingGuide: "private guide", explanation: null, attachments: [] }] }], resourceManifest: [], contentHash: "c".repeat(64), contentHashAlgorithm: "sha256", attribution: { authorId: ADMIN, reviewerId: ADMIN, publisherId: ADMIN }, publishedAt: new Date(), supersededAt: null, archivedAt: null });
  return AssessmentDeliveryVersion.create({ _id: oid(), schoolId, deliveryKey: `route-delivery-${schoolId}`, assessmentDefinitionVersionId: definition._id, definitionContentHash: definition.contentHash, version: 1, supersedesVersionId: null, title: "Route paper delivery", mode: "paper", academicYearId: academicPeriodId, academicPeriodId, gradeId, classGroupIds: [classGroupId], subjectId, subjectOfferingId: null, schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId, scheduledDate: null, startTime: null, endTime: null, venueId: null, roomLabel: null, classGroupIds: [classGroupId] }, timing: { durationMinutes: 30, lateEntryMinutes: 0, serverAuthoritative: true }, resultBinding: "none", assessmentPlanId: null, assessmentItemId: null, reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" }, accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null }, contentHash: "d".repeat(64), contentHashAlgorithm: "sha256", status: "published", attribution: { createdBy: ADMIN, reviewedBy: ADMIN, publishedBy: ADMIN, supersededBy: null }, reviewedAt: new Date(), publishedAt: new Date(), supersededAt: null, archivedAt: null });
}

function signedIn(schoolId = SCHOOL_A, roles = ["school_admin"]) {
  setAssessmentRouteActiveSchool({ ok: true, context: { userId: ADMIN, schoolId, roles } });
}

function request(url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGO_DB_NAME = "assessment_paper_packet_route";
  await mongoose.connect(uri, { dbName: "assessment_paper_packet_route" });
  await Promise.all([School.createIndexes(), Subject.createIndexes(), Grade.createIndexes(), ClassGroup.createIndexes(), ExamType.createIndexes(), AssessmentDefinitionVersion.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AuditEvent.createIndexes()]);
  ({ POST: postRoute, GET: listRoute } = await import("../src/app/api/admin/assess/packets/route"));
  ({ GET: pdfRoute } = await import("../src/app/api/admin/assess/packets/[packetId]/pdf/route"));
  ({ GET: previewRoute } = await import("../src/app/api/admin/assess/deliveries/[deliveryId]/preview/route"));
});

beforeEach(async () => {
  await Promise.all([AuditEvent.deleteMany({}), AssessmentPaperPacket.deleteMany({}), AssessmentDeliveryVersion.deleteMany({}), AssessmentDefinitionVersion.deleteMany({}), ClassGroup.deleteMany({}), Grade.deleteMany({}), Subject.deleteMany({}), ExamType.deleteMany({}), School.deleteMany({})]);
  setAssessmentRouteActiveSchool(undefined);
  setAssessmentRoutePremiumDecision({ allowed: true });
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test("packet routes fail closed for identity, role, entitlement and tenant scope", async () => {
  assert.equal((await postRoute(request("http://localhost/api/admin/assess/packets", { quantity: 1 }))).status, 401);
  signedIn(SCHOOL_A, ["teacher"]);
  assert.equal((await postRoute(request("http://localhost/api/admin/assess/packets", { quantity: 1, assessmentDeliveryVersionId: String(oid()) }, { "x-idempotency-key": "route-denied-001" }))).status, 401);
  signedIn();
  setAssessmentRoutePremiumDecision({ allowed: false, reason: "Premium denied", statusCode: 403 });
  assert.equal((await postRoute(request("http://localhost/api/admin/assess/packets", { quantity: 1, assessmentDeliveryVersionId: String(oid()) }, { "x-idempotency-key": "route-premium-001" }))).status, 403);
});

test("authorized route generates and returns a candidate-safe PDF", async () => {
  const delivery = await createPublishedDelivery();
  signedIn();
  const created = await postRoute(request("http://localhost/api/admin/assess/packets", { assessmentDeliveryVersionId: String(delivery._id), quantity: 1, batchLabel: "Synthetic route batch" }, { "x-idempotency-key": "route-generate-001" }));
  assert.equal(created.status, 201);
  const body = (await created.json()) as { data: { packets: { packetId: string; pageManifest: { pageNumber: number }[] }[] } };
  const packet = body.data.packets[0];
  assert.ok(packet.packetId);
  assert.equal((await listRoute(request("http://localhost/api/admin/assess/packets"))).status, 200);
  const pdfResponse = await pdfRoute(request(`http://localhost/api/admin/assess/packets/${packet.packetId}/pdf?mode=reprint`), { params: Promise.resolve({ packetId: packet.packetId }) });
  assert.equal(pdfResponse.status, 200);
  const pdf = await PDFDocument.load(await pdfResponse.arrayBuffer());
  assert.equal(pdf.getPages().length, packet.pageManifest.length);
  const previewResponse = await previewRoute(request(`http://localhost/api/admin/assess/deliveries/${delivery._id}/preview`), { params: Promise.resolve({ deliveryId: String(delivery._id) }) });
  assert.equal(previewResponse.status, 200);
  const previewPdf = await PDFDocument.load(await previewResponse.arrayBuffer());
  assert.equal(previewPdf.getPages().length, packet.pageManifest.length);
  assert.equal(await AssessmentPaperPacket.countDocuments({}), 1);
});

test("another school cannot list or generate packets for this delivery", async () => {
  const delivery = await createPublishedDelivery(SCHOOL_A);
  signedIn(SCHOOL_B);
  const list = await listRoute(request("http://localhost/api/admin/assess/packets"));
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).data.packets, []);
  const created = await postRoute(request("http://localhost/api/admin/assess/packets", { assessmentDeliveryVersionId: String(delivery._id), quantity: 1 }, { "x-idempotency-key": "route-cross-001" }));
  assert.equal(created.status, 404);
});
