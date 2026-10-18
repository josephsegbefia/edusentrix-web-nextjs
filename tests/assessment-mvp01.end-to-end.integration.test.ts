import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { School } from "../src/models/School";
import { Subject } from "../src/models/Subject";
import { Grade } from "../src/models/Grade";
import { ClassGroup } from "../src/models/ClassGroup";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { ExamType } from "../src/models/ExamType";
import { ExamPaper } from "../src/models/ExamPaper";
import { ExamPaperSection } from "../src/models/ExamPaperSection";
import { ExamPaperReview } from "../src/models/ExamPaperReview";
import { ExamQuestion } from "../src/models/ExamQuestion";
import { User } from "../src/models/User";
import { UserMembership } from "../src/models/UserMembership";
import { Teacher } from "../src/models/Teacher";
import { Student } from "../src/models/Student";
import { AssessmentPlan } from "../src/models/AssessmentPlan";
import { AssessmentItem } from "../src/models/AssessmentItem";
import { AssessmentScore } from "../src/models/AssessmentScore";
import { ReportCardRun } from "../src/models/ReportCardRun";
import { StudentReportCard } from "../src/models/StudentReportCard";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "../src/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment } from "../src/models/AssessmentPaperPacketAssignment";
import { AssessmentEvidenceCaptureSession } from "../src/models/AssessmentEvidenceCaptureSession";
import { AssessmentEvidencePage } from "../src/models/AssessmentEvidencePage";
import { AssessmentEvidenceReceipt } from "../src/models/AssessmentEvidenceReceipt";
import { StoredAsset } from "../src/models/StoredAsset";
import { AssessmentMarkingAssignment } from "../src/models/AssessmentMarkingAssignment";
import { AssessmentMarkingEvaluation } from "../src/models/AssessmentMarkingEvaluation";
import { AssessmentMarkingRevision } from "../src/models/AssessmentMarkingRevision";
import { AssessmentMarkingReviewerAssignment } from "../src/models/AssessmentMarkingReviewerAssignment";
import { AssessmentApprovedMarkingOutcome } from "../src/models/AssessmentApprovedMarkingOutcome";
import { AssessmentScoreHandoffReceipt } from "../src/models/AssessmentScoreHandoffReceipt";
import { AuditEvent } from "../src/models/AuditEvent";
import { AuditStreamHead } from "../src/models/AuditStreamHead";
import { submitExamPaper, approveExamPaper } from "../src/lib/examinations/paper-lifecycle";
import { publishAssessmentDefinition } from "../src/lib/assess/assessment-definition-service";
import { createAssessmentDeliveryDraft, publishAssessmentDelivery, submitAssessmentDeliveryForReview } from "../src/lib/assess/assessment-delivery-service";
import { generatePaperPacketBatch, renderAssessmentPaperPacket } from "../src/lib/assess/assessment-paper-packet-service";
import { assignAssessmentPaperPacket } from "../src/lib/assess/assessment-paper-assignment-service";
import { completeEvidencePage, createEvidenceCaptureSession, reserveEvidencePage } from "../src/lib/assess/assessment-evidence-service";
import { assignMarkingReviewer, assignMarkingScript, getMarkerEvaluation, reviewMarkingEvaluation, saveMarkingDraft, submitMarkingEvaluation } from "../src/lib/assess/assessment-marking-service";
import { handoffApprovedMarkingOutcome } from "../src/lib/assess/assessment-score-handoff-service";
import { setR2PortForTests } from "../src/lib/storage/r2";
import { createMockR2Port } from "./storage/helpers/mock-r2";

const SCHOOL = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
const REVIEWER = new Types.ObjectId();
const MARKER = new Types.ObjectId();
const TEACHER_ID = new Types.ObjectId();
const PERIOD = new Types.ObjectId();
const GRADE = new Types.ObjectId();
const CLASS_GROUP = new Types.ObjectId();
const SUBJECT = new Types.ObjectId();
const EXAM_TYPE = new Types.ObjectId();
const EXAM_PAPER = new Types.ObjectId();
const SECTION = new Types.ObjectId();
const QUESTION_A = new Types.ObjectId();
const QUESTION_B = new Types.ObjectId();
const PLAN = new Types.ObjectId();
const ITEM = new Types.ObjectId();
const STUDENT = new Types.ObjectId();
const replSet = { current: null as MongoMemoryReplSet | null };
const r2 = createMockR2Port();

const adminActor = { userId: ADMIN, schoolId: SCHOOL, isAdmin: true, premiumPublicationEntitled: true };
const markerActor = { userId: MARKER, schoolId: SCHOOL, teacherId: TEACHER_ID, isAdmin: false, premiumPublicationEntitled: true };
const reviewerActor = { userId: REVIEWER, schoolId: SCHOOL, isAdmin: true, premiumPublicationEntitled: true };
const digest = (body: Buffer) => createHash("sha256").update(body).digest("hex");
const auditContext = (key: string, actorId = ADMIN) => ({ requestId: key, correlationId: key, idempotencyKey: key, actorType: "user" as const, actorId, actorRole: "school_admin", schoolId: SCHOOL, clientSurface: "mvp01-test" });

async function extractPdfText(bytes: Uint8Array) {
  const globalRef = globalThis as typeof globalThis & { DOMMatrix?: unknown; ImageData?: unknown; Path2D?: unknown };
  if (!globalRef.DOMMatrix) Object.defineProperty(globalThis, "DOMMatrix", { configurable: true, value: class { a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; m11 = 1; m12 = 0; m13 = 0; m14 = 1; m21 = 0; m22 = 1; m23 = 0; m24 = 0; m31 = 0; m32 = 0; m33 = 1; m34 = 0; m41 = 0; m42 = 0; m43 = 0; m44 = 1; is2D = true; isIdentity = true; multiply() { return this; } translate() { return this; } scale() { return this; } rotate() { return this; } inverse() { return this; } toFloat32Array() { return new Float32Array([1, 0, 0, 1, 0, 0]); } toFloat64Array() { return new Float64Array([1, 0, 0, 1, 0, 0]); } }});
  if (!globalRef.ImageData) Object.defineProperty(globalThis, "ImageData", { configurable: true, value: class { data: Uint8ClampedArray; width: number; height: number; constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; } } });
  if (!globalRef.Path2D) Object.defineProperty(globalThis, "Path2D", { configurable: true, value: class { closePath() {} moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} arc() {} arcTo() {} ellipse() {} rect() {} roundRect() {} addPath() {} } });
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try { return (await parser.getText()).text; } finally { await parser.destroy(); }
}

async function createIndexes() {
  await Promise.all([
    School.createIndexes(), Subject.createIndexes(), Grade.createIndexes(), ClassGroup.createIndexes(), AcademicPeriod.createIndexes(), ExamType.createIndexes(), ExamPaper.createIndexes(), ExamPaperSection.createIndexes(), ExamPaperReview.createIndexes(), ExamQuestion.createIndexes(), User.createIndexes(), UserMembership.createIndexes(), Teacher.createIndexes(), Student.createIndexes(), AssessmentPlan.createIndexes(), AssessmentItem.createIndexes(), AssessmentScore.createIndexes(), ReportCardRun.createIndexes(), StudentReportCard.createIndexes(), AssessmentDefinitionVersion.createIndexes(), AssessmentDeliveryVersion.createIndexes(), AssessmentPaperPacket.createIndexes(), AssessmentPaperPacketAssignment.createIndexes(), AssessmentEvidenceCaptureSession.createIndexes(), AssessmentEvidencePage.createIndexes(), AssessmentEvidenceReceipt.createIndexes(), StoredAsset.createIndexes(), AssessmentMarkingAssignment.createIndexes(), AssessmentMarkingEvaluation.createIndexes(), AssessmentMarkingRevision.createIndexes(), AssessmentMarkingReviewerAssignment.createIndexes(), AssessmentApprovedMarkingOutcome.createIndexes(), AssessmentScoreHandoffReceipt.createIndexes(), AuditEvent.createIndexes(), AuditStreamHead.createIndexes(),
  ]);
}

async function seedAuthoringAndCore() {
  await School.create({ _id: SCHOOL, name: "MVP Synthetic School", type: "Basic", curriculumCode: "ghana_nacca", status: "active" });
  await User.create([
    { _id: ADMIN, schoolId: SCHOOL, email: "mvp-admin@example.test", firstName: "MVP", lastName: "Admin", role: "school_admin" },
    { _id: REVIEWER, schoolId: SCHOOL, email: "mvp-reviewer@example.test", firstName: "MVP", lastName: "Reviewer", role: "school_admin" },
    { _id: MARKER, schoolId: SCHOOL, email: "mvp-marker@example.test", firstName: "MVP", lastName: "Marker", role: "teacher" },
  ]);
  await UserMembership.create([
    { userId: ADMIN, schoolId: SCHOOL, roles: ["school_admin"], status: "active" },
    { userId: REVIEWER, schoolId: SCHOOL, roles: ["school_admin"], status: "active" },
    { userId: MARKER, schoolId: SCHOOL, roles: ["teacher"], status: "active" },
  ]);
  await AcademicPeriod.create({ _id: PERIOD, schoolId: SCHOOL, yearLabel: "2026/27", term: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-20"), isCurrent: true });
  await Subject.create({ _id: SUBJECT, schoolId: SCHOOL, name: "Mathematics", normalizedKey: "mathematics", category: "core", isActive: true });
  await Grade.create({ _id: GRADE, schoolId: SCHOOL, name: "JHS 1", code: "JHS1", isActive: true });
  await ClassGroup.create({ _id: CLASS_GROUP, schoolId: SCHOOL, gradeId: GRADE, name: "A", subjectIds: [SUBJECT], subjectOfferingIds: [], isActive: true });
  await ExamType.create({ _id: EXAM_TYPE, schoolId: SCHOOL, name: "MVP End of Term", requiresApproval: true, appearsOnReportCard: false, contributesToFinalGrade: false, canBePrinted: true, allowCandidateNumbers: true, allowAnswerSheet: false, status: "active" });
  await Teacher.create({ _id: TEACHER_ID, schoolId: SCHOOL, userId: MARKER, subjectIds: [SUBJECT], subjectOfferingIds: [], homeroomClassGroupId: CLASS_GROUP, status: "active" });
  await Student.create({ _id: STUDENT, schoolId: SCHOOL, firstName: "Synthetic", lastName: "Candidate", admissionNo: "MVP-001", gradeId: GRADE, classGroupId: CLASS_GROUP, status: "active", enrolledAt: new Date("2026-09-01") });
  await AssessmentPlan.create({ _id: PLAN, schoolId: SCHOOL, name: "MVP Term Plan", academicPeriodId: PERIOD, gradingPolicyId: new Types.ObjectId(), appliesToGradeId: GRADE, appliesToGradeIds: [GRADE], appliesToClassGroupIds: [CLASS_GROUP], status: "active", componentRules: [], teacherCanCreateReportItems: true, teacherCanMarkItemsAsReportContributing: true, allowOfflineMarks: true, allowAppAssignmentImport: true, allowCsvImport: false, minimumCompletionRules: [], createdBy: ADMIN });
  await AssessmentItem.create({ _id: ITEM, schoolId: SCHOOL, academicPeriodId: PERIOD, assessmentPlanId: PLAN, classGroupId: CLASS_GROUP, gradeId: GRADE, subjectId: SUBJECT, teacherId: TEACHER_ID, title: "MVP Paper Examination", assessmentType: "exam", sourceType: "manual", maxScore: 8, contributesToReport: true, contributionLockedByRule: true, missingPolicy: "block_submission", visibility: "teacher_only", status: "open", createdBy: ADMIN, updatedBy: ADMIN });
  await ExamPaper.create({ _id: EXAM_PAPER, schoolId: SCHOOL, title: "MVP Mathematics Paper", examTypeId: EXAM_TYPE, academicYearId: PERIOD, academicPeriodId: PERIOD, scope: "class_group", gradeId: GRADE, classGroupId: CLASS_GROUP, classGroupIds: [CLASS_GROUP], subjectId: SUBJECT, contributorIds: [], createdBy: ADMIN, ownerRole: "admin", durationMinutes: 60, totalMarks: 8, instructions: "Show your working.", candidateInstructions: "Answer all questions.", status: "draft", sourceMode: "manual" });
  await ExamPaperSection.create({ _id: SECTION, schoolId: SCHOOL, examPaperId: EXAM_PAPER, title: "Section A", instructions: "Answer both questions.", order: 0, marks: 8 });
  await ExamQuestion.create([
    { _id: QUESTION_A, schoolId: SCHOOL, examPaperId: EXAM_PAPER, sectionId: SECTION, type: "short_answer", prompt: "What is 2 + 2?", plainTextPrompt: "What is 2 + 2?", options: [], subQuestions: [], marks: 5, difficulty: "easy", curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "4", markingGuide: "Award five marks for the correct result.", attachments: [], order: 0, createdBy: ADMIN, teacherId: TEACHER_ID, source: "manual" },
    { _id: QUESTION_B, schoolId: SCHOOL, examPaperId: EXAM_PAPER, sectionId: SECTION, type: "short_answer", prompt: "What is 3 + 3?", plainTextPrompt: "What is 3 + 3?", options: [], subQuestions: [], marks: 3, difficulty: "easy", curriculumNodeIds: [], schemeItemIds: [], lessonIds: [], lessonNoteIds: [], expectedAnswer: "6", markingGuide: "Award three marks for the correct result.", attachments: [], order: 1, createdBy: ADMIN, teacherId: TEACHER_ID, source: "manual" },
  ]);
}

before(async () => {
  replSet.current = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  const uri = replSet.current.getUri();
  await mongoose.connect(uri, { dbName: "assessment_mvp01_e2e" });
  setR2PortForTests(r2);
  await createIndexes();
});

after(async () => {
  setR2PortForTests(null);
  await mongoose.disconnect();
  await replSet.current?.stop();
});

test("runs the synthetic paper assessment workflow from Core authoring to guarded score handoff", async () => {
  await seedAuthoringAndCore();

  const submitted = await submitExamPaper({ schoolId: SCHOOL, examPaperId: EXAM_PAPER, userId: ADMIN });
  assert.equal("paper" in submitted, true);
  const approvedPaper = await approveExamPaper({ schoolId: SCHOOL, examPaperId: EXAM_PAPER, userId: REVIEWER, comment: "Synthetic independent source review" });
  assert.equal("paper" in approvedPaper, true);

  const definitionResult = await publishAssessmentDefinition({ examPaperId: EXAM_PAPER, actor: adminActor, resultBinding: "score_bearing", assessmentPlanId: PLAN, assessmentItemId: ITEM });
  const definition = definitionResult.definition;
  assert.equal(definition.resultBinding, "score_bearing");
  assert.equal(definition.scoring.maximumMarks, 8);
  assert.equal(definition.sections[0]?.questions.length, 2);
  assert.equal(definition.resourceManifest.length, 0);

  const draftResult = await createAssessmentDeliveryDraft({ assessmentDefinitionVersionId: definition._id, actor: adminActor, title: "MVP Paper Delivery", durationMinutes: 60, resultBinding: "score_bearing", assessmentPlanId: PLAN, assessmentItemId: ITEM, schedule: { scheduledDate: new Date("2026-11-10"), roomLabel: "Room A" } });
  const reviewed = await submitAssessmentDeliveryForReview({ deliveryId: draftResult.delivery._id, actor: adminActor });
  assert.equal(reviewed.status, "review");
  const publishedDeliveryResult = await publishAssessmentDelivery({ deliveryId: draftResult.delivery._id, actor: adminActor });
  const delivery = publishedDeliveryResult.delivery;
  assert.equal(delivery.status, "published");
  assert.equal(delivery.assessmentPlanId?.toString(), PLAN.toString());
  assert.equal(delivery.assessmentItemId?.toString(), ITEM.toString());

  const packetBatch = await generatePaperPacketBatch({ actor: adminActor, assessmentDeliveryVersionId: delivery._id, quantity: 1, idempotencyKey: "mvp01-packet-generation-001", auditContext: auditContext("mvp01-packet-generation-001") });
  const packet = packetBatch.packets[0];
  assert.ok(packet);
  assert.equal(packet.pageManifest.length, packet.pageManifest[0]?.expectedPageCount);
  const rendered = await renderAssessmentPaperPacket({ actor: adminActor, packetId: packet.packetId, mode: "download", idempotencyKey: "mvp01-packet-download-001", auditContext: auditContext("mvp01-packet-download-001") });
  const pdf = await PDFDocument.load(rendered.bytes);
  assert.equal(pdf.getPages().length, packet.pageManifest.length);
  const pdfText = await extractPdfText(rendered.bytes);
  assert.match(pdfText, /What is 2 \+ 2/);
  assert.doesNotMatch(pdfText, /Award five marks|Award three marks/);

  const assignmentResult = await assignAssessmentPaperPacket({ actor: adminActor, assessmentPaperPacketId: packet._id, studentId: STUDENT, idempotencyKey: "mvp01-candidate-assignment-001", auditContext: auditContext("mvp01-candidate-assignment-001") });
  const packetAssignmentId = new Types.ObjectId(assignmentResult.assignment.id);

  const capture = await createEvidenceCaptureSession({ actor: adminActor, assessmentDeliveryVersionId: delivery._id, deviceSessionId: "mvp01-synthetic-device-001", idempotencyKey: "mvp01-capture-session-001", auditContext: auditContext("mvp01-capture-session-001") });
  for (const manifestPage of packet.pageManifest) {
    const body = Buffer.from(`synthetic evidence bytes for ${manifestPage.pageId}`);
    const reservation = await reserveEvidencePage({ actor: adminActor, sessionId: new Types.ObjectId(capture.session.id), packetId: packet.packetId, pageId: manifestPage.pageId, fileName: `${manifestPage.pageId}.jpg`, mimeType: "image/jpeg", clientUploadId: `mvp01-upload-${manifestPage.pageId}`, expectedDigest: digest(body), captureOrder: manifestPage.pageNumber, auditContext: auditContext(`mvp01-reserve-${manifestPage.pageId}`) });
    const asset = await StoredAsset.findById(reservation.upload?.assetId).lean();
    assert.ok(asset);
    await r2.putObject({ key: asset.storageKey, body, contentType: "image/jpeg" });
    const completed = await completeEvidencePage({ actor: adminActor, pageId: new Types.ObjectId(reservation.page.id), clientDigest: digest(body), auditContext: auditContext(`mvp01-complete-${manifestPage.pageId}`) });
    assert.equal(completed.page.status, "verified");
    assert.equal(completed.page.reconciliationOutcome, "valid");
  }
  assert.equal(await AssessmentEvidenceReceipt.countDocuments({ schoolId: SCHOOL }), packet.pageManifest.length);

  const markingAssignmentResult = await assignMarkingScript({ actor: adminActor, packetAssignmentId, markerUserId: MARKER, blindMarking: true, idempotencyKey: "mvp01-marking-assignment-001", auditContext: auditContext("mvp01-marking-assignment-001") });
  const markingAssignmentId = new Types.ObjectId(markingAssignmentResult.assignment.id);
  const markerView = await getMarkerEvaluation({ actor: markerActor, markingAssignmentId });
  assert.equal(markerView.questions.length, 2);
  const draft = await saveMarkingDraft({ actor: markerActor, markingAssignmentId, expectedDraftVersion: 0, questionScores: markerView.questions.map((question) => ({ questionId: question.id, score: question.maximumMarks })), auditContext: auditContext("mvp01-marking-draft-001", MARKER) });
  assert.equal(draft.evaluation.totalMarks, 8);
  const submittedMarking = await submitMarkingEvaluation({ actor: markerActor, markingAssignmentId, idempotencyKey: "mvp01-marking-submit-001", auditContext: auditContext("mvp01-marking-submit-001", MARKER) });
  const reviewerAssignment = await assignMarkingReviewer({ actor: adminActor, markingAssignmentId, reviewerUserId: REVIEWER, idempotencyKey: "mvp01-reviewer-assignment-001", auditContext: auditContext("mvp01-reviewer-assignment-001") });
  assert.ok(reviewerAssignment.reviewerAssignment.id);
  const approved = await reviewMarkingEvaluation({ actor: reviewerActor, markingEvaluationId: submittedMarking.evaluation._id, decision: "approve", reason: "Independent synthetic moderation complete", idempotencyKey: "mvp01-moderation-approve-001", auditContext: auditContext("mvp01-moderation-approve-001", REVIEWER) });
  assert.ok(approved.approvedOutcome);

  const handoff = await handoffApprovedMarkingOutcome({ actor: adminActor, approvedOutcomeId: new Types.ObjectId(approved.approvedOutcome!.id), requestIdempotencyKey: "mvp01-score-handoff-001", auditContext: auditContext("mvp01-score-handoff-001") });
  assert.equal(handoff.replayed, false);
  assert.equal(handoff.receipt.appliedScore, 8);
  const replay = await handoffApprovedMarkingOutcome({ actor: adminActor, approvedOutcomeId: new Types.ObjectId(approved.approvedOutcome!.id), requestIdempotencyKey: "mvp01-score-handoff-retry-001", auditContext: auditContext("mvp01-score-handoff-retry-001") });
  assert.equal(replay.replayed, true);

  assert.equal(await AssessmentScore.countDocuments({ schoolId: SCHOOL, assessmentItemId: ITEM, studentId: STUDENT }), 1);
  assert.equal(await AssessmentScoreHandoffReceipt.countDocuments({ schoolId: SCHOOL, status: "completed" }), 1);
  assert.equal(await AssessmentMarkingRevision.countDocuments({ schoolId: SCHOOL, kind: "approved" }), 1);
  assert.equal(await AssessmentApprovedMarkingOutcome.countDocuments({ schoolId: SCHOOL, status: "current" }), 1);
  assert.equal(await AssessmentPaperPacketAssignment.countDocuments({ schoolId: SCHOOL, studentId: STUDENT, status: "active" }), 1);
  assert.equal(await ReportCardRun.countDocuments({ schoolId: SCHOOL }), 0);
  assert.equal(await StudentReportCard.countDocuments({ schoolId: SCHOOL }), 0);
  assert.ok(await AuditEvent.countDocuments({ actionCode: "assessment.score_handoff.completed" }));
});
