/**
 * Backfill of the leave requester from the `leave.submitted` audit record: unique matches only,
 * a read-only plan, conditional writes, and a rollback that keeps decided rows intact.
 * In-memory MongoDB replica set only.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";
import { stubApprovalRouteDeps } from "./helpers/stub-approval-route-deps";

stubApprovalRouteDeps();

let memory: MongoMemoryReplSet;
let TeacherAttendance: mongoose.Model<any>;
let TeacherActivity: mongoose.Model<any>;
let backfill: typeof import("../../src/lib/teachers/leave-request-backfill");

const oid = () => new mongoose.Types.ObjectId();
const SCHOOL = oid();
const OTHER_SCHOOL = oid();
const SUBMITTER = oid();
const T0 = new Date("2026-10-05T09:00:00.000Z");

before(
  async () => {
    memory = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = memory.getUri();
    process.env.MONGO_DB_NAME = "approvals_leave_backfill";
    ({ TeacherAttendance } = await import("../../src/models/TeacherAttendance"));
    ({ TeacherActivity } = await import("../../src/models/TeacherActivity"));
    backfill = await import("../../src/lib/teachers/leave-request-backfill");
    disableAutoIndexing();
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
    await connectToDatabase();
    await TeacherAttendance.createCollection();
    await TeacherActivity.createCollection();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await memory.stop();
});

beforeEach(async () => {
  await TeacherAttendance.deleteMany({});
  await TeacherActivity.deleteMany({});
});

function day(n: number) {
  return new Date(Date.UTC(2026, 9, 12 + n));
}

async function seedRow(teacherId: mongoose.Types.ObjectId, date: Date, extra: Record<string, unknown> = {}) {
  const _id = oid();
  await TeacherAttendance.collection.insertOne({
    _id,
    schoolId: SCHOOL,
    teacherId,
    date,
    status: "on_leave",
    leaveType: "sick",
    reason: "Clinic appointment",
    createdAt: T0,
    updatedAt: T0,
    ...extra,
  });
  return _id;
}

async function seedSubmitted(
  teacherId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
  extra: Record<string, unknown> = {}
) {
  const _id = oid();
  await TeacherActivity.collection.insertOne({
    _id,
    schoolId: SCHOOL,
    teacherId,
    type: "leave.submitted",
    title: "Leave request submitted",
    metadata: { startDate: start.toISOString(), endDate: end.toISOString(), submittedBy: String(SUBMITTER) },
    createdBy: SUBMITTER,
    createdAt: new Date(T0.getTime() + 500),
    updatedAt: T0,
    ...extra,
  });
  return _id;
}

describe("leave requester backfill", () => {
  test("a row covered by exactly one audit record is matched; the plan writes nothing", async () => {
    const teacherId = oid();
    const first = await seedRow(teacherId, day(0));
    const second = await seedRow(teacherId, day(1));
    const activityId = await seedSubmitted(teacherId, day(0), day(1));

    const plan = await backfill.planLeaveRequestBackfill();
    assert.equal(plan.scanned, 2);
    assert.deepEqual(
      plan.matched.map((m) => m.attendanceId).sort(),
      [String(first), String(second)].sort()
    );
    assert.ok(plan.matched.every((m) => m.submittedBy === String(SUBMITTER) && m.activityId === String(activityId)));
    assert.equal(await TeacherAttendance.countDocuments({ leaveRequest: { $exists: true } }), 0);
  });

  test("rows with no audit record, two audit records, a far-off record or a bad submitter are skipped", async () => {
    const lonely = oid();
    await seedRow(lonely, day(0));

    const doubled = oid();
    await seedRow(doubled, day(0));
    await seedSubmitted(doubled, day(0), day(0));
    await seedSubmitted(doubled, day(0), day(2));

    const late = oid();
    await seedRow(late, day(0));
    await seedSubmitted(late, day(0), day(0), { createdAt: new Date(T0.getTime() + 10 * 60 * 1000) });

    const mismatched = oid();
    await seedRow(mismatched, day(0));
    await seedSubmitted(mismatched, day(0), day(0), { createdBy: oid() });

    const outside = oid();
    await seedRow(outside, day(5));
    await seedSubmitted(outside, day(0), day(1));

    const plan = await backfill.planLeaveRequestBackfill();
    assert.equal(plan.matched.length, 0);
    assert.deepEqual(plan.skipped, { no_audit_record: 3, ambiguous: 1, invalid_submitter: 1 });
  });

  test("decided rows, rows that already have a requester and present days are not scanned", async () => {
    const teacherId = oid();
    await seedRow(teacherId, day(0), { leaveDecision: { status: "approved", decidedBy: oid(), decidedAt: T0 } });
    await seedRow(teacherId, day(1), { notes: "REJECTED: No cover" });
    await seedRow(teacherId, day(2), {
      leaveRequest: { submittedBy: oid(), submittedAt: T0, source: "leave_request" },
    });
    await seedRow(teacherId, day(3), { status: "present" });
    await seedSubmitted(teacherId, day(0), day(3));

    const plan = await backfill.planLeaveRequestBackfill();
    assert.equal(plan.scanned, 0);
  });

  test("the school filter limits the scan", async () => {
    const teacherId = oid();
    await seedRow(teacherId, day(0));
    await seedSubmitted(teacherId, day(0), day(0));
    assert.equal((await backfill.planLeaveRequestBackfill({ schoolId: OTHER_SCHOOL })).scanned, 0);
    assert.equal((await backfill.planLeaveRequestBackfill({ schoolId: SCHOOL })).matched.length, 1);
  });

  test("apply writes only still-pending rows; rollback undoes pending ones and keeps decided ones", async () => {
    const teacherId = oid();
    const kept = await seedRow(teacherId, day(0));
    const decidedMeanwhile = await seedRow(teacherId, day(1));
    const changedMeanwhile = await seedRow(teacherId, day(2));
    await seedSubmitted(teacherId, day(0), day(2));

    const plan = await backfill.planLeaveRequestBackfill();
    assert.equal(plan.matched.length, 3);
    await TeacherAttendance.collection.updateOne(
      { _id: changedMeanwhile },
      { $set: { leaveDecision: { status: "rejected", decidedBy: oid(), decidedAt: T0 } } }
    );

    const written = await backfill.applyLeaveRequestBackfill(plan.matched);
    assert.deepEqual(written.map((w) => w.attendanceId).sort(), [String(kept), String(decidedMeanwhile)].sort());
    const keptRow = await TeacherAttendance.findById(kept).lean<any>();
    assert.equal(String(keptRow.leaveRequest.submittedBy), String(SUBMITTER));
    assert.equal(keptRow.leaveRequest.source, "backfill_leave_submitted");
    assert.equal((await TeacherAttendance.findById(changedMeanwhile).lean<any>()).leaveRequest, undefined);

    assert.equal((await backfill.applyLeaveRequestBackfill(plan.matched)).length, 0, "a second apply writes nothing");

    await TeacherAttendance.collection.updateOne(
      { _id: decidedMeanwhile },
      { $set: { leaveDecision: { status: "approved", decidedBy: oid(), decidedAt: T0 } } }
    );
    const rollback = await backfill.rollbackLeaveRequestBackfill(written);
    assert.deepEqual(rollback, { restored: 1, notRestored: 1 });
    assert.equal((await TeacherAttendance.findById(kept).lean<any>()).leaveRequest, undefined);
    const decidedRow = await TeacherAttendance.findById(decidedMeanwhile).lean<any>();
    assert.equal(String(decidedRow.leaveRequest.submittedBy), String(SUBMITTER));
  });
});
