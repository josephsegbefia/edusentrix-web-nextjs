import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  buildStudioGradebookAuditMetadata,
  updateStudioAssessmentItem,
  validateStudioSubmissionSet,
  writeStudioAssessmentScore,
  type StudioAssessmentScoreWriteInput,
} from "@/lib/academics/assessment-engine/studio-to-gradebook-service";
import { ASSESSMENT_SCORE_STATUSES } from "@/constants/academics/assessment-engine";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentScore } from "@/models/AssessmentScore";
import { Submission } from "@/models/Submission";
import { SubjectResult } from "@/models/SubjectResult";

let mongod: MongoMemoryServer;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "assessment_score_writer_closure" });
  await Promise.all([
    AssessmentItem.createIndexes(),
    AssessmentScore.createIndexes(),
    Submission.createIndexes(),
    SubjectResult.createIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    AssessmentItem.deleteMany({}),
    AssessmentScore.deleteMany({}),
    Submission.deleteMany({}),
    SubjectResult.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function scoreInput(overrides: Partial<StudioAssessmentScoreWriteInput> = {}) {
  return {
    schoolId: new Types.ObjectId(),
    academicPeriodId: new Types.ObjectId(),
    assessmentItemId: new Types.ObjectId(),
    assessmentPlanId: new Types.ObjectId(),
    classGroupId: new Types.ObjectId(),
    subjectId: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
    teacherId: new Types.ObjectId(),
    score: 8,
    maxScoreSnapshot: 10,
    percentage: 80,
    status: "recorded" as const,
    recordedBy: new Types.ObjectId(),
    updatedBy: new Types.ObjectId(),
    gradedAt: new Date(),
    sourceSubmissionId: new Types.ObjectId(),
    ...overrides,
  } satisfies StudioAssessmentScoreWriteInput;
}

function subjectResult(overrides: Record<string, unknown> = {}) {
  return {
    schoolId: new Types.ObjectId(),
    academicPeriodId: new Types.ObjectId(),
    assessmentPlanId: new Types.ObjectId(),
    gradingPolicyId: new Types.ObjectId(),
    classGroupId: new Types.ObjectId(),
    gradeId: new Types.ObjectId(),
    subjectId: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
    teacherId: new Types.ObjectId(),
    components: [],
    finalScore: 70,
    roundedFinalScore: 70,
    gradeLabel: "C",
    isPassed: true,
    missingRequiredItems: [],
    sourceAssessmentItemIds: [],
    status: "draft" as const,
    ...overrides,
  };
}

function assessmentItem(overrides: Record<string, unknown> = {}) {
  return {
    schoolId: new Types.ObjectId(),
    academicPeriodId: new Types.ObjectId(),
    assessmentPlanId: new Types.ObjectId(),
    classGroupId: new Types.ObjectId(),
    gradeId: new Types.ObjectId(),
    subjectId: new Types.ObjectId(),
    teacherId: new Types.ObjectId(),
    title: "Studio homework",
    assessmentType: "assignment",
    sourceType: "app_assignment",
    sourceRefType: "homework",
    sourceRefId: new Types.ObjectId(),
    maxScore: 10,
    contributesToReport: false,
    contributionLockedByRule: false,
    visibility: "teacher_only",
    status: "open",
    ...overrides,
  };
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    homeworkId: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
    schoolId: new Types.ObjectId(),
    attachments: [],
    questionResponses: [],
    status: "graded",
    score: 8,
    gradedAt: new Date(),
    attempts: 1,
    ...overrides,
  };
}

test("Studio score writes cannot overwrite a score locked after the pre-read", async () => {
  const input = scoreInput();
  const created = await AssessmentScore.create(input);

  await AssessmentScore.updateOne(
    { _id: created._id, status: "recorded" },
    { $set: { status: "locked" } }
  );

  const result = await writeStudioAssessmentScore({ ...input, score: 2, percentage: 20 });

  assert.equal(result.outcome, "locked");
  const final = await AssessmentScore.findById(created._id).lean();
  assert.equal(final?.status, "locked");
  assert.equal(final?.score, 8);
});

test("concurrent Studio first writes preserve one score identity", async () => {
  const base = scoreInput();
  const [first, second] = await Promise.all([
    writeStudioAssessmentScore({ ...base, score: 4, percentage: 40 }),
    writeStudioAssessmentScore({ ...base, score: 9, percentage: 90 }),
  ]);

  assert.deepEqual(
    [first.outcome, second.outcome].sort(),
    ["conflict", "written"]
  );
  assert.equal(
    await AssessmentScore.countDocuments({
      schoolId: base.schoolId,
      assessmentItemId: base.assessmentItemId,
      studentId: base.studentId,
    }),
    1
  );
});

test("a Studio write for another school cannot mutate the existing score", async () => {
  const stored = scoreInput();
  await AssessmentScore.create(stored);
  const otherSchool = scoreInput({
    academicPeriodId: stored.academicPeriodId,
    assessmentItemId: stored.assessmentItemId,
    assessmentPlanId: stored.assessmentPlanId,
    classGroupId: stored.classGroupId,
    subjectId: stored.subjectId,
    studentId: stored.studentId,
    score: 1,
    percentage: 10,
  });

  const result = await writeStudioAssessmentScore(otherSchool);

  assert.equal(result.outcome, "conflict");
  const final = await AssessmentScore.findById((await AssessmentScore.findOne({ schoolId: stored.schoolId }))?._id).lean();
  assert.equal(final?.schoolId.toString(), stored.schoolId.toString());
  assert.equal(final?.score, 8);
});

test("conditional score writes preserve canMutateAssessmentScore permissions for every status", async () => {
  for (const status of ASSESSMENT_SCORE_STATUSES) {
    await AssessmentScore.deleteMany({});
    const input = scoreInput({ status });
    const created = await AssessmentScore.create(input);
    const result = await writeStudioAssessmentScore({ ...input, score: 3, percentage: 30 });
    const final = await AssessmentScore.findById(created._id).lean();

    if (status === "locked") {
      assert.equal(result.outcome, "locked");
      assert.equal(final?.score, 8);
    } else {
      assert.equal(result.outcome, "written");
      assert.equal(final?.score, 3);
    }
  }
});

test("AssessmentItem update rejects a lifecycle transition after the pre-read", async () => {
  const created = await AssessmentItem.create(assessmentItem());
  const preRead = await AssessmentItem.findById(created._id).lean();
  assert.ok(preRead);

  await AssessmentItem.updateOne(
    { _id: created._id, status: "open" },
    { $set: { status: "locked" } }
  );

  const result = await updateStudioAssessmentItem({
    schoolId: created.schoolId,
    item: preRead,
    update: { title: "Stale update" },
  });

  assert.equal(result.outcome, "conflict");
  const final = await AssessmentItem.findById(created._id).lean();
  assert.equal(final?.status, "locked");
  assert.equal(final?.title, "Studio homework");
});

test("AssessmentItem updates remain allowed for every currently mutable lifecycle status", async () => {
  for (const status of ["draft", "open", "completed", "submitted"] as const) {
    const created = await AssessmentItem.create(assessmentItem({ status }));
    const result = await updateStudioAssessmentItem({
      schoolId: created.schoolId,
      item: created.toObject(),
      update: { title: `Updated ${status}` },
    });

    assert.equal(result.outcome, "updated");
    assert.equal(result.item?.title, `Updated ${status}`);
  }
});

test("late invalid Studio submissions are rejected before any score mutation", async () => {
  const firstStudentId = new Types.ObjectId();
  const secondStudentId = new Types.ObjectId();
  const result = validateStudioSubmissionSet(
    [
      { studentId: firstStudentId, score: 8 },
      { studentId: secondStudentId, score: 11 },
    ],
    10
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.studentId, String(secondStudentId));
  }
  assert.equal(await AssessmentScore.countDocuments({}), 0);
});

test("Submission uniqueness prevents ambiguous multiple graded records per student/homework", async () => {
  const first = await Submission.create(submission());
  await assert.rejects(
    () =>
      Submission.create(
        submission({
          homeworkId: first.homeworkId,
          studentId: first.studentId,
          schoolId: first.schoolId,
        })
      ),
    (error: unknown) => (error as { code?: number }).code === 11000
  );
  assert.equal(
    await Submission.countDocuments({
      homeworkId: first.homeworkId,
      studentId: first.studentId,
    }),
    1
  );
});

test("partial Studio outcomes carry explicit audit context instead of completion semantics", async () => {
  const metadata = buildStudioGradebookAuditMetadata({
    homeworkId: new Types.ObjectId(),
    assessmentItemId: new Types.ObjectId(),
    selectedSubmissionCount: 3,
    importedScoreCount: 1,
    skippedLockedScores: 1,
    conflicts: ["student-conflict"],
    contributesToReport: true,
    componentKey: "classwork",
  });

  assert.equal(metadata.outcome, "partial_failure");
  assert.equal(metadata.operation, "studio_gradebook_link");
  assert.equal(metadata.selectedSubmissionCount, 3);
  assert.equal(metadata.writtenScoreCount, 1);
  assert.equal(metadata.skippedLockedScoreCount, 1);
  assert.deepEqual(metadata.conflicts, ["student-conflict"]);
});

test("a stale subject-result recalculation cannot overwrite submission or lock", async () => {
  const stored = await SubjectResult.create(subjectResult());
  const identity = {
    _id: stored._id,
    schoolId: stored.schoolId,
    academicPeriodId: stored.academicPeriodId,
    classGroupId: stored.classGroupId,
    subjectId: stored.subjectId,
    studentId: stored.studentId,
    status: { $nin: ["submitted", "approved", "locked"] },
  };

  await SubjectResult.updateOne(
    { _id: stored._id, status: "draft" },
    { $set: { status: "submitted", lockedAt: new Date() } }
  );

  const staleWrite = await SubjectResult.updateOne(identity, {
    $set: { finalScore: 12, roundedFinalScore: 12, gradeLabel: "F", status: "draft" },
  });

  assert.equal(staleWrite.matchedCount, 0);
  const final = await SubjectResult.findById(stored._id).lean();
  assert.equal(final?.status, "submitted");
  assert.equal(final?.finalScore, 70);
});

test("approval and locking predicates reject stale lifecycle updates across schools", async () => {
  const stored = await SubjectResult.create(subjectResult({ status: "submitted" }));
  const schoolB = new Types.ObjectId();

  await SubjectResult.updateOne(
    { _id: stored._id, schoolId: stored.schoolId, status: "submitted" },
    { $set: { status: "locked", lockedAt: new Date() } }
  );

  const staleApproval = await SubjectResult.updateOne(
    { _id: stored._id, schoolId: stored.schoolId, status: "submitted" },
    { $set: { status: "approved", approvedAt: new Date() } }
  );
  const crossSchoolUpdate = await SubjectResult.updateOne(
    { _id: stored._id, schoolId: schoolB, status: { $nin: ["submitted", "approved", "locked"] } },
    { $set: { status: "draft", finalScore: 0 } }
  );

  assert.equal(staleApproval.matchedCount, 0);
  assert.equal(crossSchoolUpdate.matchedCount, 0);
  const final = await SubjectResult.findById(stored._id).lean();
  assert.equal(final?.status, "locked");
  assert.equal(final?.finalScore, 70);
});

test("concurrent first SubjectResult inserts converge on the unique identity", async () => {
  const base = subjectResult();
  const identity = {
    schoolId: base.schoolId,
    academicPeriodId: base.academicPeriodId,
    classGroupId: base.classGroupId,
    subjectId: base.subjectId,
    studentId: base.studentId,
    status: { $nin: ["submitted", "approved", "locked"] },
  };

  const results = await Promise.allSettled([
    SubjectResult.findOneAndUpdate(identity, { $set: base }, { upsert: true, new: true }),
    SubjectResult.findOneAndUpdate(identity, { $set: base }, { upsert: true, new: true }),
  ]);

  assert.equal(
    await SubjectResult.countDocuments({
      schoolId: base.schoolId,
      academicPeriodId: base.academicPeriodId,
      classGroupId: base.classGroupId,
      subjectId: base.subjectId,
      studentId: base.studentId,
    }),
    1
  );
  assert.ok(results.some((result) => result.status === "fulfilled"));
});

test("submission and approval races never regress a SubjectResult to draft", async () => {
  const stored = await SubjectResult.create(subjectResult());

  await Promise.all([
    SubjectResult.updateOne(
      {
        _id: stored._id,
        schoolId: stored.schoolId,
        status: { $nin: ["submitted", "approved", "locked"] },
      },
      { $set: { status: "submitted", submittedAt: new Date() } }
    ),
    SubjectResult.updateOne(
      { _id: stored._id, schoolId: stored.schoolId, status: "submitted" },
      { $set: { status: "approved", approvedAt: new Date() } }
    ),
  ]);

  const final = await SubjectResult.findById(stored._id).lean();
  assert.ok(["submitted", "approved"].includes(final?.status ?? ""));
  assert.notEqual(final?.status, "draft");
});
