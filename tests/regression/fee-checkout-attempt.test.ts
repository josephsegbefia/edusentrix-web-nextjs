/**
 * Fail-closed, atomic fee checkout (startFeeCheckoutAttempt).
 *
 * Paystack verify/initialize are injected fakes: no real provider calls.
 * In-memory MongoDB replica set only; every outbound fetch is blocked.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, afterEach, before, beforeEach, describe, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { disableAutoIndexing } from "./helpers/disable-auto-indexing";
import { stubServerOnly } from "./helpers/stub-server-only";

stubServerOnly();

type Guard = typeof import("../../src/lib/fees/fee-checkout-guard");
type Models = {
  PaymentIntent: typeof import("../../src/models/PaymentIntent").PaymentIntent;
  PaymentCheckoutLock: typeof import("../../src/models/PaymentCheckoutLock").PaymentCheckoutLock;
  feeCheckoutLockKey: typeof import("../../src/models/PaymentCheckoutLock").feeCheckoutLockKey;
};

const DB_NAME = "fee_checkout_attempt";
const HOUR = 60 * 60 * 1000;

let replSet: MongoMemoryReplSet;
let guard: Guard;
let models: Models;
const externalCalls: string[] = [];

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    mock.method(globalThis, "fetch", async (input: unknown) => {
      externalCalls.push(String((input as { url?: string })?.url ?? input));
      throw new Error("regression harness: outbound fetch blocked");
    });
    guard = await import("../../src/lib/fees/fee-checkout-guard");
    const intentModule = await import("../../src/models/PaymentIntent");
    const lockModule = await import("../../src/models/PaymentCheckoutLock");
    disableAutoIndexing();
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
    await connectToDatabase();
    models = {
      PaymentIntent: intentModule.PaymentIntent,
      PaymentCheckoutLock: lockModule.PaymentCheckoutLock,
      feeCheckoutLockKey: lockModule.feeCheckoutLockKey,
    };
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  // The lock collection is deliberately not pre-created: the first checkout
  // must work when it is created implicitly inside the claiming transaction.
  await models.PaymentIntent.createIndexes();
});

afterEach(async () => {
  const intents = await models.PaymentIntent.find({});
  for (const intent of intents) {
    assert.equal(intent.validateSync(), undefined, `intent ${intent.status} must pass schema validation`);
  }
});

const oid = () => new mongoose.Types.ObjectId();

function obligation() {
  return { schoolId: oid(), studentId: oid(), invoiceId: oid() };
}

const intentFields = () => ({
  amountMinor: 50_000,
  platformFeeMinor: 0,
  parentPayableMinor: 50_000,
  payerMode: "school_absorbs" as const,
  currency: "GHS",
  initiatedBy: oid(),
});

function fakeInitialize(opts: { delayMs?: number; fail?: boolean } = {}) {
  const calls: Array<{ reference: string; paymentIntentId: mongoose.Types.ObjectId }> = [];
  const fn = async (args: { reference: string; paymentIntentId: mongoose.Types.ObjectId }) => {
    calls.push(args);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.fail) throw new Error("fake provider initialize failure");
    return { reference: args.reference, authorizationUrl: `https://checkout.test/${args.reference}` };
  };
  return Object.assign(fn, { calls });
}

function fakeVerify(result: string | Error) {
  const calls: string[] = [];
  const fn = async (reference: string) => {
    calls.push(reference);
    if (result instanceof Error) throw result;
    return { status: result };
  };
  return Object.assign(fn, { calls });
}

async function insertIntent(
  o: ReturnType<typeof obligation>,
  status: string,
  extra: Record<string, unknown> = {}
) {
  const id = oid();
  await mongoose.connection.db!.collection("paymentintents").insertOne({
    _id: id,
    ...o,
    amountMinor: 50_000,
    parentPayableMinor: 50_000,
    currency: "GHS",
    status,
    paymentMethod: "paystack",
    paystackReference: `EDSX-FEE-${id}-1`,
    idempotencyKey: crypto.randomUUID(),
    initiatedAt: new Date(),
    expiresAt: new Date(Date.now() + HOUR),
    createdAt: new Date(),
    ...extra,
  });
  return id;
}

function start(
  o: ReturnType<typeof obligation>,
  deps: { verify?: ReturnType<typeof fakeVerify>; initialize?: ReturnType<typeof fakeInitialize>; now?: Date } = {}
) {
  return guard.startFeeCheckoutAttempt({
    ...o,
    intentFields: intentFields(),
    verify: deps.verify ?? fakeVerify("ongoing"),
    initialize: deps.initialize ?? fakeInitialize(),
    now: deps.now,
  });
}

const statusOf = async (id: mongoose.Types.ObjectId) =>
  (await mongoose.connection.db!.collection("paymentintents").findOne({ _id: id }))?.status;

describe("simultaneous checkout", () => {
  test("10 parallel attempts for one invoice: one active attempt, one provider initialization", async () => {
    const o = obligation();
    const initialize = fakeInitialize({ delayMs: 150 });
    const results = await Promise.all(Array.from({ length: 10 }, () => start(o, { initialize })));

    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    assert.equal(winners.length, 1, JSON.stringify(results.map((r) => (r.ok ? "ok" : r.code))));
    assert.equal(initialize.calls.length, 1, "exactly one Paystack initialization");
    assert.ok(losers.every((r) => !r.ok && r.code === "checkout_in_progress"));

    const intents = await models.PaymentIntent.find({}).lean<Array<{ _id: mongoose.Types.ObjectId; status: string }>>();
    assert.equal(intents.length, 1, "exactly one intent persisted");
    assert.equal(intents[0].status, "awaiting_webhook");
    const lock = await models.PaymentCheckoutLock.findById(models.feeCheckoutLockKey(o.schoolId, o.invoiceId)).lean<{
      paymentIntentId: mongoose.Types.ObjectId;
    }>();
    assert.equal(String(lock?.paymentIntentId), String(intents[0]._id));
  });

  test("separate invoices stay independent under concurrency", async () => {
    const a = obligation();
    const b = { ...obligation(), schoolId: a.schoolId, studentId: a.studentId };
    const initialize = fakeInitialize({ delayMs: 50 });
    const [ra, rb] = await Promise.all([start(a, { initialize }), start(b, { initialize })]);
    assert.equal(ra.ok, true);
    assert.equal(rb.ok, true);
    assert.equal(initialize.calls.length, 2);
    assert.equal(await models.PaymentCheckoutLock.countDocuments({}), 2);
  });

  test("the reference is persisted on the intent before Paystack is initialized", async () => {
    const o = obligation();
    let seen: { status?: string; paystackReference?: string } | null = null;
    const result = await guard.startFeeCheckoutAttempt({
      ...o,
      intentFields: intentFields(),
      verify: fakeVerify("ongoing"),
      initialize: async ({ reference, paymentIntentId }) => {
        seen = await mongoose.connection
          .db!.collection<{ _id: mongoose.Types.ObjectId; status?: string; paystackReference?: string }>("paymentintents")
          .findOne({ _id: paymentIntentId });
        return { reference, authorizationUrl: "https://checkout.test" };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(seen!.status, "initiated");
    assert.equal(seen!.paystackReference, result.ok ? result.reference : undefined);
  });
});

describe("existing attempt for the same invoice", () => {
  test("awaiting_webhook + Paystack success blocks without creating an attempt", async () => {
    const o = obligation();
    await insertIntent(o, "awaiting_webhook");
    const initialize = fakeInitialize();
    const result = await start(o, { verify: fakeVerify("success"), initialize });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, "payment_pending_reconciliation");
    assert.equal(initialize.calls.length, 0);
    assert.equal(await models.PaymentIntent.countDocuments({}), 1);
  });

  for (const status of ["pending", "ongoing"]) {
    test(`awaiting_webhook + Paystack ${status} blocks until the attempt expires, then releases it`, async () => {
      const o = obligation();
      const id = await insertIntent(o, "awaiting_webhook");
      const blocked = await start(o, { verify: fakeVerify(status) });
      assert.equal(!blocked.ok && blocked.code, "payment_pending_verification");
      assert.equal(await statusOf(id), "awaiting_webhook");

      const later = await start(o, { verify: fakeVerify(status), now: new Date(Date.now() + 2 * HOUR) });
      assert.equal(later.ok, true);
      assert.equal(await statusOf(id), "expired");
    });
  }

  test("awaiting_webhook + verify error/timeout blocks for 24h, then releases as expired", async () => {
    const o = obligation();
    const id = await insertIntent(o, "awaiting_webhook");
    const initialize = fakeInitialize();
    const verify = fakeVerify(new Error("Paystack timeout"));

    const blocked = await start(o, { verify, initialize });
    assert.equal(!blocked.ok && blocked.code, "payment_status_unknown");
    assert.equal(initialize.calls.length, 0, "fails closed: no second charge");
    assert.equal(await statusOf(id), "awaiting_webhook", "unknown attempt is not altered");

    const stillBlocked = await start(o, { verify, initialize, now: new Date(Date.now() + 23 * HOUR) });
    assert.equal(!stillBlocked.ok && stillBlocked.code, "payment_status_unknown");

    const released = await start(o, { verify, initialize, now: new Date(Date.now() + 25 * HOUR) });
    assert.equal(released.ok, true, "not a permanent lock");
    assert.equal(await statusOf(id), "expired");
  });

  for (const status of ["failed", "abandoned"]) {
    test(`awaiting_webhook + Paystack ${status} is marked failed and checkout proceeds`, async () => {
      const o = obligation();
      const id = await insertIntent(o, "awaiting_webhook");
      const result = await start(o, { verify: fakeVerify(status) });
      assert.equal(result.ok, true);
      assert.equal(await statusOf(id), "failed");
    });
  }

  for (const status of ["failed", "expired", "cancelled", "succeeded"]) {
    test(`a ${status} attempt does not block and Paystack is not consulted`, async () => {
      const o = obligation();
      await insertIntent(o, status);
      const verify = fakeVerify("success");
      const result = await start(o, { verify });
      assert.equal(result.ok, true);
      assert.equal(verify.calls.length, 0);
    });
  }

  for (const status of ["reconciliation_required", "processing"]) {
    test(`a ${status} attempt blocks without consulting Paystack`, async () => {
      const o = obligation();
      await insertIntent(o, status, { expiresAt: null, initiatedAt: new Date(Date.now() - 30 * 24 * HOUR) });
      const verify = fakeVerify("failed");
      const result = await start(o, { verify });
      assert.equal(!result.ok && result.code, "payment_pending_reconciliation");
      assert.equal(verify.calls.length, 0);
    });
  }

  test("an attempt still initializing (initiated, under 2 minutes) blocks as checkout_in_progress", async () => {
    const o = obligation();
    const id = await insertIntent(o, "initiated");
    const verify = fakeVerify(new Error("not initialized yet"));
    const result = await start(o, { verify });
    assert.equal(!result.ok && result.code, "checkout_in_progress");
    assert.equal(verify.calls.length, 0);

    const afterGrace = await start(o, { verify, now: new Date(Date.now() + 10 * 60 * 1000) });
    assert.equal(!afterGrace.ok && afterGrace.code, "payment_status_unknown");
    const afterWindow = await start(o, { verify, now: new Date(Date.now() + 25 * HOUR) });
    assert.equal(afterWindow.ok, true);
    assert.equal(await statusOf(id), "expired");
  });

  test("a legacy active intent without any lock document still blocks", async () => {
    const o = obligation();
    await insertIntent(o, "awaiting_webhook");
    assert.equal(await models.PaymentCheckoutLock.countDocuments({}), 0);
    const result = await start(o, { verify: fakeVerify(new Error("provider down")) });
    assert.equal(!result.ok && result.code, "payment_status_unknown");
    assert.equal(await models.PaymentCheckoutLock.countDocuments({}), 0, "no slot claimed while blocked");
  });

  test("an unmatched-charge reconciliation record for the invoice blocks checkout", async () => {
    const o = obligation();
    await insertIntent(o, "reconciliation_required", {
      reconciliationReason: "amount_mismatch",
      reconciliationDetails: { unmatchedCharge: true },
    });
    const result = await start(o);
    assert.equal(!result.ok && result.code, "payment_pending_reconciliation");
  });
});

describe("sequential attempts through the lock", () => {
  test("a live attempt blocks the next one; once it fails at Paystack the slot is taken over", async () => {
    const o = obligation();
    const first = await start(o);
    assert.equal(first.ok, true);

    const second = await start(o, { verify: fakeVerify("ongoing") });
    assert.equal(!second.ok && second.code, "payment_pending_verification");

    const third = await start(o, { verify: fakeVerify("abandoned") });
    assert.equal(third.ok, true);
    assert.equal(first.ok && (await statusOf(first.paymentIntentId)), "failed");
    const lock = await models.PaymentCheckoutLock.findById(models.feeCheckoutLockKey(o.schoolId, o.invoiceId)).lean<{
      paymentIntentId: mongoose.Types.ObjectId;
    }>();
    assert.equal(String(lock?.paymentIntentId), third.ok ? String(third.paymentIntentId) : "");
  });

  test("initialize failure marks the attempt failed and the next checkout proceeds", async () => {
    const o = obligation();
    await assert.rejects(start(o, { initialize: fakeInitialize({ fail: true }) }), /fake provider initialize failure/);
    const [failed] = await models.PaymentIntent.find({}).lean<Array<{ _id: mongoose.Types.ObjectId; status: string }>>();
    assert.equal(failed.status, "failed");

    const retry = await start(o);
    assert.equal(retry.ok, true);
  });
});

describe("outbound call safety", () => {
  test("no real external HTTP call was attempted", () => {
    assert.deepEqual(externalCalls, []);
  });
});
