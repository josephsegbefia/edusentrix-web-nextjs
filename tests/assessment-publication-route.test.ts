import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { stubAssessmentRouteDeps, setAssessmentRouteActiveSchool, setAssessmentRoutePremiumDecision } from "./assessment-route/helpers/stub-assessment-route-deps";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { ExamPaper } from "../src/models/ExamPaper";
import { ExamPaperSection } from "../src/models/ExamPaperSection";
import { ExamQuestion } from "../src/models/ExamQuestion";

stubAssessmentRouteDeps();

const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
let mongod: MongoMemoryReplSet;
let postRoute: (request: Request) => Promise<Response>;

function objectId() {
  return new Types.ObjectId();
}

async function createSourcePaper(schoolId = SCHOOL_A) {
  const academicPeriodId = objectId();
  const gradeId = objectId();
  const subjectId = objectId();
  const classGroupId = objectId();
  const paper = await ExamPaper.create({
    schoolId,
    title: "Route Test Mathematics",
    examTypeId: objectId(),
    academicYearId: academicPeriodId,
    academicPeriodId,
    scope: "class_group",
    gradeId,
    classGroupIds: [classGroupId],
    subjectId,
    contributorIds: [],
    createdBy: ADMIN,
    ownerRole: "admin",
    totalMarks: 5,
    status: "approved",
    approvedAt: new Date("2026-10-15T09:00:00.000Z"),
    approvedBy: ADMIN,
  });
  const section = await ExamPaperSection.create({
    schoolId,
    examPaperId: paper._id,
    title: "Section A",
    order: 0,
    marks: 5,
  });
  await ExamQuestion.create({
    schoolId,
    examPaperId: paper._id,
    sectionId: section._id,
    type: "short_answer",
    prompt: "Route test question",
    plainTextPrompt: "Route test question",
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
  return paper;
}

function signedIn(schoolId = SCHOOL_A, roles = ["school_admin"]) {
  setAssessmentRouteActiveSchool({
    ok: true,
    context: { userId: ADMIN, schoolId, roles },
  });
}

function request(paperId: Types.ObjectId) {
  return new Request("http://localhost/api/admin/assess/definitions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ examPaperId: String(paperId), resultBinding: "none" }),
  });
}

before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = "assessment_publication_route";
  await mongoose.connect(mongod.getUri(), { dbName: "assessment_publication_route" });
  await Promise.all([
    AssessmentDefinitionVersion.createIndexes(),
    ExamPaper.createIndexes(),
    ExamPaperSection.createIndexes(),
    ExamQuestion.createIndexes(),
  ]);
  postRoute = (await import("../src/app/api/admin/assess/definitions/route")).POST;
});

beforeEach(async () => {
  await Promise.all([
    AssessmentDefinitionVersion.deleteMany({}),
    ExamQuestion.deleteMany({}),
    ExamPaperSection.deleteMany({}),
    ExamPaper.deleteMany({}),
  ]);
  setAssessmentRouteActiveSchool(undefined);
  setAssessmentRoutePremiumDecision({ allowed: true });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("POST /api/admin/assess/definitions", () => {
  test("rejects an unauthenticated request before publication lookup", async () => {
    const source = await createSourcePaper();
    const response = await postRoute(request(source._id));
    assert.equal(response.status, 401);
    assert.equal(await AssessmentDefinitionVersion.countDocuments({}), 0);
  });

  test("rejects a signed-in school member without the dedicated Premium capability", async () => {
    const source = await createSourcePaper();
    signedIn();
    setAssessmentRoutePremiumDecision({
      allowed: false,
      reason: "Premium Assess publication entitlement enforcement is not enabled.",
      statusCode: 403,
    });
    const response = await postRoute(request(source._id));
    assert.equal(response.status, 403);
    assert.equal(await AssessmentDefinitionVersion.countDocuments({}), 0);
  });

  test("rejects a non-admin active-school identity using the existing school-admin gate", async () => {
    const source = await createSourcePaper();
    signedIn(SCHOOL_A, ["teacher"]);
    const response = await postRoute(request(source._id));
    assert.equal(response.status, 401);
    assert.equal(await AssessmentDefinitionVersion.countDocuments({}), 0);
  });

  test("publishes for an authorized admin and keeps source lookup school-scoped", async () => {
    const source = await createSourcePaper();
    signedIn();
    const response = await postRoute(request(source._id));
    assert.equal(response.status, 201);
    const body = (await response.json()) as { success: boolean; data: { schoolId: string; version: number } };
    assert.equal(body.success, true);
    assert.equal(body.data.schoolId, String(SCHOOL_A));
    assert.equal(body.data.version, 1);

    setAssessmentRouteActiveSchool({
      ok: true,
      context: { userId: ADMIN, schoolId: SCHOOL_B, roles: ["school_admin"] },
    });
    const crossSchool = await postRoute(request(source._id));
    assert.equal(crossSchool.status, 404);
    assert.equal(await AssessmentDefinitionVersion.countDocuments({}), 1);
  });
});
