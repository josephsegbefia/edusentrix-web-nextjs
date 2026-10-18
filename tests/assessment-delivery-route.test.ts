import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { stubAssessmentRouteDeps, setAssessmentRouteActiveSchool, setAssessmentRoutePremiumDecision } from "./assessment-route/helpers/stub-assessment-route-deps";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";
import { ExamPaper } from "../src/models/ExamPaper";
import { ExamPaperSection } from "../src/models/ExamPaperSection";
import { ExamQuestion } from "../src/models/ExamQuestion";
import { publishAssessmentDefinition } from "../src/lib/assess/assessment-definition-service";

stubAssessmentRouteDeps();

const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
let replSet: MongoMemoryReplSet;
let postRoute: (request: Request) => Promise<Response>;
let getRoute: (request: Request) => Promise<Response>;
let reviewRoute: (request: Request, context: { params: Promise<{ deliveryId: string }> }) => Promise<Response>;
let publishRoute: (request: Request, context: { params: Promise<{ deliveryId: string }> }) => Promise<Response>;

const oid = () => new Types.ObjectId();

async function createPublishedDefinition(schoolId = SCHOOL_A) {
  const academicPeriodId = oid();
  const paper = await ExamPaper.create({
    schoolId,
    title: "Delivery route mathematics",
    examTypeId: oid(),
    academicYearId: academicPeriodId,
    academicPeriodId,
    scope: "class_group",
    gradeId: oid(),
    classGroupIds: [oid()],
    subjectId: oid(),
    contributorIds: [],
    createdBy: ADMIN,
    ownerRole: "admin",
    totalMarks: 5,
    durationMinutes: 60,
    status: "approved",
    approvedAt: new Date(),
    approvedBy: ADMIN,
  });
  const section = await ExamPaperSection.create({ schoolId, examPaperId: paper._id, title: "Section A", order: 0, marks: 5 });
  await ExamQuestion.create({
    schoolId,
    examPaperId: paper._id,
    sectionId: section._id,
    type: "short_answer",
    prompt: "Route delivery question",
    plainTextPrompt: "Route delivery question",
    marks: 5,
    difficulty: "easy",
    options: [],
    subQuestions: [],
    curriculumNodeIds: [],
    schemeItemIds: [],
    lessonIds: [],
    lessonNoteIds: [],
    expectedAnswer: "answer",
    markingGuide: "Award five marks.",
    attachments: [],
    order: 0,
    createdBy: ADMIN,
    source: "manual",
  });
  const result = await publishAssessmentDefinition({
    examPaperId: paper._id,
    actor: { userId: ADMIN, schoolId, isAdmin: true, premiumPublicationEntitled: true },
    resultBinding: "none",
  });
  return result.definition;
}

function signedIn(schoolId = SCHOOL_A, roles = ["school_admin"]) {
  setAssessmentRouteActiveSchool({ ok: true, context: { userId: ADMIN, schoolId, roles } });
}

function request(body: unknown, method = "POST") {
  return new Request("http://localhost/api/admin/assess/deliveries", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

function context(deliveryId: Types.ObjectId) {
  return { params: Promise.resolve({ deliveryId: String(deliveryId) }) };
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGO_DB_NAME = "assessment_delivery_route";
  await mongoose.connect(replSet.getUri(), { dbName: "assessment_delivery_route" });
  await Promise.all([
    AssessmentDefinitionVersion.createIndexes(),
    AssessmentDeliveryVersion.createIndexes(),
    ExamPaper.createIndexes(),
    ExamPaperSection.createIndexes(),
    ExamQuestion.createIndexes(),
  ]);
  ({ POST: postRoute, GET: getRoute } = await import("../src/app/api/admin/assess/deliveries/route"));
  ({ POST: reviewRoute } = await import("../src/app/api/admin/assess/deliveries/[deliveryId]/review/route"));
  ({ POST: publishRoute } = await import("../src/app/api/admin/assess/deliveries/[deliveryId]/publish/route"));
});

beforeEach(async () => {
  await Promise.all([AssessmentDeliveryVersion.deleteMany({}), AssessmentDefinitionVersion.deleteMany({}), ExamQuestion.deleteMany({}), ExamPaperSection.deleteMany({}), ExamPaper.deleteMany({})]);
  setAssessmentRouteActiveSchool(undefined);
  setAssessmentRoutePremiumDecision({ allowed: true });
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test("delivery routes enforce identity, role and Premium entitlement", async () => {
  const unauthenticated = await postRoute(request({}));
  assert.equal(unauthenticated.status, 401);
  signedIn(SCHOOL_A, ["teacher"]);
  assert.equal((await postRoute(request({}))).status, 401);
  signedIn();
  setAssessmentRoutePremiumDecision({ allowed: false, reason: "Premium denied", statusCode: 403 });
  assert.equal((await postRoute(request({}))).status, 403);
});

test("authorized admin can create, review, publish and list a delivery without answer-key content", async () => {
  const definition = await createPublishedDefinition();
  signedIn();
  const created = await postRoute(request({
    assessmentDefinitionVersionId: String(definition._id),
    title: "Route paper delivery",
    durationMinutes: 60,
    resultBinding: "none",
  }));
  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as { data: { id: string } };
  const deliveryId = new Types.ObjectId(createdBody.data.id);
  const reviewed = await reviewRoute(request({}, "POST"), context(deliveryId));
  assert.equal(reviewed.status, 200);
  const published = await publishRoute(request({ expectedCurrentVersionId: null }, "POST"), context(deliveryId));
  assert.equal(published.status, 201);
  const publishedBody = (await published.json()) as { data: Record<string, unknown> };
  assert.equal("sections" in publishedBody.data, false);
  assert.equal("expectedAnswer" in publishedBody.data, false);
  const listed = await getRoute(request({}, "GET"));
  assert.equal(listed.status, 200);
  const listBody = (await listed.json()) as { data: { definitions: unknown[]; deliveries: unknown[] } };
  assert.equal(listBody.data.definitions.length, 1);
  assert.equal(listBody.data.deliveries.length, 1);
});

test("school scope prevents another school from reading the delivery", async () => {
  const definition = await createPublishedDefinition();
  signedIn();
  await postRoute(request({ assessmentDefinitionVersionId: String(definition._id), title: "Scoped delivery", durationMinutes: 60, resultBinding: "none" }));
  signedIn(SCHOOL_B);
  const response = await getRoute(request({}, "GET"));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { definitions: unknown[]; deliveries: unknown[] } };
  assert.equal(body.data.definitions.length, 0);
  assert.equal(body.data.deliveries.length, 0);
});
