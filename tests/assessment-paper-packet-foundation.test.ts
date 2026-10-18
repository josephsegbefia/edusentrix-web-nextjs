import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { School } from "../src/models/School";
import { Subject } from "../src/models/Subject";
import { Grade } from "../src/models/Grade";
import { ClassGroup } from "../src/models/ClassGroup";
import { ExamType } from "../src/models/ExamType";
import { ExamPaper } from "../src/models/ExamPaper";
import { ExamQuestion } from "../src/models/ExamQuestion";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "../src/models/AssessmentPaperPacket";
import { AuditEvent } from "../src/models/AuditEvent";
import {
  AssessmentPaperPacketError,
  generatePaperPacketBatch,
  renderAssessmentPaperPacket,
  serializeAssessmentPaperPacket,
  voidAssessmentPaperPacket,
} from "../src/lib/assess/assessment-paper-packet-service";

const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
const ACTOR = { userId: ADMIN, schoolId: SCHOOL_A, isAdmin: true, premiumPublicationEntitled: true };
let replSet: MongoMemoryReplSet;
let deliveryId: Types.ObjectId;
let definitionId: Types.ObjectId;
let paperId: Types.ObjectId;

const oid = () => new Types.ObjectId();

async function fixture(options: { schoolId?: Types.ObjectId; deliveryStatus?: "published" | "draft" } = {}) {
  const schoolId = options.schoolId ?? SCHOOL_A;
  const academicPeriodId = oid();
  const subjectId = oid();
  const gradeId = oid();
  const classGroupId = oid();
  const examTypeId = oid();
  const sourcePaperId = oid();
  const sectionId = oid();
  const questionId = oid();
  const defHash = "a".repeat(64);

  await School.create({ _id: schoolId, name: "Packet School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" });
  await Subject.create({ _id: subjectId, schoolId, name: "Mathematics", normalizedKey: `math-${schoolId}`, isActive: true });
  await Grade.create({ _id: gradeId, schoolId, name: "JHS 1", isActive: true });
  await ClassGroup.create({ _id: classGroupId, schoolId, gradeId, name: "A", subjectIds: [], subjectOfferingIds: [], isActive: true });
  await ExamType.create({ _id: examTypeId, schoolId, name: "End of Term", requiresApproval: true, appearsOnReportCard: false, contributesToFinalGrade: false, canBePrinted: true, allowCandidateNumbers: true, allowAnswerSheet: false, status: "active" });
  await ExamPaper.create({ _id: sourcePaperId, schoolId, title: "Published snapshot paper", examTypeId, academicYearId: academicPeriodId, academicPeriodId, scope: "class_group", gradeId, classGroupIds: [classGroupId], subjectId, contributorIds: [], createdBy: ADMIN, ownerRole: "admin", totalMarks: 5, durationMinutes: 45, status: "approved", approvedAt: new Date(), approvedBy: ADMIN });
  await ExamQuestion.create({ _id: questionId, schoolId, examPaperId: sourcePaperId, sectionId, type: "short_answer", prompt: "Mutable source prompt", plainTextPrompt: "Mutable source prompt", options: [], subQuestions: [], marks: 5, difficulty: "easy", curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "CONFIDENTIAL ANSWER", markingGuide: "CONFIDENTIAL GUIDE", attachments: [], order: 0, createdBy: ADMIN, source: "manual" });

  const definition = await AssessmentDefinitionVersion.create({
    _id: oid(), schoolId, definitionKey: `packet-definition-${schoolId}`, sourceExamPaperId: sourcePaperId, version: 1, status: "published", title: "Published snapshot paper", examTypeId, academicYearId: academicPeriodId, academicPeriodId, scope: "class_group", gradeId, classGroupIds: [classGroupId], subjectId, subjectOfferingId: null, durationMinutes: 45, instructions: "Write clearly.", candidateInstructions: "Answer all questions.", resultBinding: "none", assessmentPlanId: null, assessmentItemId: null, scoring: { maximumMarks: 5, questionMarksTotal: 5, policy: "raw_marks", scoreBearing: false, contributesToCanonicalAcademicEngine: false }, sections: [{ sourceSectionId: sectionId, title: "Section A", instructions: "Answer this section.", order: 0, marks: 5, questions: [{ sourceQuestionId: questionId, sourceQuestionBankItemId: null, sectionId, order: 0, type: "short_answer", prompt: "Immutable snapshot prompt", plainTextPrompt: "Immutable snapshot prompt", options: [], subQuestions: [], marks: 5, difficulty: "easy", topic: null, subtopic: null, curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "CONFIDENTIAL ANSWER", markingGuide: "CONFIDENTIAL GUIDE", explanation: "CONFIDENTIAL EXPLANATION", attachments: [] }] }], resourceManifest: [], contentHash: defHash, contentHashAlgorithm: "sha256", attribution: { authorId: ADMIN, reviewerId: ADMIN, publisherId: ADMIN }, publishedAt: new Date(), supersededAt: null, archivedAt: null,
  });
  const delivery = await AssessmentDeliveryVersion.create({
    _id: oid(), schoolId, deliveryKey: `paper-delivery-${schoolId}`, assessmentDefinitionVersionId: definition._id, definitionContentHash: defHash, version: 1, supersedesVersionId: null, title: "Published paper delivery", mode: "paper", academicYearId: academicPeriodId, academicPeriodId, gradeId, classGroupIds: [classGroupId], subjectId, subjectOfferingId: null, schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId, scheduledDate: null, startTime: null, endTime: null, venueId: null, roomLabel: null, classGroupIds: [classGroupId] }, timing: { durationMinutes: 45, lateEntryMinutes: 0, serverAuthoritative: true }, resultBinding: "none", assessmentPlanId: null, assessmentItemId: null, reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" }, accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null }, contentHash: "b".repeat(64), contentHashAlgorithm: "sha256", status: options.deliveryStatus ?? "published", attribution: { createdBy: ADMIN, reviewedBy: ADMIN, publishedBy: ADMIN, supersededBy: null }, reviewedAt: new Date(), publishedAt: new Date(), supersededAt: null, archivedAt: null,
  });
  return { definition, delivery };
}

function actor(schoolId = SCHOOL_A, entitled = true, admin = true) {
  return { userId: ADMIN, schoolId, isAdmin: admin, premiumPublicationEntitled: entitled };
}

async function extractPdfText(bytes: Uint8Array) {
  const globalRef = globalThis as typeof globalThis & { DOMMatrix?: unknown; ImageData?: unknown; Path2D?: unknown };
  if (!globalRef.DOMMatrix) Object.defineProperty(globalThis, "DOMMatrix", { configurable: true, value: class {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; m11 = 1; m12 = 0; m13 = 0; m14 = 0; m21 = 0; m22 = 1; m23 = 0; m24 = 0; m31 = 0; m32 = 0; m33 = 1; m34 = 0; m41 = 0; m42 = 0; m43 = 0; m44 = 1; is2D = true; isIdentity = true;
    multiply() { return this; } translate() { return this; } scale() { return this; } rotate() { return this; } inverse() { return this; } toFloat32Array() { return new Float32Array([1, 0, 0, 1, 0, 0]); } toFloat64Array() { return new Float64Array([1, 0, 0, 1, 0, 0]); }
  }});
  if (!globalRef.ImageData) Object.defineProperty(globalThis, "ImageData", { configurable: true, value: class { data: Uint8ClampedArray; width: number; height: number; constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; } } });
  if (!globalRef.Path2D) Object.defineProperty(globalThis, "Path2D", { configurable: true, value: class { closePath() {} moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} arc() {} arcTo() {} ellipse() {} rect() {} roundRect() {} addPath() {} } });
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGO_DB_NAME = "assessment_paper_packet_foundation";
  await mongoose.connect(uri, { dbName: "assessment_paper_packet_foundation" });
  await Promise.all([School.createIndexes(), Subject.createIndexes(), Grade.createIndexes(), ClassGroup.createIndexes(), ExamType.createIndexes(), AssessmentDefinitionVersion.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AuditEvent.createIndexes()]);
});

beforeEach(async () => {
  await Promise.all([AuditEvent.deleteMany({}), AssessmentPaperPacket.deleteMany({}), AssessmentDeliveryVersion.deleteMany({}), AssessmentDefinitionVersion.deleteMany({}), ExamQuestion.deleteMany({}), ExamPaper.deleteMany({}), ExamType.deleteMany({}), ClassGroup.deleteMany({}), Grade.deleteMany({}), Subject.deleteMany({}), School.deleteMany({})]);
  const fixtureResult = await fixture();
  deliveryId = fixtureResult.delivery._id;
  definitionId = fixtureResult.definition._id;
  paperId = fixtureResult.definition.sourceExamPaperId;
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test("generates unique packets and page identities from immutable published content", async () => {
  const result = await generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 2, idempotencyKey: "packet-generate-001" });
  assert.equal(result.replayed, false);
  assert.equal(result.packets.length, 2);
  assert.notEqual(result.packets[0].packetId, result.packets[1].packetId);
  assert.equal(result.packets[0].pageManifest.length, result.packets[0].pageManifest[0].expectedPageCount);
  const pageIds = result.packets.flatMap((packet) => packet.pageManifest.map((page) => page.pageId));
  assert.equal(new Set(pageIds).size, pageIds.length);
  const qr = JSON.parse(result.packets[0].pageManifest[0].qrPayload) as Record<string, string | number>;
  assert.deepEqual(Object.keys(qr).sort(), ["id", "t", "v"]);
  assert.equal(qr.t, "paper-page");
  assert.equal("schoolId" in qr, false);
  assert.equal("studentId" in qr, false);
  assert.equal((await AuditEvent.countDocuments({ actionCode: "assessment.paper_packet.generated" })), 2);
});

test("same request replay preserves packet identities and concurrent batches stay unique", async () => {
  const [first, replay] = await Promise.all([
    generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 2, idempotencyKey: "packet-replay-001" }),
    generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 2, idempotencyKey: "packet-replay-001" }),
  ]);
  assert.equal(first.packets.length, 2);
  assert.equal(replay.packets.length, 2);
  assert.deepEqual(replay.packets.map((packet) => packet.packetId), first.packets.map((packet) => packet.packetId));
  const concurrent = await Promise.all([
    generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 1, idempotencyKey: "packet-concurrent-a" }),
    generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 1, idempotencyKey: "packet-concurrent-b" }),
  ]);
  const all = await AssessmentPaperPacket.find({}).lean();
  assert.equal(all.length, 4);
  assert.equal(new Set(all.map((packet) => packet.packetId)).size, 4);
  assert.notEqual(concurrent[0].batchId, concurrent[1].batchId);
});

test("renders candidate-safe PDF pages from the immutable definition snapshot", async () => {
  const generated = await generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 1, idempotencyKey: "packet-pdf-001" });
  await ExamQuestion.updateOne({ _id: (await ExamQuestion.findOne({ examPaperId: paperId }))!._id }, { $set: { prompt: "MUTATED SOURCE PROMPT", expectedAnswer: "MUTATED ANSWER" } });
  const packet = generated.packets[0];
  const pdf = await renderAssessmentPaperPacket({ actor: ACTOR, packetId: packet.packetId, mode: "download", idempotencyKey: "packet-download-001" });
  const loaded = await PDFDocument.load(pdf.bytes);
  assert.equal(loaded.getPages().length, packet.pageManifest.length);
  const text = await extractPdfText(pdf.bytes);
  assert.match(text, /Immutable snapshot prompt/);
  assert.doesNotMatch(text, /CONFIDENTIAL ANSWER|CONFIDENTIAL GUIDE|CONFIDENTIAL EXPLANATION|MUTATED SOURCE PROMPT|MUTATED ANSWER/);
  assert.match(text, new RegExp(packet.pageManifest[0].fallbackCode));
  assert.equal((await AuditEvent.countDocuments({ actionCode: "assessment.paper_packet.downloaded" })), 1);
  await renderAssessmentPaperPacket({ actor: ACTOR, packetId: packet.packetId, mode: "reprint", idempotencyKey: "packet-reprint-001" });
  assert.equal((await AuditEvent.countDocuments({ actionCode: "assessment.paper_packet.reprinted" })), 1);
});

test("voiding is audited and prevents later PDF access", async () => {
  const generated = await generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 1, idempotencyKey: "packet-void-001" });
  const packet = generated.packets[0];
  const voided = await voidAssessmentPaperPacket({ actor: ACTOR, packetId: packet.packetId, reason: "Printer jam", idempotencyKey: "packet-void-action-001" });
  assert.equal(voided.packet.status, "voided");
  await assert.rejects(() => renderAssessmentPaperPacket({ actor: ACTOR, packetId: packet.packetId, mode: "reprint", idempotencyKey: "packet-void-reprint-001" }), (error: unknown) => error instanceof AssessmentPaperPacketError && error.status === 409);
  assert.equal(await AuditEvent.countDocuments({ actionCode: "assessment.paper_packet.voided" }), 1);
});

test("rejects unauthorized, cross-school, draft, and attachment-bearing packet generation", async () => {
  await assert.rejects(() => generatePaperPacketBatch({ actor: actor(SCHOOL_A, false), assessmentDeliveryVersionId: deliveryId, quantity: 1, idempotencyKey: "packet-denied-001" }), (error: unknown) => error instanceof AssessmentPaperPacketError && error.status === 403);
  await assert.rejects(() => generatePaperPacketBatch({ actor: actor(SCHOOL_B), assessmentDeliveryVersionId: deliveryId, quantity: 1, idempotencyKey: "packet-cross-001" }), (error: unknown) => error instanceof AssessmentPaperPacketError && error.status === 404);
  const draft = await fixture({ schoolId: SCHOOL_B, deliveryStatus: "draft" });
  await assert.rejects(() => generatePaperPacketBatch({ actor: actor(SCHOOL_B), assessmentDeliveryVersionId: draft.delivery._id, quantity: 1, idempotencyKey: "packet-draft-001" }), (error: unknown) => error instanceof AssessmentPaperPacketError && error.status === 409);
  await AssessmentDefinitionVersion.collection.updateOne({ _id: definitionId }, { $set: { resourceManifest: [{ resourceId: "r1", sourceQuestionId: oid(), sourceAttachmentId: "a1", type: "image", sourceUrl: "https://private.invalid/r1", uploadKey: null, fileName: "diagram.png", mimeType: "image/png", visibility: "private", integrityAlgorithm: "sha256", integrityDigest: null, integrityStatus: "unverified" }] } });
  await assert.rejects(() => generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 1, idempotencyKey: "packet-resource-001" }), (error: unknown) => error instanceof AssessmentPaperPacketError && error.status === 409);
});

test("serialized packet details omit QR routing payloads", async () => {
  const generated = await generatePaperPacketBatch({ actor: ACTOR, assessmentDeliveryVersionId: deliveryId, quantity: 1, idempotencyKey: "packet-serialize-001" });
  const serialized = serializeAssessmentPaperPacket(generated.packets[0]);
  assert.equal("qrPayload" in serialized.pageManifest[0], false);
  assert.equal("expectedAnswer" in serialized, false);
  assert.equal("markingGuide" in serialized, false);
});
