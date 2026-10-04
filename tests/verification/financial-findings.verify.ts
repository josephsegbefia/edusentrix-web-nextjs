/**
 * Verification harness for docs/FINANCIAL_BACKGROUND_FINDINGS_VERIFICATION.md.
 *
 * Status:
 * - Claim 1 (invoice number collision): FIXED by the atomic per-school invoice
 *   number sequence. Tests 1.index and (a)-(d) now assert the bug no longer
 *   occurs. The original bug-asserting versions are preserved verbatim in the
 *   doc addendum and in commit 2a769b0. Ongoing protection lives in
 *   tests/regression/invoice-numbering.test.ts.
 * - Claim 2 (PaymentIntent stuck in `processing`): FIXED by the Paystack fee
 *   posting hotfix. Tests 2a/2b/2c now assert the bug no longer occurs. The
 *   original bug-asserting versions are preserved verbatim in the doc
 *   addendum and in commit da31e35. Ongoing protection lives in
 *   tests/regression/payment-webhook-integrity.test.ts.
 *
 * Not part of `npm test` (the glob there is tests/**\/*.test.ts). Run explicitly:
 *   node --test --import tsx tests/verification/financial-findings.verify.ts
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
import { allocateInvoiceNumber, allocateInvoiceNumbers } from "../../src/lib/fees/invoice-numbering";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

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
 * Mirrors POST src/app/api/admin/fees/invoices/route.ts (single create, fixed):
 * session.withTransaction -> invoiceNumber ??= allocateInvoiceNumber(schoolId) (no session) -> Invoice.create.
 * The number is reserved once and reused on withTransaction retries.
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
  let invoiceNumber: string | null = null;
  try {
    await session.withTransaction(async () => {
      attempts += 1;
      invoiceNumber ??= await allocateInvoiceNumber(args.schoolId);
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
 * Mirrors POST src/app/api/admin/fees/invoices/bulk/route.ts (fixed):
 * session.withTransaction -> one contiguous allocateInvoiceNumbers(count = N) range (no session, reused on retry) -> creates.
 */
async function createLikeBulkRoute(args: {
  schoolId: mongoose.Types.ObjectId;
  studentIds: mongoose.Types.ObjectId[];
  periodId: mongoose.Types.ObjectId;
  barrier?: () => Promise<void>;
}) {
  const session = await mongoose.startSession();
  let numbers: string[] = [];
  let attempts = 0;
  try {
    await session.withTransaction(async () => {
      attempts += 1;
      if (numbers.length < args.studentIds.length) {
        numbers = (await allocateInvoiceNumbers({ schoolId: args.schoolId, count: args.studentIds.length })).numbers;
      }
      if (attempts === 1 && args.barrier) await args.barrier();
      for (let i = 0; i < args.studentIds.length; i++) {
        await Invoice.create([invoiceDoc(args.schoolId, args.studentIds[i], args.periodId, numbers[i]!)], { session });
      }
    });
    return { ok: true as const, numbers, attempts };
  } catch (error) {
    return { ok: false as const, numbers, attempts, error: errSummary(error), duplicateKey: isDuplicateKey(error) };
  } finally {
    await session.endSession();
  }
}

const seqOf = (invoiceNumber: string) => Number(invoiceNumber.split("-")[2]);
const yearNumber = (sequence: number) => generateInvoiceNumber(new Date().getFullYear(), sequence);

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

/** Duplicates that matter after the fix: the same number twice inside one school. */
async function sameSchoolDuplicateGroups() {
  return Invoice.aggregate([
    { $group: { _id: { schoolId: "$schoolId", invoiceNumber: "$invoiceNumber" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
}

// ---------------------------------------------------------------------------
// CLAIM 1 — invoice number collision (FIXED; asserts the fix)
// ---------------------------------------------------------------------------
describe("Claim 1: invoice number collision", () => {
  test("index evidence: schema declares a per-school unique index; no global invoiceNumber index", async () => {
    await Invoice.syncIndexes();
    const indexes = await Invoice.collection.indexes();
    findings["1.index"] = indexes.map((i) => ({ name: i.name, key: i.key, unique: Boolean(i.unique) }));
    const globalIdx = indexes.find((i) => i.key && Object.keys(i.key).join(",") === "invoiceNumber");
    assert.equal(globalIdx, undefined, "no global invoiceNumber index");
    const scoped = indexes.find((i) => i.key && Object.keys(i.key).join(",") === "schoolId,invoiceNumber");
    assert.ok(scoped, "{schoolId, invoiceNumber} index exists after syncIndexes");
    assert.equal(scoped!.unique, true);
    assert.equal(scoped!.name, "unique_school_invoice_number");
  });

  test("(a) cross-school, sequential, unique index present: every school creates its own 0001", async () => {
    await Invoice.syncIndexes();
    const period = oid();
    const schoolA = oid();
    const schoolB = oid();
    const a1 = await createLikeSingleRoute({ schoolId: schoolA, studentId: oid(), periodId: period });
    const b1 = await createLikeSingleRoute({ schoolId: schoolB, studentId: oid(), periodId: period });
    const bulkB = await createLikeBulkRoute({ schoolId: schoolB, studentIds: [oid(), oid()], periodId: period });
    findings["1a.crossSchool.indexPresent"] = { a1, b1, bulkB, persisted: await numbersPersisted() };
    assert.equal(a1.ok, true);
    assert.equal(b1.ok, true, "school B single create succeeds");
    assert.equal(a1.numbersTried[0], yearNumber(1));
    assert.equal(b1.numbersTried[0], yearNumber(1), "same number in another school is allowed");
    assert.equal(bulkB.ok, true, "school B bulk create succeeds");
    assert.deepEqual(bulkB.numbers, [yearNumber(2), yearNumber(3)]);
    assert.equal(await Invoice.countDocuments({ schoolId: schoolB }), 3);
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
    assert.ok(results.every((r) => r.ok), "both succeed");
    assert.notEqual(results[0].numbersTried[0], results[1].numbersTried[0], "distinct numbers on the first attempt");
    assert.ok(results.every((r) => r.attempts === 1), "no write-conflict retry needed");
    assert.equal((await duplicateNumberGroups()).length, 0, "no persisted duplicate");
  });

  test("(b2) same school, 2 concurrent bulk-route creates, unique index present: both succeed", async () => {
    await Invoice.syncIndexes();
    const school = oid();
    const period = oid();
    const barrier = makeBarrier(2);
    const results = await Promise.all([
      createLikeBulkRoute({ schoolId: school, studentIds: [oid(), oid()], periodId: period, barrier }),
      createLikeBulkRoute({ schoolId: school, studentIds: [oid(), oid()], periodId: period, barrier }),
    ]);
    findings["1b2.concurrentBulk.indexPresent"] = { results, persisted: await numbersPersisted(), dupGroups: await duplicateNumberGroups() };
    assert.equal(results.filter((r) => r.ok).length, 2, "both bulk requests succeed");
    for (const r of results) assert.equal(seqOf(r.numbers[1]!) - seqOf(r.numbers[0]!), 1, "contiguous range");
    assert.deepEqual(
      results.flatMap((r) => r.numbers).sort(),
      [1, 2, 3, 4].map(yearNumber)
    );
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
    assert.equal(results.filter((r) => r.ok).length, 5);
    assert.deepEqual(results.map((r) => r.numbersTried[0]).sort(), [1, 2, 3, 4, 5].map(yearNumber));
    assert.equal((await duplicateNumberGroups()).length, 0);
  });

  test("(c) unique index ABSENT (production autoIndex:false, index never created): no same-school duplicates", async () => {
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
    const sameSchoolDups = await sameSchoolDuplicateGroups();
    findings["1c.noIndex"] = { a1, b1, concurrent, persisted: await numbersPersisted(), sameSchoolDups };
    assert.equal(a1.ok && b1.ok, true, "both schools succeed");
    assert.ok(concurrent.every((r) => r.ok), "both concurrent creates succeed");
    assert.notEqual(concurrent[0].numbersTried[0], concurrent[1].numbersTried[0], "counter alone keeps them distinct");
    assert.equal(sameSchoolDups.length, 0, "no same-school duplicate even without the index");
  });

  test("(d) delete a cancelled invoice, then create: the next number is never reused", async () => {
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
    assert.equal(next.ok, true, "creation succeeds after a delete");
    assert.equal(next.numbersTried[0], yearNumber(4), "gets INV-YYYY-0004, never a reused number");
  });
});

// ---------------------------------------------------------------------------
// CLAIM 2 — PaymentIntent stuck in `processing` (FIXED; asserts the fix)
// ---------------------------------------------------------------------------

/** Exact condition used by GET src/app/api/parent/payments/checkout-status/route.ts before its verify fallback (post-hotfix). */
const checkoutStatusWouldRetry = (status: string) =>
  status === "awaiting_webhook" || status === "initiated" || status === "processing";
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

  test("(a) FIXED: `processing` is a valid schema status, so legacy intents load and validate; posting never writes it", async () => {
    const legacy = await seedFeeCheckout({ amountMinor: 50_000 });
    await mongoose.connection
      .db!.collection("paymentintents")
      .updateOne({ _id: legacy.intentId }, { $set: { status: "processing", failureReason: null } });
    const hydrated = await PaymentIntent.findById(legacy.intentId);
    const validationError = await hydrated!.validate().then(() => null, (e: Error) => e.message);

    const fresh = await seedFeeCheckout({ amountMinor: 50_000 });
    const delivered = await deliver(fresh.payload);
    const freshState = await intentState(fresh.intentId);

    findings["2a.enum.fixed"] = {
      schemaEnum: (PaymentIntent.schema.path("status") as any).enumValues,
      legacyValidateError: validationError,
      freshDelivery: delivered.status,
      freshIntentStatus: freshState.status,
    };
    assert.ok((PaymentIntent.schema.path("status") as any).enumValues.includes("processing"));
    assert.equal(validationError, null, "legacy processing intent passes validation");
    assert.equal(delivered.status, 200);
    assert.equal(freshState.status, "succeeded", "posting moves straight to succeeded, never processing");
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

  test("(b) FIXED: injected posting failure leaves no partial state and the intent claimable; redelivery posts exactly once", async () => {
    const seeded = await seedFeeCheckout({ amountMinor: 50_000 });
    const lineBefore = await InvoiceLineItem.findOne({ invoiceId: seeded.invoiceId }).lean();

    const injected = mock.method(
      InvoiceEvent,
      "create",
      async () => {
        throw new Error("verification: injected posting failure");
      },
      { times: 1 }
    );
    const first = await deliver(seeded.payload);
    injected.mock.restore();

    const afterFirst = await intentState(seeded.intentId);
    const lineAfterFirst = await InvoiceLineItem.findOne({ invoiceId: seeded.invoiceId }).lean();
    const paymentsAfterFirst = await Payment.countDocuments({ paystackReference: seeded.reference });

    const second = await deliver(seeded.payload);
    const third = await deliver(seeded.payload);
    const afterRetries = await intentState(seeded.intentId);
    const paymentsAfterRetries = await Payment.countDocuments({ paystackReference: seeded.reference });
    const credit = await StudentCreditBalance.findOne({ studentId: seeded.studentId }).lean();
    const invoiceHeader = await Invoice.findById(seeded.invoiceId).select("status totalPaidMinor totalOutstandingMinor").lean();

    findings["2b.injectedFailure.fixed"] = {
      firstDelivery: first,
      afterFirst,
      lineItemBefore: { paid: (lineBefore as any)?.amountPaidMinor, status: (lineBefore as any)?.status },
      lineItemAfterFirst: { paid: (lineAfterFirst as any)?.amountPaidMinor, status: (lineAfterFirst as any)?.status },
      paymentsAfterFirst,
      redeliveries: [second, third],
      afterRetries,
      paymentsAfterRetries,
      creditBalance: (credit as any)?.balanceMinor ?? null,
      invoiceHeaderAfterRetries: invoiceHeader,
      checkoutStatusWouldRetryDuringFailure: checkoutStatusWouldRetry(afterFirst.status),
      parentSees: checkoutStatusMapped(afterRetries.status),
    };

    assert.equal(first.status, 500, "first delivery fails with 500 (Paystack would retry)");
    assert.equal(afterFirst.status, "awaiting_webhook", "intent NOT left in processing; stays claimable");
    assert.equal(paymentsAfterFirst, 0, "no Payment row");
    assert.equal((lineAfterFirst as any)?.amountPaidMinor, (lineBefore as any)?.amountPaidMinor, "no partial line-item write");
    assert.equal(checkoutStatusWouldRetry(afterFirst.status), true, "checkout-status fallback can retry it");
    assert.equal(second.status, 200);
    assert.equal(third.status, 200);
    assert.equal(afterRetries.status, "succeeded", "redelivery completes the payment");
    assert.equal(paymentsAfterRetries, 1, "exactly one Payment");
    assert.equal((invoiceHeader as any)?.status, "paid");
    assert.equal(checkoutStatusMapped(afterRetries.status), "completed", "parent sees completed");
  });

  test("(c) FIXED: invoice not found is persisted as reconciliation_required (not processing, not failed), posting nothing", async () => {
    const seeded = await seedFeeCheckout({ amountMinor: 30_000, createInvoice: false });
    const first = await deliver(seeded.payload);
    const second = await deliver(seeded.payload);
    const raw = await mongoose.connection.db!.collection("paymentintents").findOne({ _id: seeded.intentId });
    const payments = await Payment.countDocuments({ paystackReference: seeded.reference });
    findings["2c.invoiceNotFound.fixed"] = {
      responses: [first, second],
      intent: { status: raw?.status, reconciliationReason: raw?.reconciliationReason },
      payments,
    };
    assert.equal(first.status, 200);
    assert.equal(raw?.status, "reconciliation_required");
    assert.equal(raw?.reconciliationReason, "invoice_not_found");
    assert.equal(payments, 0);
  });

  test("(d) outbound-call guard: no external HTTP was attempted by any delivery", async () => {
    findings["2.externalCallsAttempted"] = externalCalls;
    assert.deepEqual(externalCalls, []);
  });
});
