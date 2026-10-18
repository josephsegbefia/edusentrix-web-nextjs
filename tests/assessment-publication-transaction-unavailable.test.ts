import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { AssessmentDefinitionVersion } from "../src/models/AssessmentDefinitionVersion";
import { ExamPaper } from "../src/models/ExamPaper";
import { ExamPaperSection } from "../src/models/ExamPaperSection";
import { ExamQuestion } from "../src/models/ExamQuestion";
import {
  AssessmentDefinitionError,
  publishAssessmentDefinition,
} from "../src/lib/assess/assessment-definition-service";

let mongod: MongoMemoryServer;
const schoolId = new Types.ObjectId();
const adminId = new Types.ObjectId();

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "assessment_publication_standalone" });
  await Promise.all([
    AssessmentDefinitionVersion.createIndexes(),
    ExamPaper.createIndexes(),
    ExamPaperSection.createIndexes(),
    ExamQuestion.createIndexes(),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test("does not fall back to nontransactional publication on a standalone MongoDB", async () => {
  const academicPeriodId = new Types.ObjectId();
  const paper = await ExamPaper.create({
    schoolId,
    title: "Standalone transaction refusal",
    examTypeId: new Types.ObjectId(),
    academicYearId: academicPeriodId,
    academicPeriodId,
    scope: "class_group",
    gradeId: new Types.ObjectId(),
    classGroupIds: [new Types.ObjectId()],
    subjectId: new Types.ObjectId(),
    contributorIds: [],
    createdBy: adminId,
    ownerRole: "admin",
    totalMarks: 1,
    status: "approved",
    approvedAt: new Date(),
    approvedBy: adminId,
  });
  const section = await ExamPaperSection.create({
    schoolId,
    examPaperId: paper._id,
    title: "Section A",
    order: 0,
    marks: 1,
  });
  await ExamQuestion.create({
    schoolId,
    examPaperId: paper._id,
    sectionId: section._id,
    type: "short_answer",
    prompt: "Standalone question",
    plainTextPrompt: "Standalone question",
    marks: 1,
    difficulty: "easy",
    options: [],
    subQuestions: [],
    curriculumNodeIds: [],
    schemeItemIds: [],
    lessonIds: [],
    lessonNoteIds: [],
    expectedAnswer: "answer",
    markingGuide: "Award one mark.",
    attachments: [],
    order: 0,
    createdBy: adminId,
    source: "manual",
  });

  await assert.rejects(
    () => publishAssessmentDefinition({
      examPaperId: paper._id,
      actor: {
        userId: adminId,
        schoolId,
        isAdmin: true,
        premiumPublicationEntitled: true,
      },
      resultBinding: "none",
    }),
    (error: unknown) => {
      assert.ok(error instanceof AssessmentDefinitionError);
      assert.equal(error.status, 503);
      assert.match(error.message, /transaction-capable MongoDB deployment/);
      return true;
    }
  );
  assert.equal(await AssessmentDefinitionVersion.countDocuments({}), 0);
});
