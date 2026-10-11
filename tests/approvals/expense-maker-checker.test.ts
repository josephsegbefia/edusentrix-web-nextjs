/**
 * Expense approve / reject: strict maker-checker, conditional transition, stale decisions,
 * school isolation, validation and the detail's decisionBlockedReason.
 * Real route handlers; auth context stubbed; in-memory MongoDB replica set only.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";
import { signIn, stubApprovalRouteDeps } from "./helpers/stub-approval-route-deps";

stubApprovalRouteDeps();

type Ctx = { params: Promise<{ id: string }> };
type Handler = (req: unknown, ctx: Ctx) => Promise<Response>;

let replSet: MongoMemoryReplSet;
let NextRequestCtor: new (url: string, init?: Record<string, unknown>) => unknown;
let approvePOST: Handler;
let rejectPOST: Handler;
let detailGET: Handler;
let SchoolExpense: mongoose.Model<any>;
let Activity: mongoose.Model<any>;

const oid = () => new mongoose.Types.ObjectId();
const SCHOOL_A = oid();
const SCHOOL_B = oid();
const MAKER = oid();
const SUBMITTER = oid();
const CHECKER = oid();

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGO_DB_NAME = "approvals_expenses";
    ({ NextRequest: NextRequestCtor } = (await import("next/server")) as never);
    ({ POST: approvePOST } = (await import("../../src/app/api/admin/expenses/[id]/approve/route")) as never);
    ({ POST: rejectPOST } = (await import("../../src/app/api/admin/expenses/[id]/reject/route")) as never);
    ({ GET: detailGET } = (await import("../../src/app/api/admin/expenses/[id]/route")) as never);
    ({ SchoolExpense } = await import("../../src/models/SchoolExpense"));
    ({ Activity } = await import("../../src/models/Activity"));
    disableAutoIndexing();
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
    await connectToDatabase();
    for (const name of mongoose.modelNames()) await mongoose.model(name).createCollection();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await SchoolExpense.deleteMany({});
  await Activity.deleteMany({});
  signIn({ userId: CHECKER, schoolId: SCHOOL_A, roles: ["school_admin"] });
});

function post(body?: unknown) {
  return new NextRequestCtor("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(id: unknown): Ctx {
  return { params: Promise.resolve({ id: String(id) }) };
}

async function seedExpense(overrides: Record<string, unknown> = {}) {
  const _id = oid();
  await SchoolExpense.collection.insertOne({
    _id,
    schoolId: SCHOOL_A,
    expenseNumber: `EXP-${String(_id).slice(-6)}`,
    title: "Lab supplies",
    amountMinor: 125000,
    currency: "GHS",
    status: "submitted",
    createdBy: MAKER,
    submittedBy: SUBMITTER,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return _id;
}

async function json(res: Response) {
  return (await res.json()) as Record<string, any>;
}

describe("expense maker-checker", () => {
  test("the creator cannot approve or reject their own expense", async () => {
    const id = await seedExpense();
    signIn({ userId: MAKER, schoolId: SCHOOL_A, roles: ["school_admin"] });
    for (const res of [
      await approvePOST(post({}), ctx(id)),
      await rejectPOST(post({ reason: "Duplicate" }), ctx(id)),
    ]) {
      assert.equal(res.status, 409);
      assert.equal((await json(res)).code, "maker_checker_required");
    }
    const row = await SchoolExpense.findById(id).lean<any>();
    assert.equal(row.status, "submitted");
    assert.equal(await Activity.countDocuments({}), 0);
  });

  test("the submitter cannot decide it either, including as a bursar", async () => {
    const id = await seedExpense();
    signIn({ userId: SUBMITTER, schoolId: SCHOOL_A, roles: ["bursar"] });
    const res = await approvePOST(post({}), ctx(id));
    assert.equal(res.status, 409);
    assert.equal((await json(res)).code, "maker_checker_required");
  });

  test("a one-person school gets no exception", async () => {
    const id = await seedExpense({ createdBy: CHECKER, submittedBy: CHECKER });
    const res = await approvePOST(post({}), ctx(id));
    assert.equal(res.status, 409);
    assert.equal((await json(res)).code, "maker_checker_required");
  });

  test("another authorized person can approve, once", async () => {
    const id = await seedExpense();
    const res = await approvePOST(post({ note: "  Within budget " }), ctx(id));
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.data.status, "approved");
    const row = await SchoolExpense.findById(id).lean<any>();
    assert.equal(String(row.approvedBy), String(CHECKER));
    assert.equal(row.approvalNote, "Within budget");
    assert.equal(await Activity.countDocuments({ type: "expense.approved" }), 1);
  });

  test("concurrent decisions: exactly one succeeds and one activity is recorded", async () => {
    const id = await seedExpense();
    const results = await Promise.all([
      approvePOST(post({}), ctx(id)),
      approvePOST(post({}), ctx(id)),
      rejectPOST(post({ reason: "Over budget" }), ctx(id)),
      rejectPOST(post({ reason: "Over budget" }), ctx(id)),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409, 409]);
    for (const r of results.filter((x) => x.status === 409)) {
      assert.equal((await json(r)).code, "stale_decision");
    }
    assert.equal(
      await Activity.countDocuments({ type: { $in: ["expense.approved", "expense.rejected"] } }),
      1
    );
  });

  test("a decided expense is 409 stale_decision", async () => {
    const id = await seedExpense({ status: "approved" });
    const res = await rejectPOST(post({ reason: "Late" }), ctx(id));
    assert.equal(res.status, 409);
    const body = await json(res);
    assert.equal(body.code, "stale_decision");
    assert.equal(body.data.status, "approved");
  });

  test("another school's expense is 404; a malformed id is 400", async () => {
    const id = await seedExpense({ schoolId: SCHOOL_B });
    assert.equal((await approvePOST(post({}), ctx(id))).status, 404);
    const bad = await approvePOST(post({}), ctx("123"));
    assert.equal(bad.status, 400);
    assert.equal((await json(bad)).code, "invalid_id");
  });

  test("reject needs a reason; invalid JSON is a 400, not a 500", async () => {
    const id = await seedExpense();
    const blank = await rejectPOST(post({ reason: "  " }), ctx(id));
    assert.equal(blank.status, 400);
    assert.equal((await json(blank)).code, "reason_required");
    const broken = await rejectPOST(post("{not json"), ctx(id));
    assert.equal(broken.status, 400);
    const row = await SchoolExpense.findById(id).lean<any>();
    assert.equal(row.status, "submitted");
  });

  test("teachers and billing owners are refused", async () => {
    const id = await seedExpense();
    for (const roles of [["teacher"], ["billing_owner"], ["parent"]]) {
      signIn({ userId: oid(), schoolId: SCHOOL_A, roles });
      assert.equal((await approvePOST(post({}), ctx(id))).status, 401, `role ${roles[0]}`);
    }
  });

  test("the detail tells the maker why they cannot decide", async () => {
    const id = await seedExpense();
    signIn({ userId: MAKER, schoolId: SCHOOL_A, roles: ["school_admin"] });
    const mine = await json(await detailGET(new NextRequestCtor("http://localhost/x"), ctx(id)));
    assert.equal(mine.decisionBlockedReason, "maker_checker");
    signIn({ userId: CHECKER, schoolId: SCHOOL_A, roles: ["school_admin"] });
    const theirs = await json(await detailGET(new NextRequestCtor("http://localhost/x"), ctx(id)));
    assert.equal(theirs.decisionBlockedReason, null);
  });
});
