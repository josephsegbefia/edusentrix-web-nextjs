import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { buildConditionalAssessmentScoreFilter } from "@/lib/academics/assessment-engine/assessment-score-service";
import { AssessmentScore } from "@/models/AssessmentScore";

let mongod: MongoMemoryServer;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "assessment_score_atomicity" });
  await AssessmentScore.createIndexes();
});

beforeEach(async () => {
  await AssessmentScore.deleteMany({});
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function score(overrides: Record<string, unknown> = {}) {
  const schoolId = new Types.ObjectId();
  const assessmentItemId = new Types.ObjectId();
  const studentId = new Types.ObjectId();
  return {
    schoolId,
    academicPeriodId: new Types.ObjectId(),
    assessmentItemId,
    assessmentPlanId: new Types.ObjectId(),
    classGroupId: new Types.ObjectId(),
    subjectId: new Types.ObjectId(),
    studentId,
    teacherId: new Types.ObjectId(),
    score: 8,
    maxScoreSnapshot: 10,
    percentage: 80,
    status: "recorded",
    ...overrides,
  };
}

test("a stale score writer cannot overwrite a score locked after its read", async () => {
  const created = await AssessmentScore.create(score());
  const staleRead = await AssessmentScore.findById(created._id).lean();
  assert.equal(staleRead?.status, "recorded");

  await AssessmentScore.updateOne(
    { _id: created._id, status: "recorded" },
    { $set: { status: "locked" } }
  );

  const result = await AssessmentScore.updateOne(
    buildConditionalAssessmentScoreFilter({
      schoolId: created.schoolId,
      assessmentItemId: created.assessmentItemId,
      studentId: created.studentId,
      existingId: staleRead?._id,
    }),
    { $set: { score: 2, percentage: 20, updatedBy: new Types.ObjectId() } }
  );

  assert.equal(result.matchedCount, 0);
  const final = await AssessmentScore.findById(created._id).lean();
  assert.equal(final?.status, "locked");
  assert.equal(final?.score, 8);
});

test("the score identity index prevents duplicate item/student records", async () => {
  const first = score();
  await AssessmentScore.create(first);
  await assert.rejects(
    () => AssessmentScore.create({ ...first, score: 9 }),
    (error: unknown) => (error as { code?: number }).code === 11000
  );
});
