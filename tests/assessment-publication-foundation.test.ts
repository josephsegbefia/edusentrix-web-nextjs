import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { AssessmentItem } from "../src/models/AssessmentItem";
import { AssessmentPlan } from "../src/models/AssessmentPlan";
import { ExamPaper } from "../src/models/ExamPaper";
import { ExamPaperSection } from "../src/models/ExamPaperSection";
import { ExamQuestion } from "../src/models/ExamQuestion";
import {
  assertLegalAssessmentDefinitionTransition,
  getCurrentAssessmentDefinitionVersion,
  getAssessmentDefinition,
  publishAssessmentDefinition,
  serializeAssessmentDefinition,
} from "../src/lib/assess/assessment-definition-service";

let mongod: MongoMemoryReplSet;

const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const USER_ADMIN = new Types.ObjectId();
const USER_OTHER = new Types.ObjectId();

function objectId() {
  return new Types.ObjectId();
}

async function createSourcePaper(input: {
  schoolId?: Types.ObjectId;
  prompt?: string;
  attachment?: Record<string, unknown>;
  classGroupIds?: Types.ObjectId[];
}) {
  const schoolId = input.schoolId ?? SCHOOL_A;
  const gradeId = objectId();
  const subjectId = objectId();
  const academicPeriodId = objectId();
  const classGroupIds = input.classGroupIds ?? [objectId()];
  const paper = await ExamPaper.create({
    schoolId,
    title: "Mathematics Midterm",
    examTypeId: objectId(),
    academicYearId: academicPeriodId,
    academicPeriodId,
    scope: "class_group",
    gradeId,
    classGroupIds,
    subjectId,
    contributorIds: [],
    createdBy: USER_ADMIN,
    ownerRole: "admin",
    totalMarks: 10,
    status: "approved",
    approvedAt: new Date("2026-10-15T09:00:00.000Z"),
    approvedBy: USER_ADMIN,
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
    prompt: input.prompt ?? "What is 2 + 2?",
    plainTextPrompt: input.prompt ?? "What is 2 + 2?",
    marks: 10,
    difficulty: "easy",
    options: [],
    subQuestions: [],
    curriculumNodeIds: [],
    schemeItemIds: [],
    lessonIds: [],
    lessonNoteIds: [],
    expectedAnswer: "4",
    markingGuide: "Award 10 marks for 4.",
    attachments: input.attachment ? [input.attachment] : [],
    order: 0,
    createdBy: USER_ADMIN,
    source: "manual",
  });
  return { paper, gradeId, subjectId, academicPeriodId, classGroupIds };
}

function actor(overrides: Partial<Parameters<typeof publishAssessmentDefinition>[0]["actor"]> = {}) {
  return {
    userId: USER_ADMIN,
    schoolId: SCHOOL_A,
    isAdmin: true,
    premiumPublicationEntitled: true,
    ...overrides,
  };
}

async function publish(paperId: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return publishAssessmentDefinition({
    examPaperId: paperId,
    actor: actor(),
    resultBinding: "none",
    ...overrides,
  });
}

async function createScoreBearingBinding(source: Awaited<ReturnType<typeof createSourcePaper>>) {
  const plan = await AssessmentPlan.create({
    schoolId: SCHOOL_A,
    name: "2026 Term 1 plan",
    academicPeriodId: source.academicPeriodId,
    gradingPolicyId: objectId(),
    appliesToGradeId: source.gradeId,
    appliesToGradeIds: [source.gradeId],
    appliesToClassGroupIds: source.classGroupIds,
    status: "active",
  });
  const item = await AssessmentItem.create({
    schoolId: SCHOOL_A,
    academicPeriodId: source.academicPeriodId,
    assessmentPlanId: plan._id,
    classGroupId: source.classGroupIds[0],
    gradeId: source.gradeId,
    subjectId: source.subjectId,
    teacherId: objectId(),
    title: "Mathematics examination",
    assessmentType: "exam",
    sourceType: "exam",
    maxScore: 10,
    contributesToReport: true,
    contributionLockedByRule: false,
    visibility: "teacher_only",
    status: "open",
  });
  return { plan, item };
}

async function withPatchedDefinitionModelMethod(
  method: "create" | "updateOne",
  replacement: (...args: unknown[]) => Promise<unknown>,
  callback: () => Promise<void>
) {
  const model = AssessmentDefinitionVersion as unknown as Record<string, unknown>;
  const original = model[method];
  model[method] = replacement;
  try {
    await callback();
  } finally {
    model[method] = original;
  }
}

function callOriginalModelMethod(original: unknown, args: unknown[]) {
  return Reflect.apply(
    original as (...methodArgs: unknown[]) => unknown,
    AssessmentDefinitionVersion,
    args
  );
}

before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  await mongoose.connect(mongod.getUri(), { dbName: "assessment_publication_foundation" });
  await Promise.all([
    AssessmentDefinitionVersion.createIndexes(),
    ExamPaper.createIndexes(),
    ExamPaperSection.createIndexes(),
    ExamQuestion.createIndexes(),
    AssessmentPlan.createIndexes(),
    AssessmentItem.createIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    AssessmentDefinitionVersion.deleteMany({}),
    ExamQuestion.deleteMany({}),
    ExamPaperSection.deleteMany({}),
    ExamPaper.deleteMany({}),
    AssessmentItem.deleteMany({}),
    AssessmentPlan.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("ASSESS-P01A immutable publication foundation", () => {
  test("published snapshots survive source-paper edits and expose stable hashes", async () => {
    const source = await createSourcePaper({});
    const first = await publish(source.paper._id);
    const originalHash = first.definition.contentHash;

    await ExamQuestion.updateOne(
      { schoolId: SCHOOL_A, examPaperId: source.paper._id },
      { $set: { prompt: "Changed after publication" } }
    );

    const stored = await getAssessmentDefinition({
      schoolId: SCHOOL_A,
      definitionId: first.definition._id,
    });
    assert.equal(stored?.sections[0]?.questions[0]?.prompt, "What is 2 + 2?");
    assert.equal(stored?.contentHash, originalHash);

    const candidateProjection = serializeAssessmentDefinition(stored!, {
      includePrivateContent: false,
    });
    const projectedQuestion = candidateProjection.sections[0]?.questions[0];
    assert.ok(projectedQuestion);
    assert.equal("expectedAnswer" in projectedQuestion, false);
    assert.equal("markingGuide" in projectedQuestion, false);
    assert.equal("resourceManifest" in candidateProjection, false);
  });

  test("republication creates a version and supersedes the previous version", async () => {
    const source = await createSourcePaper({});
    const first = await publish(source.paper._id);

    await ExamQuestion.updateOne(
      { schoolId: SCHOOL_A, examPaperId: source.paper._id },
      { $set: { prompt: "What is 3 + 3?" } }
    );
    const second = await publish(source.paper._id);

    assert.equal(second.definition.version, 2);
    assert.equal(String(second.definition.supersedesVersionId), String(first.definition._id));
    assert.notEqual(second.definition.contentHash, first.definition.contentHash);

    const old = await getAssessmentDefinition({
      schoolId: SCHOOL_A,
      definitionId: first.definition._id,
    });
    assert.equal(old?.status, "superseded");
  });

  test("same-content concurrent publication is idempotent", async () => {
    const source = await createSourcePaper({});
    const results = await Promise.all(
      Array.from({ length: 4 }, () => publish(source.paper._id))
    );
    const versions = await AssessmentDefinitionVersion.find({
      schoolId: SCHOOL_A,
      sourceExamPaperId: source.paper._id,
    }).lean();

    assert.equal(versions.length, 1);
    assert.deepEqual(
      new Set(results.map((result) => String(result.definition._id))).size,
      1
    );
    assert.equal(results.filter((result) => result.replayed).length, 3);
  });

  test("different-content concurrent publication allocates ordered versions and one current publication", async () => {
    const source = await createSourcePaper({});
    const binding = await createScoreBearingBinding(source);
    const [nonReporting, scoreBearing] = await Promise.all([
      publish(source.paper._id),
      publishAssessmentDefinition({
        examPaperId: source.paper._id,
        actor: actor(),
        resultBinding: "score_bearing",
        assessmentPlanId: binding.plan._id,
        assessmentItemId: binding.item._id,
      }),
    ]);

    const versions = await AssessmentDefinitionVersion.find({
      schoolId: SCHOOL_A,
      sourceExamPaperId: source.paper._id,
    }).sort({ version: 1 }).lean();

    assert.equal(versions.length, 2);
    assert.deepEqual(versions.map((version) => version.version), [1, 2]);
    assert.notEqual(nonReporting.definition.contentHash, scoreBearing.definition.contentHash);
    assert.equal(versions.filter((version) => version.status === "published").length, 1);
    assert.equal(versions[0]?.status, "superseded");
    assert.equal(versions[1]?.status, "published");
    assert.equal(String(versions[1]?.supersedesVersionId), String(versions[0]?._id));
  });

  test("aborts when creation fails inside the publication transaction", async () => {
    const source = await createSourcePaper({});
    const model = AssessmentDefinitionVersion as unknown as Record<string, unknown>;
    const original = model.create;

    await withPatchedDefinitionModelMethod(
      "create",
      async (...args) => {
        await callOriginalModelMethod(original, args);
        throw new Error("simulated ambiguous create result");
      },
      async () => {
        await assert.rejects(() => publish(source.paper._id), /simulated ambiguous create result/);
      }
    );

    const versions = await AssessmentDefinitionVersion.find({
      schoolId: SCHOOL_A,
      sourceExamPaperId: source.paper._id,
    }).lean();
    assert.equal(versions.length, 0);
  });

  test("does not report success when predecessor supersession fails", async () => {
    const source = await createSourcePaper({});
    const first = await publish(source.paper._id);
    await ExamQuestion.updateOne(
      { schoolId: SCHOOL_A, examPaperId: source.paper._id },
      { $set: { prompt: "What is 3 + 3?" } }
    );
    const model = AssessmentDefinitionVersion as unknown as Record<string, unknown>;
    const original = model.updateOne;

    await assert.rejects(
      () => withPatchedDefinitionModelMethod(
        "updateOne",
        async (...args) => {
          const filter = args[0] as Record<string, unknown> | undefined;
          if (String(filter?._id) === String(first.definition._id)) {
            throw new Error("simulated predecessor supersession failure");
          }
          return callOriginalModelMethod(original, args) as Promise<unknown>;
        },
        async () => {
          await publish(source.paper._id);
        }
      ),
      /simulated predecessor supersession failure/
    );

    const versions = await AssessmentDefinitionVersion.find({
      schoolId: SCHOOL_A,
      sourceExamPaperId: source.paper._id,
    }).sort({ version: 1 }).lean();
    assert.equal(versions.length, 1);
    assert.equal(versions[0]?._id.toString(), first.definition._id.toString());
    assert.equal(versions[0]?.status, "published");
  });

  test("retry after an aborted failure advances from the unchanged published current version", async () => {
    const source = await createSourcePaper({});
    const first = await publish(source.paper._id);
    await ExamQuestion.updateOne(
      { schoolId: SCHOOL_A, examPaperId: source.paper._id },
      { $set: { prompt: "What is 7 + 7?" } }
    );
    const model = AssessmentDefinitionVersion as unknown as Record<string, unknown>;
    const original = model.updateOne;

    await assert.rejects(
      () => withPatchedDefinitionModelMethod(
        "updateOne",
        async (...args) => {
          const filter = args[0] as Record<string, unknown> | undefined;
          if (String(filter?._id) === String(first.definition._id)) {
            throw new Error("simulated one-time predecessor failure");
          }
          return callOriginalModelMethod(original, args) as Promise<unknown>;
        },
        async () => {
          await publish(source.paper._id);
        }
      ),
      /simulated one-time predecessor failure/
    );

    await ExamQuestion.updateOne(
      { schoolId: SCHOOL_A, examPaperId: source.paper._id },
      { $set: { prompt: "What is 8 + 8?" } }
    );
    const retry = await publish(source.paper._id);
    assert.equal(retry.definition.version, 2);
    assert.equal(String(retry.definition.supersedesVersionId), String(first.definition._id));
    const current = await getCurrentAssessmentDefinitionVersion({
      schoolId: SCHOOL_A,
      definitionKey: `exam-paper:${String(source.paper._id)}`,
    });
    assert.equal(current?.version, 2);
    assert.equal(current?.status, "published");
  });

  test("rolls back both writes when predecessor supersession fails", async () => {
    const source = await createSourcePaper({});
    const first = await publish(source.paper._id);
    await ExamQuestion.updateOne(
      { schoolId: SCHOOL_A, examPaperId: source.paper._id },
      { $set: { prompt: "What is 5 + 5?" } }
    );

    await assert.rejects(
      () => withPatchedDefinitionModelMethod(
        "updateOne",
        async () => {
          throw new Error("simulated predecessor and compensation failure");
        },
        async () => {
          await publish(source.paper._id);
        }
      ),
      /simulated predecessor and compensation failure/
    );

    const versions = await AssessmentDefinitionVersion.find({
      schoolId: SCHOOL_A,
      sourceExamPaperId: source.paper._id,
    }).sort({ version: 1 }).lean();
    assert.equal(versions.length, 1);
    assert.equal(versions[0]?._id.toString(), first.definition._id.toString());
    assert.equal(versions[0]?.status, "published");
  });

  test("rejects illegal lifecycle transitions and direct mutation of published content", async () => {
    assert.throws(
      () => assertLegalAssessmentDefinitionTransition("published", "draft"),
      /Illegal assessment definition transition/
    );

    const source = await createSourcePaper({});
    const result = await publish(source.paper._id);
    const definition = await AssessmentDefinitionVersion.findById(result.definition._id);
    assert.ok(definition);
    definition.title = "Tampered title";
    await assert.rejects(() => definition.save(), /immutable/);
  });

  test("enforces school isolation and publication authorization", async () => {
    const source = await createSourcePaper({});

    await assert.rejects(
      () => publishAssessmentDefinition({
        examPaperId: source.paper._id,
        actor: actor({ schoolId: SCHOOL_B }),
        resultBinding: "none",
      }),
      /Exam paper not found/
    );

    await assert.rejects(
      () => publishAssessmentDefinition({
        examPaperId: source.paper._id,
        actor: actor({ isAdmin: false, premiumPublicationEntitled: true }),
        resultBinding: "none",
      }),
      /Only school administrators/
    );

    await assert.rejects(
      () => publishAssessmentDefinition({
        examPaperId: source.paper._id,
        actor: actor({ premiumPublicationEntitled: false }),
        resultBinding: "none",
      }),
      /Premium publication entitlement/
    );
  });

  test("rejects missing or invalid source resources", async () => {
    const missing = await createSourcePaper({
      attachment: {
        id: "image-1",
        type: "image",
        url: "missing-resource-reference",
        displayMode: "above_question",
      },
    });
    await assert.rejects(() => publish(missing.paper._id), /resource/i);

    const invalid = await createSourcePaper({
      attachment: {
        id: "image-2",
        type: "image",
        url: "ftp://not-a-resource",
        displayMode: "above_question",
      },
    });
    await assert.rejects(() => publish(invalid.paper._id), /resource/i);

    const structurallyValidButUnverified = await createSourcePaper({
      attachment: {
        id: "image-3",
        type: "image",
        url: "https://assets.example.test/question-image.png",
        uploadKey: "school/question-image.png",
        displayMode: "above_question",
      },
    });
    await assert.rejects(
      () => publish(structurallyValidButUnverified.paper._id),
      /verified private asset metadata and a stable resource digest/i
    );
  });

  test("requires canonical plan and item binding only for score-bearing publication", async () => {
    const source = await createSourcePaper({});
    const nonReporting = await publish(source.paper._id);
    assert.equal(nonReporting.definition.resultBinding, "none");
    assert.equal(nonReporting.definition.assessmentItemId, null);

    await assert.rejects(
      () => publishAssessmentDefinition({
        examPaperId: source.paper._id,
        actor: actor(),
        resultBinding: "score_bearing",
      }),
      /requires assessmentPlanId and assessmentItemId/
    );

    const plan = await AssessmentPlan.create({
      schoolId: SCHOOL_A,
      name: "2026 Term 1 plan",
      academicPeriodId: source.academicPeriodId,
      gradingPolicyId: objectId(),
      appliesToGradeId: source.gradeId,
      appliesToGradeIds: [source.gradeId],
      appliesToClassGroupIds: source.classGroupIds,
      status: "active",
    });
    const item = await AssessmentItem.create({
      schoolId: SCHOOL_A,
      academicPeriodId: source.academicPeriodId,
      assessmentPlanId: plan._id,
      classGroupId: source.classGroupIds[0],
      gradeId: source.gradeId,
      subjectId: source.subjectId,
      teacherId: objectId(),
      title: "Mathematics examination",
      assessmentType: "exam",
      sourceType: "exam",
      maxScore: 10,
      contributesToReport: true,
      contributionLockedByRule: false,
      visibility: "teacher_only",
      status: "open",
    });

    const scoreBearing = await publishAssessmentDefinition({
      examPaperId: source.paper._id,
      actor: actor(),
      resultBinding: "score_bearing",
      assessmentPlanId: plan._id,
      assessmentItemId: item._id,
    });
    assert.equal(String(scoreBearing.definition.assessmentPlanId), String(plan._id));
    assert.equal(String(scoreBearing.definition.assessmentItemId), String(item._id));
  });

  test("publication does not create canonical scores or report-card records", async () => {
    const source = await createSourcePaper({});
    await publish(source.paper._id);
    assert.equal(await mongoose.connection.collection("assessmentscores").countDocuments({}), 0);
    assert.equal(await mongoose.connection.collection("reportcardruns").countDocuments({}), 0);
  });
});
