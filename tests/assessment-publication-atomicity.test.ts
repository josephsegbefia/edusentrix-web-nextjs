import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { ExamPaper } from "../src/models/ExamPaper";
import { ExamPaperSection } from "../src/models/ExamPaperSection";
import { ExamQuestion } from "../src/models/ExamQuestion";
import {
  getCurrentAssessmentDefinitionVersion,
  publishAssessmentDefinition,
} from "../src/lib/assess/assessment-definition-service";

let replSet: MongoMemoryReplSet;
const SCHOOL_A = new Types.ObjectId();
const SCHOOL_B = new Types.ObjectId();
const ADMIN = new Types.ObjectId();

const oid = () => new Types.ObjectId();

function actor(schoolId = SCHOOL_A) {
  return {
    userId: ADMIN,
    schoolId,
    isAdmin: true,
    premiumPublicationEntitled: true,
  };
}

async function createSourcePaper(prompt = "What is 2 + 2?", schoolId = SCHOOL_A) {
  const academicPeriodId = oid();
  const paper = await ExamPaper.create({
    schoolId,
    title: "Atomicity Mathematics",
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
    totalMarks: 10,
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
  return paper;
}

async function publish(paperId: Types.ObjectId, schoolId = SCHOOL_A) {
  return publishAssessmentDefinition({
    examPaperId: paperId,
    actor: actor(schoolId),
    resultBinding: "none",
  });
}

async function versions(paperId: Types.ObjectId) {
  return AssessmentDefinitionVersion.find({ sourceExamPaperId: paperId })
    .sort({ version: 1 })
    .lean();
}

async function patchModelMethod(
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

function invokeOriginal(original: unknown, args: unknown[]) {
  return Reflect.apply(
    original as (...methodArgs: unknown[]) => unknown,
    AssessmentDefinitionVersion,
    args
  );
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  await mongoose.connect(replSet.getUri(), { dbName: "assessment_publication_atomicity" });
  await Promise.all([
    AssessmentDefinitionVersion.createIndexes(),
    ExamPaper.createIndexes(),
    ExamPaperSection.createIndexes(),
    ExamQuestion.createIndexes(),
  ]);

  const probeId = oid();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await AssessmentDefinitionVersion.collection.insertOne({ _id: probeId, transactionProbe: true }, { session });
      await AssessmentDefinitionVersion.collection.deleteOne({ _id: probeId }, { session });
    });
  } finally {
    await session.endSession();
  }
});

beforeEach(async () => {
  await Promise.all([
    AssessmentDefinitionVersion.deleteMany({}),
    ExamQuestion.deleteMany({}),
    ExamPaperSection.deleteMany({}),
    ExamPaper.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test("failure before creation leaves no publication state", async () => {
  const source = await createSourcePaper();
  const model = AssessmentDefinitionVersion as unknown as Record<string, unknown>;
  const original = model.create;

  await assert.rejects(
    () => patchModelMethod(
      "create",
      async () => { throw new Error("injected before create"); },
      async () => { await publish(source._id); }
    ),
    /injected before create/
  );
  assert.equal((await versions(source._id)).length, 0);
  model.create = original;
});

test("failure after insertion and before supersession rolls back the inserted version", async () => {
  const source = await createSourcePaper();
  const first = await publish(source._id);
  await ExamQuestion.updateOne({ examPaperId: source._id }, { $set: { prompt: "What is 3 + 3?" } });
  const original = (AssessmentDefinitionVersion as unknown as Record<string, unknown>).updateOne;

  await assert.rejects(
    () => patchModelMethod(
      "updateOne",
      async (filter) => {
        if (String((filter as Record<string, unknown>)?._id) === String(first.definition._id)) {
          throw new Error("injected before supersession");
        }
        return invokeOriginal(original, [filter]);
      },
      async () => { await publish(source._id); }
    ),
    /injected before supersession/
  );
  const stored = await versions(source._id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.status, "published");
});

test("failure during predecessor supersession rolls back both writes", async () => {
  const source = await createSourcePaper();
  const first = await publish(source._id);
  await ExamQuestion.updateOne({ examPaperId: source._id }, { $set: { prompt: "What is 5 + 5?" } });
  const model = AssessmentDefinitionVersion as unknown as Record<string, unknown>;
  const original = model.updateOne;

  await assert.rejects(
    () => patchModelMethod(
      "updateOne",
      async (...args) => {
        const result = await invokeOriginal(original, args);
        const filter = args[0] as Record<string, unknown>;
        if (String(filter._id) === String(first.definition._id)) throw new Error("injected during supersession");
        return result;
      },
      async () => { await publish(source._id); }
    ),
    /injected during supersession/
  );
  const stored = await versions(source._id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?._id.toString(), first.definition._id.toString());
  assert.equal(stored[0]?.status, "published");
});

test("ambiguous commit acknowledgement reconciles the committed content identity", async () => {
  const source = await createSourcePaper();
  const originalStartSession = mongoose.startSession.bind(mongoose);
  const mongooseWithPatchedSession = mongoose as unknown as {
    startSession: typeof mongoose.startSession;
  };
  mongooseWithPatchedSession.startSession = async (...args: Parameters<typeof mongoose.startSession>) => {
    const session = await originalStartSession(...args);
    const originalWithTransaction = session.withTransaction.bind(session);
    session.withTransaction = async (...transactionArgs) => {
      await originalWithTransaction(...transactionArgs);
      const error = new Error("simulated unknown commit acknowledgement") as Error & { errorLabels: string[] };
      error.errorLabels = ["UnknownTransactionCommitResult"];
      throw error;
    };
    return session;
  };

  try {
    const result = await publish(source._id);
    assert.equal(result.replayed, true);
    assert.equal((await versions(source._id)).length, 1);
  } finally {
    mongooseWithPatchedSession.startSession = originalStartSession;
  }
});

test("duplicate version allocation retries without creating a duplicate", async () => {
  const source = await createSourcePaper();
  const first = await publish(source._id);
  await ExamQuestion.updateOne({ examPaperId: source._id }, { $set: { prompt: "What is 9 + 9?" } });
  const model = AssessmentDefinitionVersion as unknown as Record<string, unknown>;
  const original = model.create;
  let injected = false;
  await patchModelMethod(
    "create",
    async (...args) => {
      if (!injected) {
        injected = true;
        const error = new Error("duplicate version") as Error & { code: number };
        error.code = 11000;
        throw error;
      }
      return invokeOriginal(original, args);
    },
    async () => {
      const result = await publish(source._id);
      assert.equal(result.definition.version, 2);
    }
  );
  const stored = await versions(source._id);
  assert.deepEqual(stored.map((version) => version.version), [1, 2]);
  assert.equal(stored.filter((version) => version.status === "published").length, 1);
  assert.equal(first.definition.version, 1);
});

test("an aborted operation can be safely retried from the unchanged predecessor", async () => {
  const source = await createSourcePaper();
  const model = AssessmentDefinitionVersion as unknown as Record<string, unknown>;
  const original = model.create;
  let injected = true;
  await assert.rejects(
    () => patchModelMethod(
      "create",
      async (...args) => {
        if (injected) {
          injected = false;
          await invokeOriginal(original, args);
          throw new Error("abort after insert");
        }
        return invokeOriginal(original, args);
      },
      async () => { await publish(source._id); }
    ),
    /abort after insert/
  );
  assert.equal((await versions(source._id)).length, 0);
  const retry = await publish(source._id);
  assert.equal(retry.definition.version, 1);
  assert.equal((await getCurrentAssessmentDefinitionVersion({
    schoolId: SCHOOL_A,
    definitionKey: `exam-paper:${String(source._id)}`,
  }))?.status, "published");
});

test("historical versions remain immutable after atomic supersession", async () => {
  const source = await createSourcePaper();
  const first = await publish(source._id);
  await ExamQuestion.updateOne({ examPaperId: source._id }, { $set: { prompt: "What is 13 + 13?" } });
  await publish(source._id);
  const historical = await AssessmentDefinitionVersion.findById(first.definition._id);
  assert.ok(historical);
  historical.title = "tampered";
  await assert.rejects(() => historical.save(), /immutable/);
});

test("publication remains school scoped", async () => {
  const source = await createSourcePaper("School A question", SCHOOL_A);
  await assert.rejects(() => publish(source._id, SCHOOL_B), /Exam paper not found/);
  assert.equal((await versions(source._id)).length, 0);
});
