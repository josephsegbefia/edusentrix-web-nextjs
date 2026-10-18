import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { stubAssessmentRouteDeps, setAssessmentRouteActiveSchool, setAssessmentRoutePremiumDecision } from "./assessment-route/helpers/stub-assessment-route-deps";
import { School } from "../src/models/School";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "../src/models/AssessmentDeliveryVersion";

stubAssessmentRouteDeps();

const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
let mongod: MongoMemoryReplSet;
let getRoute: () => Promise<Response>;

function activeSchool(schoolId = SCHOOL_A, roles = ["school_admin"]) {
  setAssessmentRouteActiveSchool({
    ok: true,
    context: { userId: ADMIN, schoolId, roles },
  });
}

async function createSchool(_id: Types.ObjectId, name: string) {
  await School.create({ _id, name, type: "Basic", curriculumCode: "ghana_nacca", status: "active" });
}

async function createDefinition(schoolId: Types.ObjectId, title: string) {
  const id = new Types.ObjectId();
  const source = new Types.ObjectId();
  const academicPeriod = new Types.ObjectId();
  const now = new Date("2026-10-16T09:00:00.000Z");
  await AssessmentDefinitionVersion.create({
    schoolId,
    definitionKey: `definition:${String(schoolId)}`,
    sourceExamPaperId: source,
    version: 1,
    status: "published",
    title,
    examTypeId: new Types.ObjectId(),
    academicYearId: academicPeriod,
    academicPeriodId: academicPeriod,
    scope: "class_group",
    gradeId: new Types.ObjectId(),
    classGroupIds: [],
    subjectId: new Types.ObjectId(),
    resultBinding: "none",
    scoring: { maximumMarks: 10, questionMarksTotal: 10, policy: "raw_marks", scoreBearing: false, contributesToCanonicalAcademicEngine: false },
    sections: [],
    resourceManifest: [],
    contentHash: id.toHexString().padEnd(64, "0"),
    contentHashAlgorithm: "sha256",
    attribution: { authorId: ADMIN, reviewerId: ADMIN, publisherId: ADMIN },
    publishedAt: now,
  });
}

async function createDelivery(schoolId: Types.ObjectId) {
  const id = new Types.ObjectId();
  const academicPeriodId = new Types.ObjectId();
  const definitionId = new Types.ObjectId();
  await AssessmentDeliveryVersion.create({
    _id: id,
    schoolId,
    deliveryKey: "delivery:" + String(schoolId),
    assessmentDefinitionVersionId: definitionId,
    definitionContentHash: "a".repeat(64),
    version: 1,
    title: "School A Mathematics · Paper",
    mode: "paper",
    academicYearId: academicPeriodId,
    academicPeriodId,
    gradeId: new Types.ObjectId(),
    classGroupIds: [],
    subjectId: new Types.ObjectId(),
    subjectOfferingId: null,
    schedule: { examSessionId: null, examTimetableEntryId: null, academicPeriodId, scheduledDate: null, startTime: null, endTime: null, venueId: null, roomLabel: null, classGroupIds: [] },
    timing: { durationMinutes: 90, lateEntryMinutes: 0, serverAuthoritative: true },
    resultBinding: "none",
    assessmentPlanId: null,
    assessmentItemId: null,
    reviewPolicy: { reviewRequired: true, reviewerRole: "school_admin", answerKeyAccess: "school_admin_only", candidateAccess: "not_available" },
    accessibilityPolicy: { extraTimeMinutes: 0, largePrint: false, readerOrScribe: false, notes: null },
    contentHash: "b".repeat(64),
    contentHashAlgorithm: "sha256",
    status: "published",
    attribution: { createdBy: ADMIN, reviewedBy: ADMIN, publishedBy: ADMIN, supersededBy: null },
    publishedAt: new Date("2026-10-16T09:00:00.000Z"),
  });
  return id;
}

before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = "assessment_overview_route";
  await mongoose.connect(mongod.getUri(), { dbName: "assessment_overview_route" });
  getRoute = (await import("../src/app/api/admin/assess/overview/route")).GET;
});

beforeEach(async () => {
  await Promise.all([School.deleteMany({}), AssessmentDefinitionVersion.deleteMany({}), AssessmentDeliveryVersion.deleteMany({})]);
  setAssessmentRouteActiveSchool(undefined);
  setAssessmentRoutePremiumDecision({ allowed: true });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("GET /api/admin/assess/overview", () => {
  test("denies unauthenticated and non-Premium access without reading school data", async () => {
    const unauthenticated = await getRoute();
    assert.equal(unauthenticated.status, 401);

    activeSchool();
    setAssessmentRoutePremiumDecision({ allowed: false, reason: "Premium Assess is unavailable", statusCode: 403 });
    const locked = await getRoute();
    assert.equal(locked.status, 403);
  });

  test("returns live school-scoped metrics without leaking another school", async () => {
    await createSchool(SCHOOL_A, "School A");
    await createSchool(SCHOOL_B, "School B");
    await createDefinition(SCHOOL_A, "School A Mathematics");
    await createDefinition(SCHOOL_B, "School B Mathematics");
    activeSchool(SCHOOL_A);

    const response = await getRoute();
    assert.equal(response.status, 200);
    const body = (await response.json()) as { success: boolean; data: { school: { name: string }; metrics: { publishedExaminations: number } } };
    assert.equal(body.success, true);
    assert.equal(body.data.school.name, "School A");
    assert.equal(body.data.metrics.publishedExaminations, 1);
  });

  test("links recent delivery activity with validated delivery context", async () => {
    await createSchool(SCHOOL_A, "School A");
    const deliveryId = await createDelivery(SCHOOL_A);
    activeSchool(SCHOOL_A);

    const response = await getRoute();
    assert.equal(response.status, 200);
    const body = (await response.json()) as { data: { recentExaminations: Array<{ id: string; href: string }> } };
    assert.equal(body.data.recentExaminations[0]?.id, String(deliveryId));
    assert.match(body.data.recentExaminations[0]?.href ?? "", new RegExp("delivery=" + String(deliveryId)));
    assert.match(body.data.recentExaminations[0]?.href ?? "", /focus=paper-delivery/);
  });
});
