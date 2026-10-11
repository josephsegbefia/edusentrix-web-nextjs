/**
 * Lesson-note approve / reject: conditional transition inside the transaction, stale decisions,
 * required reasons, durable feedback history, own-note maker-checker and school isolation.
 * Real route handler; auth context stubbed; in-memory MongoDB replica set only.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";
import {
  notifications,
  resetNotifications,
  signIn,
  stubApprovalRouteDeps,
} from "./helpers/stub-approval-route-deps";

stubApprovalRouteDeps();

type Ctx = { params: Promise<{ id: string }> };
type Handler = (req: unknown, ctx: Ctx) => Promise<Response>;

let replSet: MongoMemoryReplSet;
let NextRequestCtor: new (url: string, init?: Record<string, unknown>) => unknown;
let approvalPOST: Handler;
let approvalGET: Handler;
let LessonNote: mongoose.Model<any>;
let LessonNoteApproval: mongoose.Model<any>;
let Teacher: mongoose.Model<any>;
let User: mongoose.Model<any>;

const oid = () => new mongoose.Types.ObjectId();
const SCHOOL_A = oid();
const SCHOOL_B = oid();
const ADMIN = oid();

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGO_DB_NAME = "approvals_lesson_notes";
    ({ NextRequest: NextRequestCtor } = (await import("next/server")) as never);
    ({ POST: approvalPOST, GET: approvalGET } = (await import(
      "../../src/app/api/teacher/lesson-notes/[id]/approval/route"
    )) as never);
    ({ LessonNote } = await import("../../src/models/LessonNote"));
    ({ LessonNoteApproval } = await import("../../src/models/LessonNoteApproval"));
    ({ Teacher } = await import("../../src/models/Teacher"));
    ({ User } = await import("../../src/models/User"));
    disableAutoIndexing();
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
    await connectToDatabase();
    // Collections exist up front so transactions never race to create them.
    for (const name of mongoose.modelNames()) await mongoose.model(name).createCollection();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  for (const name of mongoose.modelNames()) await mongoose.model(name).deleteMany({});
  resetNotifications();
  signIn({ userId: ADMIN, schoolId: SCHOOL_A, roles: ["school_admin"] });
});

function post(body: unknown) {
  return new NextRequestCtor("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(id: unknown): Ctx {
  return { params: Promise.resolve({ id: String(id) }) };
}

async function seedTeacher(schoolId: mongoose.Types.ObjectId, userId = oid()) {
  await User.collection.insertOne({ _id: userId, email: `${userId}@example.test`, firstName: "Ama", lastName: "Mensah" });
  const teacherId = oid();
  await Teacher.collection.insertOne({ _id: teacherId, schoolId, userId });
  return teacherId;
}

async function seedNote(schoolId: mongoose.Types.ObjectId, teacherId: mongoose.Types.ObjectId, status = "submitted") {
  const _id = oid();
  await LessonNote.collection.insertOne({
    _id,
    schoolId,
    teacherId,
    classGroupId: oid(),
    weekOf: new Date(),
    topic: "Photosynthesis",
    status,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return _id;
}

async function json(res: Response) {
  return (await res.json()) as Record<string, any>;
}

describe("lesson-note decisions", () => {
  test("approve stores the feedback durably and the teacher can read it back", async () => {
    await User.collection.insertOne({ _id: ADMIN, email: "admin@example.test", firstName: "Esi", lastName: "Owusu" });
    const noteId = await seedNote(SCHOOL_A, await seedTeacher(SCHOOL_A));

    const res = await approvalPOST(post({ action: "approve", feedback: "  Clear objectives.  " }), ctx(noteId));
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.contractVersion, 2);
    assert.equal(body.data.status, "approved");

    const history = await LessonNoteApproval.find({ lessonNoteId: noteId }).lean<any[]>();
    assert.equal(history.length, 1);
    assert.equal(history[0].action, "approve");
    assert.equal(history[0].comment, "Clear objectives.");

    const status = await json(await approvalGET(new NextRequestCtor("http://localhost/x"), ctx(noteId)));
    assert.equal(status.contractVersion, 2);
    assert.equal(status.data.decisionHistory[0].comment, "Clear objectives.");
    assert.equal(status.data.decisionHistory[0].actorName, "Esi Owusu");
    assert.equal(status.data.canApprove, false);
    assert.equal(notifications().filter((n) => n.kind === "approved").length, 1);
  });

  test("concurrent decisions: exactly one succeeds, one history row, one notification", async () => {
    const noteId = await seedNote(SCHOOL_A, await seedTeacher(SCHOOL_A));
    const results = await Promise.all([
      approvalPOST(post({ action: "approve" }), ctx(noteId)),
      approvalPOST(post({ action: "approve" }), ctx(noteId)),
      approvalPOST(post({ action: "reject", reason: "Add assessment" }), ctx(noteId)),
      approvalPOST(post({ action: "reject", reason: "Add assessment" }), ctx(noteId)),
    ]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409, 409]);
    for (const r of results.filter((x) => x.status === 409)) {
      assert.equal((await json(r)).code, "stale_decision");
    }
    assert.equal(await LessonNoteApproval.countDocuments({ lessonNoteId: noteId }), 1);
    assert.equal(notifications().filter((n) => n.kind !== "submitted").length, 1);
  });

  test("the conditional write refuses a note decided after the route read it", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const noteId = await seedNote(SCHOOL_A, teacherId, "rejected");
    // The route's first read sees a stale "submitted" note; the database already says "rejected".
    const realFindOne = LessonNote.findOne.bind(LessonNote);
    let calls = 0;
    mock.method(LessonNote, "findOne", (...args: unknown[]) => {
      calls += 1;
      if (calls === 1) {
        const stale = { _id: noteId, teacherId, topic: "Photosynthesis", status: "submitted" };
        const chain = { select: () => chain, lean: async () => stale };
        return chain;
      }
      return realFindOne(...(args as [never]));
    });
    try {
      const res = await approvalPOST(post({ action: "approve" }), ctx(noteId));
      assert.equal(res.status, 409);
      const body = await json(res);
      assert.equal(body.code, "stale_decision");
      assert.equal(body.data.status, "rejected");
    } finally {
      mock.restoreAll();
    }
    assert.equal(await LessonNoteApproval.countDocuments({ lessonNoteId: noteId }), 0);
    assert.equal(notifications().length, 0);
    const note = await LessonNote.findById(noteId).lean<any>();
    assert.equal(note.status, "rejected");
  });

  test("deciding a note that is no longer submitted is 409 stale_decision", async () => {
    const noteId = await seedNote(SCHOOL_A, await seedTeacher(SCHOOL_A), "approved");
    const res = await approvalPOST(post({ action: "reject", reason: "Late" }), ctx(noteId));
    assert.equal(res.status, 409);
    const body = await json(res);
    assert.equal(body.code, "stale_decision");
    assert.equal(body.data.status, "approved");
  });

  test("a rejection reason made only of spaces is 400 reason_required", async () => {
    const noteId = await seedNote(SCHOOL_A, await seedTeacher(SCHOOL_A));
    for (const body of [{ action: "reject" }, { action: "reject", reason: "   " }]) {
      const res = await approvalPOST(post(body), ctx(noteId));
      assert.equal(res.status, 400);
      assert.equal((await json(res)).code, "reason_required");
    }
    const note = await LessonNote.findById(noteId).lean<any>();
    assert.equal(note.status, "submitted");
  });

  test("reject stores the trimmed reason on the note and in the history", async () => {
    const noteId = await seedNote(SCHOOL_A, await seedTeacher(SCHOOL_A));
    const res = await approvalPOST(post({ action: "reject", reason: "  Add an assessment.  " }), ctx(noteId));
    assert.equal(res.status, 200);
    const note = await LessonNote.findById(noteId).lean<any>();
    assert.equal(note.rejectionReason, "Add an assessment.");
    const history = await LessonNoteApproval.findOne({ lessonNoteId: noteId }).lean<any>();
    assert.equal(history.action, "reject");
    assert.equal(history.comment, "Add an assessment.");
  });

  test("an admin cannot decide a lesson note linked to their own teacher record", async () => {
    const noteId = await seedNote(SCHOOL_A, await seedTeacher(SCHOOL_A, ADMIN));
    const status = await json(await approvalGET(new NextRequestCtor("http://localhost/x"), ctx(noteId)));
    assert.equal(status.data.canApprove, false);
    assert.equal(status.data.decisionBlockedReason, "maker_checker");

    const res = await approvalPOST(post({ action: "approve" }), ctx(noteId));
    assert.equal(res.status, 409);
    assert.equal((await json(res)).code, "maker_checker_required");
    const note = await LessonNote.findById(noteId).lean<any>();
    assert.equal(note.status, "submitted");
  });

  test("another school's note is 404 and a malformed id is 400", async () => {
    const noteId = await seedNote(SCHOOL_B, await seedTeacher(SCHOOL_B));
    assert.equal((await approvalPOST(post({ action: "approve" }), ctx(noteId))).status, 404);
    assert.equal((await approvalPOST(post({ action: "approve" }), ctx("bad"))).status, 400);
    const note = await LessonNote.findById(noteId).lean<any>();
    assert.equal(note.status, "submitted");
  });

  test("signed out is 401", async () => {
    const noteId = await seedNote(SCHOOL_A, await seedTeacher(SCHOOL_A));
    signIn(null);
    assert.equal((await approvalPOST(post({ action: "approve" }), ctx(noteId))).status, 401);
  });
});

describe("lesson-note submit", () => {
  test("a teacher submits a draft and admins are notified with the teacher's name", async () => {
    const teacherUser = oid();
    const teacherId = await seedTeacher(SCHOOL_A, teacherUser);
    const noteId = await seedNote(SCHOOL_A, teacherId, "draft");
    signIn({ userId: teacherUser, schoolId: SCHOOL_A, roles: ["teacher"] });

    const res = await approvalPOST(post({ action: "submit" }), ctx(noteId));
    assert.equal(res.status, 200, "the submit branch reads the teacher's user record after the commit");
    assert.equal((await json(res)).data.status, "submitted");
    const note = await LessonNote.findById(noteId).lean<any>();
    assert.equal(note.status, "submitted");
    const submitted = notifications().filter((n) => n.kind === "submitted");
    assert.equal(submitted.length, 1);
    assert.equal((submitted[0].input as { teacherDisplayName: string }).teacherDisplayName, "Ama Mensah");
  });
});
