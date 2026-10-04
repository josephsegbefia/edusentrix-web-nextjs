/**
 * Verification harness for docs/FINANCIAL_BACKGROUND_FINDINGS_VERIFICATION.md.
 *
 * Not part of `npm test` (the glob there is tests/**\/*.test.ts). Run explicitly:
 *   node --test --conditions=react-server --import tsx tests/verification/financial-findings.verify.ts
 *
 * Uses an in-memory MongoDB replica set only. No production data, no real
 * Paystack / Resend / Clerk calls.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connectToDatabase } from "../../src/db/connectToDatabase";
import { Invoice } from "../../src/models/Invoice";
import { InvoiceLineItem } from "../../src/models/InvoiceLineItem";
import { InvoiceEvent } from "../../src/models/InvoiceEvent";
import { PaymentIntent } from "../../src/models/PaymentIntent";
import { Payment } from "../../src/models/Payment";
import { StudentCreditBalance } from "../../src/models/StudentCreditBalance";
import { generateInvoiceNumber } from "../../src/lib/fees/invoice-utils";

const DB_NAME = "financial_findings_verify";
const PAYSTACK_TEST_SECRET = "sk_test_verification_only_not_a_real_key";

let replSet: MongoMemoryReplSet;
const findings: Record<string, unknown> = {};

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3999";
    await connectToDatabase();
  },
  { timeout: 180_000 }
);

after(async () => {
  console.log("\n=== VERIFICATION FINDINGS ===\n" + JSON.stringify(findings, null, 2));
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

const oid = () => new mongoose.Types.ObjectId();
const isDuplicateKey = (e: unknown) =>
  Boolean(e && typeof e === "object" && (e as { code?: number }).code === 11000);
const errSummary = (e: unknown) => {
  const err = e as { code?: number; codeName?: string; message?: string; errorLabelSet?: Set<string> };
  return {
    code: err?.code ?? null,
    codeName: err?.codeName ?? null,
    labels: err?.errorLabelSet ? [...err.errorLabelSet] : [],
    message: String(err?.message ?? e).slice(0, 160),
  };
};

function invoiceDoc(schoolId: mongoose.Types.ObjectId, studentId: mongoose.Types.ObjectId, periodId: mongoose.Types.ObjectId, invoiceNumber: string) {
  return {
    schoolId,
    studentId,
    academicPeriodId: periodId,
    invoiceNumber,
    status: "draft",
    totalAmountMinor: 0,
    totalPaidMinor: 0,
    totalOutstandingMinor: 0,
    totalCreditAppliedMinor: 0,
    version: 1,
    dueDate: new Date(),
  };
}

/** A barrier that holds each first-attempt caller until `size` callers have counted. */
function makeBarrier(size: number) {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return async () => {
    arrived += 1;
    if (arrived >= size) release();
    await gate;
  };
}

/**
 * Mirrors POST src/app/api/admin/fees/invoices/route.ts (single create):
 * session.withTransaction -> countDocuments({ schoolId }) -> generateInvoiceNumber(year, count + 1) -> Invoice.create.
 */
async function createLikeSingleRoute(args: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  periodId: mongoose.Types.ObjectId;
  barrier?: () => Promise<void>;
}) {
  const session = await mongoose.startSession();
  let attempts = 0;
  const numbersTried: string[] = [];
  try {
    await session.withTransaction(async () => {
      attempts += 1;
      const year = new Date().getFullYear();
      const count = await Invoice.countDocuments({ schoolId: args.schoolId }).session(session);
      const invoiceNumber = generateInvoiceNumber(year, count + 1);
      numbersTried.push(invoiceNumber);
      if (attempts === 1 && args.barrier) await args.barrier();
      await Invoice.create([invoiceDoc(args.schoolId, args.studentId, args.periodId, invoiceNumber)], { session });
    });
    return { ok: true as const, attempts, numbersTried };
  } catch (error) {
    return { ok: false as const, attempts, numbersTried, error: errSummary(error), duplicateKey: isDuplicateKey(error) };
  } finally {
    await session.endSession();
  }
}

/**
 * Mirrors POST src/app/api/admin/fees/invoices/bulk/route.ts:
 * manual startTransaction -> countDocuments once -> count + i + 1 per student -> commit / abort (no retry).
 */
async function createLikeBulkRoute(args: {
  schoolId: mongoose.Types.ObjectId;
  studentIds: mongoose.Types.ObjectId[];
  periodId: mongoose.Types.ObjectId;
  barrier?: () => Promise<void>;
}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  const numbers: string[] = [];
  try {
    const year = new Date().getFullYear();
    const count = await Invoice.countDocuments({ schoolId: args.schoolId }).session(session);
    if (args.barrier) await args.barrier();
    for (let i = 0; i < args.studentIds.length; i++) {
      const invoiceNumber = generateInvoiceNumber(year, count + i + 1);
      numbers.push(invoiceNumber);
      await Invoice.create([invoiceDoc(args.schoolId, args.studentIds[i], args.periodId, invoiceNumber)], { session });
    }
    await session.commitTransaction();
    return { ok: true as const, numbers };
  } catch (error) {
    await session.abortTransaction().catch(() => undefined);
    return { ok: false as const, numbers, error: errSummary(error), duplicateKey: isDuplicateKey(error) };
  } finally {
    await session.endSession();
  }
}

async function numbersPersisted(schoolId?: mongoose.Types.ObjectId) {
  const rows = await Invoice.find(schoolId ? { schoolId } : {}).select("schoolId invoiceNumber").lean();
  return rows.map((r: any) => `${String(r.schoolId).slice(-4)}:${r.invoiceNumber}`).sort();
}

async function duplicateNumberGroups() {
  return Invoice.aggregate([
    { $group: { _id: "$invoiceNumber", n: { $sum: 1 }, schools: { $addToSet: "$schoolId" } } },
    { $match: { n: { $gt: 1 } } },
  ]);
}

// ---------------------------------------------------------------------------
// CLAIM 1 — invoice number collision
// ---------------------------------------------------------------------------
describe("Claim 1: invoice number collision", () => {
  test("index evidence: schema declares a GLOBAL unique index on invoiceNumber", async () => {
    await Invoice.syncIndexes();
    const indexes = await Invoice.collection.indexes();
    const numberIdx = indexes.find((i) => i.key && Object.keys(i.key).join(",") === "invoiceNumber");
    findings["1.index"] = indexes.map((i) => ({ name: i.name, key: i.key, unique: Boolean(i.unique) }));
    assert.ok(numberIdx, "invoiceNumber index exists after syncIndexes");
    assert.equal(numberIdx!.unique, true);
    assert.deepEqual(Object.keys(numberIdx!.key), ["invoiceNumber"], "not scoped by schoolId");
  });

  test("(a) cross-school, sequential, unique index present: school B's first invoice is rejected", async () => {
    await Invoice.syncIndexes();
    const period = oid();
    const schoolA = oid();
    const schoolB = oid();
    const a1 = await createLikeSingleRoute({ schoolId: schoolA, studentId: oid(), periodId: period });
    const b1 = await createLikeSingleRoute({ schoolId: schoolB, studentId: oid(), periodId: period });
    const bulkB = await createLikeBulkRoute({ schoolId: schoolB, studentIds: [oid(), oid()], periodId: period });
    findings["1a.crossSchool.indexPresent"] = { a1, b1, bulkB, persisted: await numbersPersisted() };
    assert.equal(a1.ok, true);
    assert.equal(b1.ok, false, "school B single create fails");
    assert.equal(b1.duplicateKey, true, "with E11000 duplicate key");
    assert.equal(bulkB.ok, false, "school B bulk create fails");
    assert.equal(bulkB.duplicateKey, true);
    assert.equal(await Invoice.countDocuments({ schoolId: schoolB }), 0, "bulk transaction aborted: zero invoices for B");
  });

  test("(b1) same school, 2 concurrent single-route creates (withTransaction), unique index present", async () => {
    await Invoice.syncIndexes();
    const school = oid();
    const period = oid();
    const barrier = makeBarrier(2);
    const results = await Promise.all([
      createLikeSingleRoute({ schoolId: school, studentId: oid(), periodId: period, barrier }),
      createLikeSingleRoute({ schoolId: school, studentId: oid(), periodId: period, barrier }),
    ]);
    findings["1b1.concurrentSingle.indexPresent"] = { results, persisted: await numbersPersisted(), dupGroups: await duplicateNumberGroups() };
    // Both observed the same count on their first attempt:
    assert.equal(results[0].numbersTried[0], results[1].numbersTried[0], "both generated the same number first");
    assert.equal((await duplicateNumberGroups()).length, 0, "no persisted duplicate");
  });

  test("(b2) same school, 2 concurrent bulk-route creates (manual txn), unique index present", async () => {
    await Invoice.syncIndexes();
    const school = oid();
    const period = oid();
    const barrier = makeBarrier(2);
    const results = await Promise.all([
      createLikeBulkRoute({ schoolId: school, studentIds: [oid(), oid()], periodId: period, barrier }),
      createLikeBulkRoute({ schoolId: school, studentIds: [oid(), oid()], periodId: period, barrier }),
    ]);
    findings["1b2.concurrentBulk.indexPresent"] = { results, persisted: await numbersPersisted(), dupGroups: await duplicateNumberGroups() };
    assert.equal(results.filter((r) => r.ok).length, 1, "exactly one bulk request succeeds");
    assert.equal((await duplicateNumberGroups()).length, 0, "no persisted duplicate");
  });

  test("(b3) same school, 5 concurrent single-route creates, no artificial barrier, unique index present", async () => {
    await Invoice.syncIndexes();
    const school = oid();
    const period = oid();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createLikeSingleRoute({ schoolId: school, studentId: oid(), periodId: period }))
    );
    findings["1b3.concurrentSingleNatural.indexPresent"] = {
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).map((r) => r.error),
      attempts: results.map((r) => r.attempts),
      persisted: await numbersPersisted(),
    };
    assert.equal((await duplicateNumberGroups()).length, 0);
  });

  test("(c) unique index ABSENT (production autoIndex:false, index never created): duplicates persist silently", async () => {
    await Invoice.createCollection();
    const before = await Invoice.collection.indexes();
    assert.ok(!before.some((i) => i.key && "invoiceNumber" in i.key), "no invoiceNumber index");
    const period = oid();
    const schoolA = oid();
    const schoolB = oid();
    const a1 = await createLikeSingleRoute({ schoolId: schoolA, studentId: oid(), periodId: period });
    const b1 = await createLikeSingleRoute({ schoolId: schoolB, studentId: oid(), periodId: period });
    const schoolC = oid();
    const barrier = makeBarrier(2);
    const concurrent = await Promise.all([
      createLikeSingleRoute({ schoolId: schoolC, studentId: oid(), periodId: period, barrier }),
      createLikeSingleRoute({ schoolId: schoolC, studentId: oid(), periodId: period, barrier }),
    ]);
    const dupGroups = await duplicateNumberGroups();
    findings["1c.noIndex"] = { a1, b1, concurrent, persisted: await numbersPersisted(), dupGroups };
    assert.equal(a1.ok && b1.ok, true, "both schools succeed");
    assert.ok(concurrent.every((r) => r.ok), "both concurrent creates succeed");
    assert.ok(dupGroups.length >= 1, "identical invoice numbers persisted");
    const dupForC = await Invoice.countDocuments({ schoolId: schoolC, invoiceNumber: concurrent[0].numbersTried[0] });
    assert.equal(dupForC, 2, "same school has two invoices with the same number");
  });

  test("(d) delete a cancelled invoice, then create: count-based number reuses an existing number", async () => {
    await Invoice.syncIndexes();
    const school = oid();
    const period = oid();
    for (let i = 0; i < 3; i++) {
      const r = await createLikeSingleRoute({ schoolId: school, studentId: oid(), periodId: period });
      assert.equal(r.ok, true);
    }
    // Mirrors DELETE src/app/api/admin/fees/invoices/[id]/route.ts: only cancelled bills can be deleted.
    const first = await Invoice.findOne({ schoolId: school }).sort({ invoiceNumber: 1 });
    await Invoice.updateOne({ _id: first!._id }, { $set: { status: "cancelled" } });
    await Invoice.deleteOne({ _id: first!._id, schoolId: school });
    const next = await createLikeSingleRoute({ schoolId: school, studentId: oid(), periodId: period });
    findings["1d.afterDelete.indexPresent"] = { deleted: first!.invoiceNumber, next, persisted: await numbersPersisted(school) };
    assert.equal(next.ok, false, "creation fails after a delete");
    assert.equal(next.duplicateKey, true);
    assert.equal(next.numbersTried[0], generateInvoiceNumber(new Date().getFullYear(), 3), "reuses INV-YYYY-0003");
  });
});

// ---------------------------------------------------------------------------
// CLAIM 2 — PaymentIntent stuck in `processing`
// ---------------------------------------------------------------------------

/** Exact filter used by GET src/app/api/parent/payments/reconcile-pending/route.ts. */
const RECONCILE_PENDING_STATUSES = ["awaiting_webhook", "initiated"];
/** Exact condition used by GET src/app/api/parent/payments/checkout-status/route.ts before its verify fallback. */
const checkoutStatusWouldRetry = (status: string) => status === "awaiting_webhook" || status === "initiated";
/** Exact mapping used by checkout-status for the parent-facing status. */
const checkoutStatusMapped = (s: string) =>
  s === "succeeded" ? "completed" : s === "failed" || s === "cancelled" || s === "expired" ? "failed" : "pending";

async function seedFeeCheckout(opts: { amountMinor: number; createInvoice?: boolean }) {
  const schoolId = oid();
  const studentId = oid();
  const periodId = oid();
  const parentUserId = oid();
  const invoiceId = oid();
  if (opts.createInvoice !== false) {
    await Invoice.create({
      _id: invoiceId,
      ...invoiceDoc(schoolId, studentId, periodId, `INV-TEST-${invoiceId.toString().slice(-6)}`),
      status: "issued",
      totalAmountMinor: opts.amountMinor,
      totalOutstandingMinor: opts.amountMinor,
    });
    await InvoiceLineItem.create({
      invoiceId,
      name: "Tuition",
      amountMinor: opts.amountMinor,
      displayOrder: 1,
      amountPaidMinor: 0,
      amountOutstandingMinor: opts.amountMinor,
      isFullyPaid: false,
      status: "pending",
      isAdjustment: false,
    });
  }
  const intentId = oid();
  const reference = `EDSX-FEE-${intentId}-${Date.now()}`;
  // Mirrors POST src/app/api/parent/payments/checkout/route.ts after initializeTransaction succeeds.
  await PaymentIntent.create({
    _id: intentId,
    schoolId,
    studentId,
    invoiceId,
    amountMinor: opts.amountMinor,
    parentPayableMinor: opts.amountMinor,
    payerMode: "school_absorbs",
    status: "awaiting_webhook",
    paymentMethod: "paystack",
    paystackReference: reference,
    idempotencyKey: crypto.randomUUID(),
    initiatedBy: parentUserId,
    initiatedAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const payload = JSON.stringify({
    event: "charge.success",
    data: {
      id: 900000 + Math.floor(Math.random() * 1000),
      reference,
      amount: opts.amountMinor,
      status: "success",
      fees: 0,
      channel: "card",
      currency: "GHS",
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      metadata: {
        type: "fee_payment",
        schoolId: String(schoolId),
        invoiceId: String(invoiceId),
        studentId: String(studentId),
        paymentIntentId: String(intentId),
        parentUserId: String(parentUserId),
        invoiceAmountMinor: opts.amountMinor,
        parentPayableMinor: opts.amountMinor,
        payerMode: "school_absorbs",
        edusentrixTransactionFeeMinor: 0,
      },
    },
  });
  return { schoolId, studentId, invoiceId, intentId, reference, payload };
}

async function intentState(intentId: mongoose.Types.ObjectId) {
  const raw = await mongoose.connection.db!.collection("paymentintents").findOne({ _id: intentId });
  return { status: raw?.status as string, paymentId: raw?.paymentId ?? null };
}

describe("Claim 2: PaymentIntent stuck in processing", () => {
  let POST: (req: any) => Promise<Response>;
  let NextRequestCtor: any;
  const externalCalls: string[] = [];

  before(async () => {
    // Block every outbound HTTP call; record attempts.
    mock.method(globalThis, "fetch", async (input: unknown) => {
      externalCalls.push(String((input as any)?.url ?? input));
      throw new Error("verification harness: outbound fetch blocked");
    });
    try {
      ({ NextRequest: NextRequestCtor } = await import("next/server"));
      ({ POST } = await import("../../src/app/api/webhooks/paystack/route"));
      findings["2.harness"] = "real webhook POST handler imported";
    } catch (error) {
      findings["2.harness"] = `handler import FAILED: ${String((error as Error)?.message ?? error)}`;
      throw error;
    }
  });

  const deliver = async (payload: string) => {
    const signature = crypto.createHmac("sha512", PAYSTACK_TEST_SECRET).update(payload).digest("hex");
    const req = new NextRequestCtor("http://localhost:3999/api/webhooks/paystack", {
      method: "POST",
      body: payload,
      headers: { "content-type": "application/json", "x-paystack-signature": signature },
    });
    const res = await POST(req);
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  test("(a) `processing` is outside the schema enum but findOneAndUpdate persists it; a later .save() would fail validation", async () => {
    const seeded = await seedFeeCheckout({ amountMinor: 50_000 });
    const updated = await PaymentIntent.findOneAndUpdate(
      { _id: seeded.intentId, status: { $in: ["initiated", "awaiting_webhook"] } },
      { $set: { status: "processing", failureReason: null } },
      { new: true }
    ).lean();
    const raw = await intentState(seeded.intentId);
    const hydrated = await PaymentIntent.findById(seeded.intentId);
    const validationError = await hydrated!.validate().then(() => null, (e: Error) => e.message);
    findings["2a.enum"] = {
      schemaEnum: (PaymentIntent.schema.path("status") as any).enumValues,
      returned: (updated as any)?.status,
      persisted: raw.status,
      validateError: validationError,
    };
    assert.ok(!(PaymentIntent.schema.path("status") as any).enumValues.includes("processing"));
    assert.equal(raw.status, "processing", "value persisted despite enum");
    assert.match(String(validationError), /processing/);
  });

  test("(control) happy path through the real handler + concurrent duplicate delivery", async () => {
    const seeded = await seedFeeCheckout({ amountMinor: 50_000 });
    const [r1, r2] = await Promise.all([deliver(seeded.payload), deliver(seeded.payload)]);
    const state = await intentState(seeded.intentId);
    const payments = await Payment.countDocuments({ paystackReference: seeded.reference });
    findings["2control.happyPathConcurrentDuplicate"] = { responses: [r1, r2], intent: state, payments };
    assert.equal(state.status, "succeeded");
    assert.equal(payments, 1, "exactly one Payment for duplicate delivery");
  });

  test("(b) injected failure after the processing lock: 500, then redelivery returns 200 and the intent stays processing forever", async () => {
    const seeded = await seedFeeCheckout({ amountMinor: 50_000 });
    const lineBefore = await InvoiceLineItem.findOne({ invoiceId: seeded.invoiceId }).lean();

    const injected = mock.method(
      InvoiceEvent,
      "create",
      async () => {
        throw new Error("verification: injected failure after processing lock");
      },
      { times: 1 }
    );
    const first = await deliver(seeded.payload);
    injected.mock.restore();

    const afterFirst = await intentState(seeded.intentId);
    const lineAfterFirst = await InvoiceLineItem.findOne({ invoiceId: seeded.invoiceId }).lean();
    const paymentsAfterFirst = await Payment.countDocuments({ paystackReference: seeded.reference });

    // Paystack redelivers (or the internal checkout-status / reconcile-pending loopback re-posts).
    const second = await deliver(seeded.payload);
    const third = await deliver(seeded.payload);
    const afterRetries = await intentState(seeded.intentId);
    const paymentsAfterRetries = await Payment.countDocuments({ paystackReference: seeded.reference });

    const reconcilePendingSees = await PaymentIntent.countDocuments({
      _id: seeded.intentId,
      status: { $in: RECONCILE_PENDING_STATUSES },
    });
    const invoiceEvents = await InvoiceEvent.countDocuments({ invoiceId: seeded.invoiceId });
    const credit = await StudentCreditBalance.findOne({ studentId: seeded.studentId }).lean();
    const invoiceHeader = await Invoice.findById(seeded.invoiceId).select("status totalPaidMinor totalOutstandingMinor").lean();

    findings["2b.injectedFailure"] = {
      firstDelivery: first,
      afterFirst,
      lineItemBefore: { paid: (lineBefore as any)?.amountPaidMinor, status: (lineBefore as any)?.status },
      lineItemAfterFirst: { paid: (lineAfterFirst as any)?.amountPaidMinor, status: (lineAfterFirst as any)?.status },
      paymentsAfterFirst,
      redeliveries: [second, third],
      afterRetries,
      paymentsAfterRetries,
      invoiceEvents,
      creditBalance: (credit as any)?.balanceMinor ?? null,
      invoiceHeaderAfterRetries: invoiceHeader,
      reconcilePendingQueryMatches: reconcilePendingSees,
      checkoutStatusWouldRetry: checkoutStatusWouldRetry(afterRetries.status),
      parentSees: checkoutStatusMapped(afterRetries.status),
    };

    assert.equal(first.status, 500, "first delivery fails with 500 (Paystack would retry)");
    assert.equal(afterFirst.status, "processing", "intent left in processing");
    assert.equal(paymentsAfterFirst, 0, "no Payment row");
    assert.equal(second.status, 200, "redelivery is acknowledged");
    assert.equal(third.status, 200);
    assert.equal(afterRetries.status, "processing", "still processing after retries");
    assert.equal(paymentsAfterRetries, 0, "Payment never created");
    assert.equal(reconcilePendingSees, 0, "reconcile-pending excludes it");
    assert.equal(checkoutStatusWouldRetry(afterRetries.status), false, "checkout-status will not retry it");
    assert.equal(checkoutStatusMapped(afterRetries.status), "pending", "parent sees 'pending' indefinitely");
  });

  test("(c) invoice not found after the lock: 200 and intent stuck in processing (no exception at all)", async () => {
    const seeded = await seedFeeCheckout({ amountMinor: 30_000, createInvoice: false });
    const first = await deliver(seeded.payload);
    const second = await deliver(seeded.payload);
    const state = await intentState(seeded.intentId);
    findings["2c.invoiceNotFound"] = { responses: [first, second], intent: state };
    assert.equal(first.status, 200);
    assert.equal(state.status, "processing");
  });

  test("(d) outbound-call guard: no external HTTP was attempted by any delivery", async () => {
    findings["2.externalCallsAttempted"] = externalCalls;
    assert.deepEqual(externalCalls, []);
  });
});
