/**
 * Teacher leave decisions: conditional writes, stale decisions, school isolation,
 * required rejection reasons, guard passthrough and the detail route.
 * Real route handlers; auth context stubbed; in-memory MongoDB replica set only.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";
import { signIn, stubApprovalRouteDeps } from "./helpers/stub-approval-route-deps";

stubApprovalRouteDeps();

type Ctx = { params: Promise<{ id: string }> };
type Handler = (req: unknown, ctx?: Ctx) => Promise<Response>;

let replSet: MongoMemoryReplSet;
let NextRequestCtor: new (url: string, init?: Record<string, unknown>) => unknown;
let listGET: Handler;
let detailGET: Handler;
let approvePATCH: Handler;
let rejectPATCH: Handler;
let attendancePATCH: Handler;
let submitPOST: Handler;
let teacherLeaveGET: Handler;
let singleAttendancePOST: Handler;
let bulkAttendancePOST: Handler;
let models: {
  TeacherAttendance: mongoose.Model<any>;
  Teacher: mongoose.Model<any>;
  TeacherActivity: mongoose.Model<any>;
  User: mongoose.Model<any>;
};

const oid = () => new mongoose.Types.ObjectId();
const SCHOOL_A = oid();
const SCHOOL_B = oid();
const ADMIN = oid();
const OTHER_ADMIN = oid();
const THIRD_ADMIN = oid();
/** The administrator who submitted the seeded leave requests, unless a test says otherwise. */
const SUBMITTER = oid();

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGO_DB_NAME = "approvals_teacher_leave";
    ({ NextRequest: NextRequestCtor } = (await import("next/server")) as never);
    ({ GET: listGET } = (await import("../../src/app/api/admin/teachers/leave-requests/route")) as never);
    ({ GET: detailGET } = (await import("../../src/app/api/admin/teachers/leave-requests/[id]/route")) as never);
    ({ PATCH: approvePATCH } = (await import(
      "../../src/app/api/admin/teachers/leave-requests/[id]/approve/route"
    )) as never);
    ({ PATCH: rejectPATCH } = (await import(
      "../../src/app/api/admin/teachers/leave-requests/[id]/reject/route"
    )) as never);
    ({ PATCH: attendancePATCH } = (await import(
      "../../src/app/api/admin/teachers/attendance/[id]/route"
    )) as never);
    ({ POST: submitPOST, GET: teacherLeaveGET } = (await import(
      "../../src/app/api/admin/teachers/[id]/leave-requests/route"
    )) as never);
    ({ POST: singleAttendancePOST } = (await import(
      "../../src/app/api/admin/teachers/[id]/attendance/route"
    )) as never);
    ({ POST: bulkAttendancePOST } = (await import(
      "../../src/app/api/admin/teachers/attendance/route"
    )) as never);
    models = {
      TeacherAttendance: (await import("../../src/models/TeacherAttendance")).TeacherAttendance,
      Teacher: (await import("../../src/models/Teacher")).Teacher,
      TeacherActivity: (await import("../../src/models/TeacherActivity")).TeacherActivity,
      User: (await import("../../src/models/User")).User,
    };
    disableAutoIndexing();
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
    await connectToDatabase();
    for (const model of Object.values(models)) await model.createCollection();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  for (const model of Object.values(models)) await model.deleteMany({});
  signIn({ userId: ADMIN, schoolId: SCHOOL_A, roles: ["school_admin"] });
});

function req(url: string, init?: Record<string, unknown>) {
  return new NextRequestCtor(`http://localhost${url}`, init);
}

function ctx(id: string): Ctx {
  return { params: Promise.resolve({ id }) };
}

function patchJson(body: unknown) {
  return {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function seedTeacher(
  schoolId: mongoose.Types.ObjectId,
  firstName = "Ama",
  userId: mongoose.Types.ObjectId = oid()
) {
  await models.User.collection.insertOne({
    _id: userId,
    email: `${firstName.toLowerCase()}@example.test`,
    firstName,
    lastName: "Mensah",
  });
  const teacherId = oid();
  await models.Teacher.collection.insertOne({ _id: teacherId, schoolId, userId, department: "Science" });
  return teacherId;
}

async function seedLeave(
  schoolId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const _id = oid();
  const now = new Date();
  await models.TeacherAttendance.collection.insertOne({
    _id,
    schoolId,
    teacherId,
    date: new Date(Date.UTC(2026, 9, 12 + Math.floor(Math.random() * 300))),
    status: "on_leave",
    leaveType: "sick",
    reason: "Clinic appointment",
    notes: "PENDING",
    leaveRequest: { submittedBy: SUBMITTER, submittedAt: now, source: "leave_request" },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  return _id;
}

function postJson(body: unknown) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** Submits through the real leave-request route as the signed-in admin; returns the created row ids. */
async function submitLeave(teacherId: mongoose.Types.ObjectId, startDate: string, endDate = startDate, extra = {}) {
  const res = await submitPOST(
    req(`/x`, postJson({ startDate, endDate, leaveType: "sick", reason: "Clinic appointment", ...extra })),
    ctx(String(teacherId))
  );
  assert.equal(res.status, 200);
  return ((await json(res)).data.recordIds as string[]).map((id) => new mongoose.Types.ObjectId(id));
}

function actAs(userId: mongoose.Types.ObjectId, schoolId = SCHOOL_A) {
  signIn({ userId, schoolId, roles: ["school_admin"] });
}

async function json(res: Response) {
  return (await res.json()) as Record<string, any>;
}

describe("teacher leave approve / reject", () => {
  test("approve writes one decision and one activity", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);

    const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.contractVersion, 2);
    assert.equal(body.data.approvalStatus, "approved");

    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision.status, "approved");
    assert.equal(String(row.leaveDecision.decidedBy), String(ADMIN));
    assert.equal(row.notes, "APPROVED: Leave approved", "the old PENDING marker is not kept");
    assert.equal(await models.TeacherActivity.countDocuments({ type: "leave.approved" }), 1);
  });

  test("concurrent decisions: exactly one succeeds, the rest get 409, one activity", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);

    const results = await Promise.all([
      approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id))),
      approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id))),
      rejectPATCH(req(`/x`, patchJson({ rejectionReason: "Exams week" })), ctx(String(id))),
      rejectPATCH(req(`/x`, patchJson({ rejectionReason: "Exams week" })), ctx(String(id))),
    ]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409, 409]);
    for (const r of results.filter((x) => x.status === 409)) {
      assert.equal((await json(r)).code, "stale_decision");
    }
    const activities = await models.TeacherActivity.countDocuments({
      type: { $in: ["leave.approved", "leave.rejected"] },
    });
    assert.equal(activities, 1);
  });

  test("the conditional write refuses a row decided after it was read", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);
    const staleRow = await models.TeacherAttendance.findById(id).lean<any>();
    await models.TeacherAttendance.collection.updateOne(
      { _id: id },
      { $set: { notes: "REJECTED: decided elsewhere", leaveDecision: { status: "rejected" } } }
    );
    // The first read returns the row as it was before the other decision landed.
    const realFindOne = models.TeacherAttendance.findOne.bind(models.TeacherAttendance);
    let calls = 0;
    mock.method(models.TeacherAttendance, "findOne", (...args: unknown[]) => {
      calls += 1;
      if (calls === 1) return { lean: async () => staleRow };
      return realFindOne(...(args as [never]));
    });
    try {
      const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
      assert.equal(res.status, 409);
      assert.equal((await json(res)).data.approvalStatus, "rejected");
    } finally {
      mock.restoreAll();
    }
    assert.equal(await models.TeacherActivity.countDocuments({}), 0);
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.notes, "REJECTED: decided elsewhere");
  });

  test("a repeated or opposite decision is 409 stale_decision", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);
    assert.equal((await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)))).status, 200);

    const again = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(again.status, 409);
    const againBody = await json(again);
    assert.equal(againBody.code, "stale_decision");
    assert.equal(againBody.data.approvalStatus, "approved");

    const opposite = await rejectPATCH(req(`/x`, patchJson({ rejectionReason: "No" })), ctx(String(id)));
    assert.equal(opposite.status, 409);
  });

  test("a row decided under the legacy notes prefix is stale too", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId, { notes: "REJECTED: Not enough cover" });
    const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(res.status, 409);
    assert.equal((await json(res)).data.approvalStatus, "rejected");
  });

  test("another school's leave is 404 and is not changed", async () => {
    const teacherId = await seedTeacher(SCHOOL_B);
    const id = await seedLeave(SCHOOL_B, teacherId);
    const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(res.status, 404);
    assert.equal((await json(res)).code, "not_found");
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision, undefined);
  });

  test("a malformed id is 400 invalid_id", async () => {
    const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx("not-an-id"));
    assert.equal(res.status, 400);
    assert.equal((await json(res)).code, "invalid_id");
  });

  test("reject requires a reason after trimming and keeps the original notes", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId, { notes: "Covered by Mr Boateng" });

    for (const body of [{}, { rejectionReason: "" }, { rejectionReason: "   " }]) {
      const res = await rejectPATCH(req(`/x`, patchJson(body)), ctx(String(id)));
      assert.equal(res.status, 400);
      assert.equal((await json(res)).code, "reason_required");
    }
    const tooLong = await rejectPATCH(req(`/x`, patchJson({ rejectionReason: "x".repeat(501) })), ctx(String(id)));
    assert.equal(tooLong.status, 400);

    const ok = await rejectPATCH(req(`/x`, patchJson({ rejectionReason: "  Exams week  " })), ctx(String(id)));
    assert.equal(ok.status, 200);
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision.reason, "Exams week");
    assert.equal(row.notes, "REJECTED: Covered by Mr Boateng");
  });

  test("an administrator cannot decide their own leave; another administrator can", async () => {
    const teacherId = await seedTeacher(SCHOOL_A, "Ama", ADMIN);
    const id = await seedLeave(SCHOOL_A, teacherId);

    const approve = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(approve.status, 409);
    assert.equal((await json(approve)).code, "maker_checker_required");
    const reject = await rejectPATCH(req(`/x`, patchJson({ rejectionReason: "No" })), ctx(String(id)));
    assert.equal(reject.status, 409);
    assert.equal((await json(reject)).code, "maker_checker_required");
    let row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision, undefined);
    assert.equal(row.notes, "PENDING");
    assert.equal(await models.TeacherActivity.countDocuments({}), 0);

    const detail = await json(await detailGET(req(`/x`), ctx(String(id))));
    assert.equal(detail.data.decisionBlockedReason, "maker_checker");

    signIn({ userId: OTHER_ADMIN, schoolId: SCHOOL_A, roles: ["school_admin"] });
    const otherDetail = await json(await detailGET(req(`/x`), ctx(String(id))));
    assert.equal(otherDetail.data.decisionBlockedReason, null);
    const ok = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(ok.status, 200);
    row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision.status, "approved");
    assert.equal(String(row.leaveDecision.decidedBy), String(OTHER_ADMIN));
  });

  test("a non-admin is refused with 401 and nothing changes", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);
    for (const roles of [["teacher"], ["bursar"], ["billing_owner"]]) {
      signIn({ userId: OTHER_ADMIN, schoolId: SCHOOL_A, roles });
      const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
      assert.equal(res.status, 401, `role ${roles[0]}`);
    }
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision, undefined);
  });
});

describe("teacher leave list and detail", () => {
  test("guard failures keep their status instead of becoming 500", async () => {
    signIn(null);
    assert.equal((await listGET(req(`/api/admin/teachers/leave-requests`))).status, 401);
    signIn({ needsSchoolSelection: true });
    assert.equal((await listGET(req(`/api/admin/teachers/leave-requests`))).status, 409);
    signIn({ userId: ADMIN, schoolId: SCHOOL_A, roles: ["teacher"] });
    assert.equal((await listGET(req(`/api/admin/teachers/leave-requests`))).status, 401);
  });

  test("pending, approved and rejected filters use the decision record and the legacy prefix", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const pending = await seedLeave(SCHOOL_A, teacherId);
    await seedLeave(SCHOOL_A, teacherId, { notes: "APPROVED: legacy" });
    const decided = await seedLeave(SCHOOL_A, teacherId);
    await rejectPATCH(req(`/x`, patchJson({ rejectionReason: "No cover" })), ctx(String(decided)));
    await seedLeave(SCHOOL_B, await seedTeacher(SCHOOL_B, "Kofi"));

    const res = await listGET(req(`/api/admin/teachers/leave-requests?status=pending&page=abc&limit=xyz`));
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.contractVersion, 2);
    assert.deepEqual(
      body.data.map((r: any) => r.id),
      [String(pending)]
    );
    assert.equal(body.data[0].notes, null, "the PENDING marker is not shown as notes");
    assert.deepEqual(body.summary, { pending: 1, approved: 1, rejected: 1, total: 3 });
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 50);

    const rejected = await json(await listGET(req(`/api/admin/teachers/leave-requests?status=rejected`)));
    assert.equal(rejected.data[0].decision.rejectionReason, "No cover");
  });

  test("the list never shows another school's teacher details", async () => {
    const foreignTeacher = await seedTeacher(SCHOOL_B, "Kofi");
    await seedLeave(SCHOOL_A, foreignTeacher);
    const body = await json(await listGET(req(`/api/admin/teachers/leave-requests?status=pending`)));
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].teacher, null);
  });

  test("detail returns one leave in the school without email addresses", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);
    await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));

    const res = await detailGET(req(`/x`), ctx(String(id)));
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.contractVersion, 2);
    assert.equal(body.data.approvalStatus, "approved");
    assert.equal(body.data.teacher.fullName, "Ama Mensah");
    assert.ok(!JSON.stringify(body).includes("@"), "no email in the detail");

    const foreign = await seedLeave(SCHOOL_B, await seedTeacher(SCHOOL_B, "Kofi"));
    assert.equal((await detailGET(req(`/x`), ctx(String(foreign)))).status, 404);
    assert.equal((await detailGET(req(`/x`), ctx("zzz"))).status, 400);
  });
});

describe("attendance edits cannot forge or undo a decision", () => {
  test("notes starting with APPROVED: are refused", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);
    const res = await attendancePATCH(req(`/x`, patchJson({ notes: "approved: by me" })), ctx(String(id)));
    assert.equal(res.status, 400);
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.notes, "PENDING");
  });

  test("editing the notes of a legacy-decided row keeps its decision", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId, { notes: "APPROVED: Leave approved" });
    const res = await attendancePATCH(req(`/x`, patchJson({ notes: "Back on Monday" })), ctx(String(id)));
    assert.equal(res.status, 200);
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.notes, "APPROVED: Back on Monday");
  });
});

describe("leave requests: the requester cannot decide", () => {
  test("the submit route records the session user and ignores a client-supplied requester", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const ids = await submitLeave(teacherId, "2026-11-02", "2026-11-03", {
      leaveRequest: { submittedBy: String(OTHER_ADMIN), source: "backfill_leave_submitted" },
      submittedBy: String(OTHER_ADMIN),
    });
    assert.equal(ids.length, 2);
    for (const id of ids) {
      const row = await models.TeacherAttendance.findById(id).lean<any>();
      assert.equal(String(row.leaveRequest.submittedBy), String(ADMIN));
      assert.equal(row.leaveRequest.source, "leave_request");
      assert.ok(row.leaveRequest.submittedAt instanceof Date);
    }
  });

  test("the administrator who submitted a request cannot approve or reject it", async () => {
    await models.User.collection.insertOne({ _id: ADMIN, email: "efua@example.test", firstName: "Efua", lastName: "Owusu" });
    const teacherId = await seedTeacher(SCHOOL_A);
    const [id] = await submitLeave(teacherId, "2026-11-04");

    const approve = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(approve.status, 409);
    assert.equal((await json(approve)).code, "maker_checker_required");
    const reject = await rejectPATCH(req(`/x`, patchJson({ rejectionReason: "No cover" })), ctx(String(id)));
    assert.equal(reject.status, 409);
    assert.equal((await json(reject)).code, "maker_checker_required");

    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision, undefined);
    assert.equal(
      await models.TeacherActivity.countDocuments({ type: { $in: ["leave.approved", "leave.rejected"] } }),
      0
    );

    const detail = await json(await detailGET(req(`/x`), ctx(String(id))));
    assert.equal(detail.data.decisionBlockedReason, "maker_checker");
    const list = await json(await listGET(req(`/api/admin/teachers/leave-requests?status=pending`)));
    assert.equal(list.data[0].decisionBlockedReason, "maker_checker");
    assert.equal(list.data[0].requestedBy.name, "Efua Owusu");
    assert.ok(list.data[0].requestedAt);
    const perTeacher = await json(
      await teacherLeaveGET(req(`/x?status=pending`), ctx(String(teacherId)))
    );
    assert.equal(perTeacher.data[0].decisionBlockedReason, "maker_checker");
  });

  test("a second administrator sees no block and decides it", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const [id] = await submitLeave(teacherId, "2026-11-05");

    actAs(OTHER_ADMIN);
    const detail = await json(await detailGET(req(`/x`), ctx(String(id))));
    assert.equal(detail.data.decisionBlockedReason, null);
    const ok = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(ok.status, 200);
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision.status, "approved");
    assert.equal(String(row.leaveDecision.decidedBy), String(OTHER_ADMIN));
    assert.equal(String(row.leaveRequest.submittedBy), String(ADMIN), "the requester is kept with the decision");
  });

  test("the requester and another administrator race: only the other one wins", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId, {
      leaveRequest: { submittedBy: ADMIN, submittedAt: new Date(), source: "leave_request" },
    });

    actAs(ADMIN);
    const mine = approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    actAs(OTHER_ADMIN);
    const theirs = rejectPATCH(req(`/x`, patchJson({ rejectionReason: "Exams week" })), ctx(String(id)));
    const [mineRes, theirsRes] = await Promise.all([mine, theirs]);

    assert.equal(mineRes.status, 409);
    assert.ok(["maker_checker_required", "stale_decision"].includes((await json(mineRes)).code));
    assert.equal(theirsRes.status, 200);
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(String(row.leaveDecision.decidedBy), String(OTHER_ADMIN));
    assert.equal(
      await models.TeacherActivity.countDocuments({ type: { $in: ["leave.approved", "leave.rejected"] } }),
      1
    );
  });

  test("two administrators who did not submit it race: exactly one wins", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);

    actAs(OTHER_ADMIN);
    const first = approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    actAs(THIRD_ADMIN);
    const second = approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    const statuses = (await Promise.all([first, second])).map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(await models.TeacherActivity.countDocuments({ type: "leave.approved" }), 1);
  });

  test("the conditional write refuses when the requester turns out to be the caller", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);
    const readBefore = await models.TeacherAttendance.findById(id).lean<any>();
    await models.TeacherAttendance.collection.updateOne(
      { _id: id },
      { $set: { "leaveRequest.submittedBy": ADMIN } }
    );
    const realFindOne = models.TeacherAttendance.findOne.bind(models.TeacherAttendance);
    let calls = 0;
    mock.method(models.TeacherAttendance, "findOne", (...args: unknown[]) => {
      calls += 1;
      if (calls === 1) return { lean: async () => readBefore };
      return realFindOne(...(args as [never]));
    });
    try {
      const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
      assert.equal(res.status, 409);
      assert.equal((await json(res)).code, "maker_checker_required");
    } finally {
      mock.restoreAll();
    }
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision, undefined);
    assert.equal(await models.TeacherActivity.countDocuments({}), 0);
  });

  test("another school's administrator cannot see or decide the request", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);

    actAs(OTHER_ADMIN, SCHOOL_B);
    assert.equal((await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)))).status, 404);
    assert.equal((await detailGET(req(`/x`), ctx(String(id)))).status, 404);
    const list = await json(await listGET(req(`/api/admin/teachers/leave-requests?status=pending`)));
    assert.equal(list.data.length, 0);
    assert.equal(list.summary.pending, 0);
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveDecision, undefined);
  });
});

describe("routine attendance is not a leave request", () => {
  test("on_leave days recorded through attendance stay out of the queue and cannot be decided", async () => {
    const amaId = await seedTeacher(SCHOOL_A, "Ama");
    const kofiId = await seedTeacher(SCHOOL_A, "Kofi");

    const single = await singleAttendancePOST(
      req(`/x`, postJson({
        date: "2026-11-09",
        status: "on_leave",
        leaveType: "sick",
        reason: "Clinic",
        leaveRequest: { submittedBy: String(OTHER_ADMIN), submittedAt: new Date().toISOString(), source: "leave_request" },
      })),
      ctx(String(amaId))
    );
    assert.equal(single.status, 200);
    const bulk = await bulkAttendancePOST(
      req(`/x`, postJson({
        date: "2026-11-09",
        records: [{ teacherId: String(kofiId), status: "on_leave", leaveRequest: { submittedBy: String(OTHER_ADMIN) } }],
      }))
    );
    assert.equal(bulk.status, 200);

    const rows = await models.TeacherAttendance.find({ status: "on_leave" }).lean<any[]>();
    assert.equal(rows.length, 2);
    for (const row of rows) assert.equal(row.leaveRequest, undefined, "no requester from a request body");

    const list = await json(await listGET(req(`/api/admin/teachers/leave-requests`)));
    assert.equal(list.data.length, 0);
    assert.deepEqual(list.summary, { pending: 0, approved: 0, rejected: 0, total: 0 });

    actAs(OTHER_ADMIN);
    for (const row of rows) {
      const detail = await json(await detailGET(req(`/x`), ctx(String(row._id))));
      assert.equal(detail.data.decisionBlockedReason, "not_a_request");
      const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(row._id)));
      assert.equal(res.status, 409);
      assert.equal((await json(res)).code, "not_a_leave_request");
    }
    assert.equal(await models.TeacherActivity.countDocuments({ type: "leave.approved" }), 0);
  });

  test("an attendance PATCH cannot add a requester", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);
    await models.TeacherAttendance.collection.updateOne({ _id: id }, { $unset: { leaveRequest: "" } });
    const res = await attendancePATCH(
      req(`/x`, patchJson({ reason: "Updated", leaveRequest: { submittedBy: String(OTHER_ADMIN) } })),
      ctx(String(id))
    );
    assert.equal(res.status, 200);
    const row = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(row.leaveRequest, undefined);
  });

  test("recording attendance does not make the recorder the requester", async () => {
    const teacherId = await seedTeacher(SCHOOL_A);
    const id = await seedLeave(SCHOOL_A, teacherId);
    const row = await models.TeacherAttendance.findById(id).lean<any>();

    const bulk = await bulkAttendancePOST(
      req(`/x`, postJson({
        date: new Date(row.date).toISOString(),
        records: [{ teacherId: String(teacherId), status: "on_leave", notes: "Covered by Mr Boateng" }],
      }))
    );
    assert.equal(bulk.status, 200);
    const after = await models.TeacherAttendance.findById(id).lean<any>();
    assert.equal(String(after.recordedBy), String(ADMIN));
    assert.equal(String(after.leaveRequest.submittedBy), String(SUBMITTER));

    const res = await approvePATCH(req(`/x`, { method: "PATCH" }), ctx(String(id)));
    assert.equal(res.status, 200, "the recorder may decide a request someone else submitted");
  });
});
