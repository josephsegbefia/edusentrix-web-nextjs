import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { AssessmentItem } from "../src/models/AssessmentItem";
import { AssessmentPlan } from "../src/models/AssessmentPlan";
import { ExamPaper } from "../src/models/ExamPaper";
import { ExamPaperSection } from "../src/models/ExamPaperSection";
import { ExamQuestion } from "../src/models/ExamQuestion";
import {
  publishAssessmentDefinition,
} from "../src/lib/assess/assessment-definition-service";
import {
  AssessmentDeliveryError,
  createAssessmentDeliveryDraft,
  getAssessmentDelivery,
  publishAssessmentDelivery,
  serializeAssessmentDelivery,
  submitAssessmentDeliveryForReview,
} from "../src/lib/assess/assessment-delivery-service";

let replSet: MongoMemoryReplSet;
const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN = new Types.ObjectId();

const oid = () => new Types.ObjectId();

function actor(schoolId = SCHOOL_A, overrides: Partial<{ isAdmin: boolean; premiumPublicationEntitled: boolean }> = {}) {
  return {
    userId: ADMIN,
    schoolId,
    isAdmin: true,
    premiumPublicationEntitled: true,
    ...overrides,
  };
}

async function createSourcePaper(prompt = "What is 2 + 2?", schoolId = SCHOOL_A) {
  const academicPeriodId = oid();
  const gradeId = oid();
  const classGroupId = oid();
  const subjectId = oid();
  const paper = await ExamPaper.create({
    schoolId,
    title: "Delivery Mathematics",
    examTypeId: oid(),
    academicYearId: academicPeriodId,
    academicPeriodId,
    scope: "class_group",
    gradeId,
    classGroupIds: [classGroupId],
    subjectId,
    contributorIds: [],
    createdBy: ADMIN,
    ownerRole: "admin",
    totalMarks: 10,
    durationMinutes: 90,
    status: "approved",
    approvedAt: new Date("2026-10-15T09:00:00.000Z"),
    approvedBy: ADMIN,
  });
  const section = await ExamPaperSection.create({
    schoolId,
    examPaperId: paper._id,
    title: "Section A",
    order: 0,
    marks: 10,
  });
  await ExamQuestion.create({
    schoolId,
    examPaperId: paper._id,
    sectionId: section._id,
    type: "short_answer",
    prompt,
    plainTextPrompt: prompt,
    marks: 10,
    difficulty: "easy",
    options: [],
    subQuestions: [],
    curriculumNodeIds: [],
    schemeItemIds: [],
    lessonIds: [],
    lessonNoteIds: [],
    expectedAnswer: "4",
    markingGuide: "Award 10 marks.",
    attachments: [],
    order: 0,
    createdBy: ADMIN,
    source: "manual",
  });
  return { paper, academicPeriodId, gradeId, classGroupId, subjectId };
}

async function publishDefinition(source: Awaited<ReturnType<typeof createSourcePaper>>, schoolId = SCHOOL_A) {
  const result = await publishAssessmentDefinition({
    examPaperId: source.paper._id,
    actor: { userId: ADMIN, schoolId, isAdmin: true, premiumPublicationEntitled: true },
    resultBinding: "none",
  });
  return result.definition;
}

async function createDraft(definitionId: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return createAssessmentDeliveryDraft({
    assessmentDefinitionVersionId: definitionId,
    actor: actor(),
    title: "Paper delivery configuration",
    durationMinutes: 90,
    resultBinding: "none",
    ...overrides,
  });
}

async function reviewAndPublish(deliveryId: Types.ObjectId, expectedCurrentVersionId: Types.ObjectId | null = null) {
  await submitAssessmentDeliveryForReview({ deliveryId, actor: actor() });
  return publishAssessmentDelivery({
    deliveryId,
    actor: actor(),
    expectedCurrentVersionId,
  });
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  await mongoose.connect(replSet.getUri(), { dbName: "assessment_delivery_foundation" });
  await Promise.all([
    AssessmentDefinitionVersion.createIndexes(),
    AssessmentDeliveryVersion.createIndexes(),
    ExamPaper.createIndexes(),
    ExamPaperSection.createIndexes(),
    ExamQuestion.createIndexes(),
    AssessmentPlan.createIndexes(),
    AssessmentItem.createIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    AssessmentDeliveryVersion.deleteMany({}),
    AssessmentDefinitionVersion.deleteMany({}),
    ExamQuestion.deleteMany({}),
    ExamPaperSection.deleteMany({}),
    ExamPaper.deleteMany({}),
    AssessmentPlan.deleteMany({}),
    AssessmentItem.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test("creates and publishes a paper delivery from a published definition", async () => {
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  const draft = await createDraft(definition._id, {
    schedule: { scheduledDate: "2026-11-03T09:00:00.000Z", startTime: "09:00", endTime: "10:30" },
    accessibilityPolicy: { extraTimeMinutes: 15, largePrint: true },
  });
  assert.equal(draft.delivery.status, "draft");
  assert.equal(draft.delivery.mode, "paper");
  assert.equal(draft.delivery.timing.durationMinutes, 90);
  assert.equal(draft.delivery.accessibilityPolicy.extraTimeMinutes, 15);
  const published = await reviewAndPublish(draft.delivery._id);
  assert.equal(published.delivery.status, "published");
  assert.equal(published.delivery.assessmentDefinitionVersionId.toString(), definition._id.toString());
  assert.equal(published.delivery.supersedesVersionId, null);
  const loaded = await getAssessmentDelivery({ schoolId: SCHOOL_A, deliveryId: draft.delivery._id });
  assert.equal(loaded?.status, "published");
});

test("rejects missing, unpublished and cross-school definitions", async () => {
  await assert.rejects(
    () => createDraft(oid()),
    (error: unknown) => error instanceof AssessmentDeliveryError && error.status === 404
  );
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  await AssessmentDefinitionVersion.updateOne({ _id: definition._id }, { $set: { status: "superseded" } });
  await assert.rejects(() => createDraft(definition._id), /published assessment definition not found/i);
  const otherSource = await createSourcePaper("School B", SCHOOL_B);
  const otherDefinition = await publishDefinition(otherSource, SCHOOL_B);
  await assert.rejects(
    () => createDraft(otherDefinition._id),
    /published assessment definition not found/i
  );
});

test("preserves non-reporting binding and rejects a mismatched score-bearing delivery", async () => {
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  await assert.rejects(
    () => createDraft(definition._id, { resultBinding: "score_bearing" }),
    /must match the published assessment definition/i
  );
  const delivery = await createDraft(definition._id);
  assert.equal(delivery.delivery.resultBinding, "none");
  assert.equal(delivery.delivery.assessmentPlanId, null);
  assert.equal(delivery.delivery.assessmentItemId, null);
});

test("requires and preserves the existing canonical binding for score-bearing delivery", async () => {
  const source = await createSourcePaper();
  const plan = await AssessmentPlan.create({
    schoolId: SCHOOL_A,
    name: "Delivery plan",
    academicPeriodId: source.academicPeriodId,
    gradingPolicyId: oid(),
    appliesToGradeId: source.gradeId,
    appliesToGradeIds: [source.gradeId],
    appliesToClassGroupIds: [source.classGroupId],
    status: "active",
  });
  const item = await AssessmentItem.create({
    schoolId: SCHOOL_A,
    academicPeriodId: source.academicPeriodId,
    assessmentPlanId: plan._id,
    classGroupId: source.classGroupId,
    gradeId: source.gradeId,
    subjectId: source.subjectId,
    teacherId: oid(),
    title: "Delivery examination item",
    assessmentType: "exam",
    sourceType: "exam",
    maxScore: 10,
    contributesToReport: true,
    contributionLockedByRule: false,
    visibility: "teacher_only",
    status: "open",
  });
  const definition = (await publishAssessmentDefinition({
    examPaperId: source.paper._id,
    actor: { userId: ADMIN, schoolId: SCHOOL_A, isAdmin: true, premiumPublicationEntitled: true },
    resultBinding: "score_bearing",
    assessmentPlanId: plan._id,
    assessmentItemId: item._id,
  })).definition;
  await assert.rejects(
    () => createDraft(definition._id, { resultBinding: "score_bearing" }),
    /requires assessmentPlanId and assessmentItemId/i
  );
  const delivery = await createDraft(definition._id, {
    resultBinding: "score_bearing",
    assessmentPlanId: plan._id,
    assessmentItemId: item._id,
  });
  assert.equal(delivery.delivery.resultBinding, "score_bearing");
  assert.equal(delivery.delivery.assessmentItemId?.toString(), item._id.toString());
});

test("fails closed for an unauthorized actor or missing Premium entitlement", async () => {
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  await assert.rejects(
    () => createDraft(definition._id, { actor: actor(SCHOOL_A, { isAdmin: false }) }),
    /school administrators/i
  );
  await assert.rejects(
    () => createDraft(definition._id, { actor: actor(SCHOOL_A, { premiumPublicationEntitled: false }) }),
    /Premium Assess publication entitlement/i
  );
});

test("requires review before publication and rejects stale current-version acknowledgement", async () => {
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  const draft = await createDraft(definition._id);
  await assert.rejects(
    () => publishAssessmentDelivery({ deliveryId: draft.delivery._id, actor: actor(), expectedCurrentVersionId: null }),
    /reviewed delivery configurations/i
  );
  await submitAssessmentDeliveryForReview({ deliveryId: draft.delivery._id, actor: actor() });
  await assert.rejects(
    () => publishAssessmentDelivery({ deliveryId: draft.delivery._id, actor: actor(), expectedCurrentVersionId: oid() }),
    /current delivery changed/i
  );
});

test("publishes corrected versions atomically and keeps historical content immutable", async () => {
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  const firstDraft = await createDraft(definition._id, { title: "Initial paper delivery" });
  const first = await reviewAndPublish(firstDraft.delivery._id);
  const secondDraft = await createDraft(definition._id, { title: "Corrected paper delivery" });
  await submitAssessmentDeliveryForReview({ deliveryId: secondDraft.delivery._id, actor: actor() });
  const second = await publishAssessmentDelivery({
    deliveryId: secondDraft.delivery._id,
    actor: actor(),
    expectedCurrentVersionId: first.delivery._id,
  });
  assert.equal(second.delivery.version, 2);
  assert.equal(second.delivery.supersedesVersionId?.toString(), first.delivery._id.toString());
  assert.equal((await getAssessmentDelivery({ schoolId: SCHOOL_A, deliveryId: first.delivery._id }))?.status, "superseded");
  const old = await AssessmentDeliveryVersion.findById(first.delivery._id);
  assert.ok(old);
  old.title = "Tampered published title";
  await assert.rejects(() => old.save(), /immutable/);
});

test("rolls back target publication when predecessor supersession fails", async () => {
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  const firstDraft = await createDraft(definition._id, { title: "Initial" });
  const first = await reviewAndPublish(firstDraft.delivery._id);
  const secondDraft = await createDraft(definition._id, { title: "Corrected" });
  await submitAssessmentDeliveryForReview({ deliveryId: secondDraft.delivery._id, actor: actor() });
  const model = AssessmentDeliveryVersion as unknown as Record<string, unknown>;
  const original = model.updateOne;
  model.updateOne = async () => { throw new Error("injected delivery supersession failure"); };
  try {
    await assert.rejects(
      () => publishAssessmentDelivery({ deliveryId: secondDraft.delivery._id, actor: actor(), expectedCurrentVersionId: first.delivery._id }),
      /injected delivery supersession failure/
    );
  } finally {
    model.updateOne = original;
  }
  assert.equal((await getAssessmentDelivery({ schoolId: SCHOOL_A, deliveryId: first.delivery._id }))?.status, "published");
  assert.equal((await getAssessmentDelivery({ schoolId: SCHOOL_A, deliveryId: secondDraft.delivery._id }))?.status, "review");
});

test("concurrent publication of one reviewed draft is idempotent", async () => {
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  const firstDraft = await createDraft(definition._id, { title: "Initial" });
  const first = await reviewAndPublish(firstDraft.delivery._id);
  const corrected = await createDraft(definition._id, { title: "Corrected" });
  await submitAssessmentDeliveryForReview({ deliveryId: corrected.delivery._id, actor: actor() });
  const results = await Promise.all([
    publishAssessmentDelivery({ deliveryId: corrected.delivery._id, actor: actor(), expectedCurrentVersionId: first.delivery._id }),
    publishAssessmentDelivery({ deliveryId: corrected.delivery._id, actor: actor(), expectedCurrentVersionId: first.delivery._id }),
  ]);
  assert.deepEqual(new Set(results.map((result) => String(result.delivery._id))).size, 1);
  assert.equal((await AssessmentDeliveryVersion.find({ deliveryKey: corrected.delivery.deliveryKey })).filter((row) => row.status === "published").length, 1);
});

test("administrator projections do not include definition questions or answer keys", async () => {
  const source = await createSourcePaper();
  const definition = await publishDefinition(source);
  const draft = await createDraft(definition._id);
  const projection = serializeAssessmentDelivery(draft.delivery);
  assert.equal("sections" in projection, false);
  assert.equal("expectedAnswer" in projection, false);
  assert.equal("markingGuide" in projection, false);
  assert.equal(projection.reviewPolicy.answerKeyAccess, "school_admin_only");
});
