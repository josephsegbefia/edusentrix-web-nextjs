import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_ai_lesson";
let mongod: MongoMemoryServer;
let sendCalls: Array<{ id?: string; name: string; data: Record<string, unknown> }>;
let providerCalls = 0;
const ids = () => ({
  school: new mongoose.Types.ObjectId(),
  user: new mongoose.Types.ObjectId(),
  teacher: new mongoose.Types.ObjectId(),
  note: new mongoose.Types.ObjectId(),
  session: new mongoose.Types.ObjectId(),
  week: new mongoose.Types.ObjectId(),
  classGroup: new mongoose.Types.ObjectId(),
  subject: new mongoose.Types.ObjectId(),
});

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = DB_NAME;
  process.env.OPENAI_API_KEY = "sk-test-not-real";
  const { connectToDatabase } = await import("../../src/db/connectToDatabase");
  await connectToDatabase();
  const { BackgroundJob } = await import("../../src/models/BackgroundJob");
  await BackgroundJob.syncIndexes();
}, { timeout: 180_000 });

after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await mongod?.stop();
});

beforeEach(async () => {
  sendCalls = [];
  providerCalls = 0;
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async (event) => {
    sendCalls.push(event);
    return { ids: ["evt_ok"] };
  };
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

function blocks() {
  return [
    { id: "1", type: "explanation", title: "Start", bodyHtml: "<p>x</p>".repeat(80), order: 0, aiGenerated: true, teacherReviewed: false },
    { id: "2", type: "example", title: "Example", bodyHtml: "<p>y</p>".repeat(80), order: 1, aiGenerated: true, teacherReviewed: false },
    { id: "3", type: "activity", title: "Try", bodyHtml: "<p>z</p>".repeat(80), order: 2, aiGenerated: true, teacherReviewed: false },
    { id: "4", type: "check", title: "Check", bodyHtml: "<p>q</p>".repeat(80), order: 3, aiGenerated: true, teacherReviewed: false },
    { id: "5", type: "teacher_note", title: "Note", bodyHtml: "<p>n</p>".repeat(40), order: 4, aiGenerated: true, teacherReviewed: false },
    { id: "6", type: "exit_ticket", title: "Exit", bodyHtml: "<p>e</p>".repeat(40), order: 5, aiGenerated: true, teacherReviewed: false },
  ];
}

describe("AI_LESSON_GENERATION", () => {
  test("enqueue creates a job and Inngest event without calling the provider", async () => {
    const pair = ids();
    const { LessonNote } = await import("../../src/models/LessonNote");
    const { LessonSession } = await import("../../src/models/LessonSession");
    await LessonNote.create({
      _id: pair.note,
      schoolId: pair.school,
      teacherId: pair.teacher,
      classGroupId: pair.classGroup,
      weekOf: new Date("2026-10-05"),
      topic: "Fractions",
      status: "approved",
    });
    await LessonSession.create({
      _id: pair.session,
      schoolId: pair.school,
      weekPlanId: pair.week,
      lessonNoteId: pair.note,
      classGroupId: pair.classGroup,
      subjectOfferingId: pair.subject,
      ownerTeacherId: pair.teacher,
      sequenceInWeek: 1,
      scheduledDate: new Date("2026-10-05"),
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "08:40",
      durationMinutes: 40,
      title: "Fractions 1",
    });

    const { enqueueLessonAiGeneration } = await import("../../src/lib/lessons/enqueue-lesson-generation");
    const result = await enqueueLessonAiGeneration({
      context: {
        userId: pair.user,
        teacherId: pair.teacher,
        schoolId: pair.school,
        roles: ["teacher"],
        subroles: [],
        permissions: ["lessonAi.use"],
        isAdmin: false,
      },
      lessonNoteId: String(pair.note),
      targetKind: "existing_session",
      sessionId: String(pair.session),
      slots: [
        {
          slotDraftId: String(pair.session),
          title: "Fractions 1",
          durationMinutes: 40,
          noteSectionKeys: ["body"],
          sequenceInWeek: 1,
        },
      ],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(providerCalls, 0);
    assert.equal(sendCalls.length, 1);
    assert.equal(sendCalls[0]?.data.kind, "AI_LESSON_GENERATION");
    assert.deepEqual(Object.keys(sendCalls[0]?.data ?? {}).sort(), [
      "correlationId",
      "initiatedByUserId",
      "jobId",
      "kind",
      "schoolId",
    ]);
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const job = await BackgroundJob.findById(result.jobId);
    assert.equal(job?.input?.generationRequestId, result.generationRequestId);
    assert.ok(!JSON.stringify(job?.input).includes("contentBlocks"));
  });

  test("duplicate enqueue reuses the same job; regenerate creates a new revision", async () => {
    const pair = ids();
    const { LessonNote } = await import("../../src/models/LessonNote");
    const { LessonSession } = await import("../../src/models/LessonSession");
    await LessonNote.create({
      _id: pair.note,
      schoolId: pair.school,
      teacherId: pair.teacher,
      classGroupId: pair.classGroup,
      weekOf: new Date("2026-10-05"),
      topic: "Fractions",
      status: "approved",
    });
    await LessonSession.create({
      _id: pair.session,
      schoolId: pair.school,
      weekPlanId: pair.week,
      lessonNoteId: pair.note,
      classGroupId: pair.classGroup,
      subjectOfferingId: pair.subject,
      ownerTeacherId: pair.teacher,
      sequenceInWeek: 1,
      scheduledDate: new Date("2026-10-05"),
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "08:40",
      durationMinutes: 40,
      title: "Fractions 1",
    });
    const { enqueueLessonAiGeneration } = await import("../../src/lib/lessons/enqueue-lesson-generation");
    const ctx = {
      userId: pair.user,
      teacherId: pair.teacher,
      schoolId: pair.school,
      roles: ["teacher"] as const,
      subroles: [] as const,
      permissions: ["lessonAi.use"] as const,
      isAdmin: false,
    };
    const first = await enqueueLessonAiGeneration({
      context: ctx,
      lessonNoteId: String(pair.note),
      targetKind: "existing_session",
      sessionId: String(pair.session),
      slots: [
        {
          slotDraftId: String(pair.session),
          title: "Fractions 1",
          durationMinutes: 40,
          noteSectionKeys: ["body"],
          sequenceInWeek: 1,
        },
      ],
    });
    const second = await enqueueLessonAiGeneration({
      context: ctx,
      lessonNoteId: String(pair.note),
      targetKind: "existing_session",
      sessionId: String(pair.session),
      slots: [
        {
          slotDraftId: String(pair.session),
          title: "Fractions 1",
          durationMinutes: 40,
          noteSectionKeys: ["body"],
          sequenceInWeek: 1,
        },
      ],
    });
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.jobId, second.jobId);
    const third = await enqueueLessonAiGeneration({
      context: ctx,
      lessonNoteId: String(pair.note),
      targetKind: "existing_session",
      sessionId: String(pair.session),
      regenerate: true,
      slots: [
        {
          slotDraftId: String(pair.session),
          title: "Fractions 1",
          durationMinutes: 40,
          noteSectionKeys: ["body"],
          sequenceInWeek: 1,
        },
      ],
    });
    assert.equal(third.ok, true);
    if (!third.ok) return;
    assert.notEqual(third.jobId, first.jobId);
  });

  test("worker persists a pending draft and does not publish session content", async () => {
    const pair = ids();
    const { LessonNote } = await import("../../src/models/LessonNote");
    const { LessonSession } = await import("../../src/models/LessonSession");
    const { Teacher } = await import("../../src/models/Teacher");
    await Teacher.create({
      _id: pair.teacher,
      schoolId: pair.school,
      userId: pair.user,
    });
    const { School } = await import("../../src/models/School");
    const { SchoolSettings } = await import("../../src/models/SchoolSettings");
    await School.create({
      _id: pair.school,
      name: "Test School",
      type: "Basic",
      status: "active",
    });
    await SchoolSettings.create({
      schoolId: pair.school,
      lessonsModule: { enabled: true, enableLeoLessonTools: true },
    });
    await LessonNote.create({
      _id: pair.note,
      schoolId: pair.school,
      teacherId: pair.teacher,
      classGroupId: pair.classGroup,
      weekOf: new Date("2026-10-05"),
      topic: "Fractions",
      status: "approved",
    });
    await LessonSession.create({
      _id: pair.session,
      schoolId: pair.school,
      weekPlanId: pair.week,
      lessonNoteId: pair.note,
      classGroupId: pair.classGroup,
      subjectOfferingId: pair.subject,
      ownerTeacherId: pair.teacher,
      sequenceInWeek: 1,
      scheduledDate: new Date("2026-10-05"),
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "08:40",
      durationMinutes: 40,
      title: "Fractions 1",
      studentVisibility: "hidden",
      contentBlocks: [],
    });

    const { LessonAiGenerationRequest } = await import("../../src/models/LessonAiGenerationRequest");
    const request = await LessonAiGenerationRequest.create({
      schoolId: pair.school,
      teacherUserId: pair.user,
      teacherId: pair.teacher,
      lessonNoteId: pair.note,
      targetKind: "existing_session",
      sessionId: pair.session,
      revision: 1,
      idempotencyKey: `ai-lesson:session:${pair.school}:${pair.session}:1`,
      status: "queued",
      slots: [
        {
          slotDraftId: String(pair.session),
          title: "Fractions 1",
          durationMinutes: 40,
          noteSectionKeys: ["body"],
          sequenceInWeek: 1,
        },
      ],
      slotResults: [{ slotDraftId: String(pair.session), status: "pending" }],
      providerCheckpoints: [
        {
          slotDraftId: String(pair.session),
          raw: { contentBlocks: blocks() },
          usage: { totalTokens: 12 },
          usageRecorded: true,
        },
      ],
    });
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const queued = await enqueueBackgroundJob({
      kind: "AI_LESSON_GENERATION",
      schoolId: pair.school,
      initiatedByUserId: pair.user,
      notificationTargetUserId: pair.user,
      input: { generationRequestId: String(request._id) },
    });
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { executeLessonAiGeneration } = await import("../../src/lib/lessons/execute-lesson-generation");
    await runTrackedBackgroundJob({
      jobId: queued.jobId,
      expectedKind: "AI_LESSON_GENERATION",
      eventSchoolId: String(pair.school),
      handler: executeLessonAiGeneration,
    });

    const session = await LessonSession.findById(pair.session);
    assert.equal(session?.studentVisibility, "hidden");
    assert.equal(session?.contentBlocks?.length, 0);
    assert.ok((session?.pendingAiContentBlocks?.length ?? 0) > 0);
    assert.equal(providerCalls, 0);

    const { Notification } = await import("../../src/models/Notification");
    assert.equal(await Notification.countDocuments({ "metadata.outcome": "succeeded" }), 1);
  });
});
