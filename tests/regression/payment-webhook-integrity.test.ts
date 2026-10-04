/**
 * Regression suite for the Paystack fee posting integrity hotfix.
 * See docs/FINANCIAL_BACKGROUND_FINDINGS_VERIFICATION.md (Claim 2) for the original defect.
 *
 * Runs in `npm test`; alone via `npm run test:regression`.
 *
 * In-memory MongoDB replica set only. No production data. Every outbound
 * fetch is blocked and recorded, so no real Paystack/email calls can happen.
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
import { Payment } from "../../src/models/Payment";
import { PaymentAllocation } from "../../src/models/PaymentAllocation";
import { PaymentAuditEvent } from "../../src/models/PaymentAuditEvent";
import { PaymentIntent, PAYMENT_INTENT_STATUSES } from "../../src/models/PaymentIntent";
import { StudentCreditBalance } from "../../src/models/StudentCreditBalance";
import { disableAutoIndexing } from "./helpers/disable-auto-indexing";
import { stubServerOnly } from "./helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "payment_webhook_integrity";
const PAYSTACK_TEST_SECRET = "sk_test_regression_only_not_a_real_key";

let replSet: MongoMemoryReplSet;
const externalCalls: string[] = [];
let POST: (req: unknown) => Promise<Response>;
let NextRequestCtor: new (url: string, init: Record<string, unknown>) => unknown;

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3999";
    mock.method(globalThis, "fetch", async (input: unknown) => {
      externalCalls.push(String((input as { url?: string })?.url ?? input));
      throw new Error("regression harness: outbound fetch blocked");
    });
    ({ NextRequest: NextRequestCtor } = (await import("next/server")) as never);
    ({ POST } = (await import("../../src/app/api/webhooks/paystack/route")) as never);
    disableAutoIndexing();
    await connectToDatabase();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

/** Builds one index exactly as declared on the schema (proves the declaration is valid). */
async function createSchemaIndex(model: mongoose.Model<any>, keyFields: string) {
  const entry = model.schema
    .indexes()
    .find(([key]) => Object.keys(key).join(",") === keyFields);
  assert.ok(entry, `${model.modelName} declares an index on ${keyFields}`);
  await model.collection.createIndex(entry[0] as never, entry[1] as never);
}

async function ensureIndexes() {
  // Payment.createIndexes() is not used: other pre-existing Payment index
  // declarations are rejected by MongoDB and would abort the whole call.
  await Promise.all([
    createSchemaIndex(Payment, "paystackReference"),
    PaymentAllocation.createIndexes(),
    PaymentIntent.createIndexes(),
    StudentCreditBalance.createIndexes(),
    mongoose.model("PaymentReferenceCounter").createIndexes(),
  ]);
}

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
  await ensureIndexes();
});

const oid = () => new mongoose.Types.ObjectId();

type ChargeData = {
  id: number;
  reference: string;
  amount: number;
  status: string;
  fees: number;
  channel: string;
  currency: string;
  gateway_response: string;
  paid_at: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

type Seed = {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  lineItemId: mongoose.Types.ObjectId;
  intentId: mongoose.Types.ObjectId | null;
  reference: string;
  data: ChargeData;
  payload: string;
};

const buildPayload = (data: ChargeData) => JSON.stringify({ event: "charge.success", data });

/** The seeded charge with selected provider facts changed. */
function chargeWith(s: Seed, mutate: (data: ChargeData) => void) {
  const data = JSON.parse(JSON.stringify(s.data)) as ChargeData;
  mutate(data);
  return buildPayload(data);
}

async function createInvoice(args: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  lineItemId: mongoose.Types.ObjectId;
  invoiceAmountMinor: number;
}) {
  await Invoice.create({
    _id: args.invoiceId,
    schoolId: args.schoolId,
    studentId: args.studentId,
    academicPeriodId: oid(),
    invoiceNumber: `INV-REG-${args.invoiceId.toString().slice(-8)}`,
    status: "issued",
    totalAmountMinor: args.invoiceAmountMinor,
    totalPaidMinor: 0,
    totalOutstandingMinor: args.invoiceAmountMinor,
    totalCreditAppliedMinor: 0,
    version: 1,
    dueDate: new Date(),
  });
  await InvoiceLineItem.create({
    _id: args.lineItemId,
    invoiceId: args.invoiceId,
    name: "Tuition",
    amountMinor: args.invoiceAmountMinor,
    displayOrder: 1,
    amountPaidMinor: 0,
    amountOutstandingMinor: args.invoiceAmountMinor,
    isFullyPaid: false,
    status: "pending",
    isAdjustment: false,
  });
}

/**
 * Mirrors the checkout route after initializeTransaction (intent persisted with
 * its reference, currency and payable amount), plus the matching charge.success.
 * `chargeAmountMinor` is what the intent was created for and what Paystack charges.
 */
async function seed(opts: {
  invoiceAmountMinor?: number;
  chargeAmountMinor?: number;
  platformFeeMinor?: number;
  createInvoice?: boolean;
  withIntent?: boolean;
} = {}): Promise<Seed> {
  const invoiceAmountMinor = opts.invoiceAmountMinor ?? 50_000;
  const intentAmountMinor = opts.chargeAmountMinor ?? invoiceAmountMinor;
  const platformFeeMinor = opts.platformFeeMinor ?? 0;
  const parentPayableMinor = intentAmountMinor + platformFeeMinor;
  const schoolId = oid();
  const studentId = oid();
  const invoiceId = oid();
  const lineItemId = oid();
  const parentUserId = oid();
  const withIntent = opts.withIntent !== false;
  const intentId = withIntent ? oid() : null;
  const reference = `EDSX-FEE-${intentId ?? oid()}-${Date.now()}`;

  if (opts.createInvoice !== false) {
    await createInvoice({ schoolId, studentId, invoiceId, lineItemId, invoiceAmountMinor });
  }
  if (intentId) {
    await PaymentIntent.create({
      _id: intentId,
      schoolId,
      studentId,
      invoiceId,
      amountMinor: intentAmountMinor,
      platformFeeMinor,
      parentPayableMinor,
      payerMode: platformFeeMinor > 0 ? "payer_pays" : "school_absorbs",
      status: "awaiting_webhook",
      paymentMethod: "paystack",
      paystackReference: reference,
      currency: "GHS",
      idempotencyKey: crypto.randomUUID(),
      initiatedBy: parentUserId,
      initiatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  }

  const data: ChargeData = {
    id: 900_000 + Math.floor(Math.random() * 1000),
    reference,
    amount: parentPayableMinor,
    status: "success",
    fees: 0,
    channel: "card",
    currency: "GHS",
    gateway_response: "Successful",
    paid_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    metadata: {
      type: "fee_payment",
      schoolId: String(schoolId),
      invoiceId: String(invoiceId),
      studentId: String(studentId),
      ...(intentId ? { paymentIntentId: String(intentId) } : {}),
      parentUserId: String(parentUserId),
      invoiceAmountMinor: intentAmountMinor,
      parentPayableMinor,
      payerMode: platformFeeMinor > 0 ? "payer_pays" : "school_absorbs",
      edusentrixTransactionFeeMinor: platformFeeMinor,
    },
  };

  return {
    schoolId,
    studentId,
    invoiceId,
    lineItemId,
    intentId,
    reference,
    data,
    payload: buildPayload(data),
  };
}

async function unmatchedRecords() {
  return mongoose.connection
    .db!.collection("paymentintents")
    .find({ "reconciliationDetails.unmatchedCharge": true })
    .toArray();
}

async function deliver(payload: string) {
  const signature = crypto.createHmac("sha512", PAYSTACK_TEST_SECRET).update(payload).digest("hex");
  const req = new NextRequestCtor("http://localhost:3999/api/webhooks/paystack", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json", "x-paystack-signature": signature },
  });
  const res = await POST(req);
  return { status: res.status };
}

async function rawIntent(intentId: mongoose.Types.ObjectId) {
  return mongoose.connection.db!.collection("paymentintents").findOne({ _id: intentId });
}

/** Every financial artefact a posting can touch, for before/after comparisons. */
async function snapshot(s: Seed) {
  const [payments, allocations, lineItem, invoice, credit, invoiceEvents, paymentAuditEvents] =
    await Promise.all([
      Payment.find({ paystackReference: s.reference }).select("_id amountMinor status").lean(),
      PaymentAllocation.find({}).select("paymentId invoiceLineItemId amountMinor").lean(),
      InvoiceLineItem.findById(s.lineItemId)
        .select("amountPaidMinor amountOutstandingMinor status isFullyPaid")
        .lean<{
          amountPaidMinor: number;
          amountOutstandingMinor: number;
          status: string;
          isFullyPaid: boolean;
        } | null>(),
      Invoice.findById(s.invoiceId)
        .select("status totalPaidMinor totalOutstandingMinor")
        .lean<{ status: string; totalPaidMinor: number; totalOutstandingMinor: number } | null>(),
      StudentCreditBalance.findOne({ schoolId: s.schoolId, studentId: s.studentId })
        .select("balanceMinor entries")
        .lean<{ balanceMinor: number; entries?: unknown[] } | null>(),
      InvoiceEvent.find({ invoiceId: s.invoiceId })
        .select("eventType relatedPaymentId")
        .lean<Array<{ eventType: string }>>(),
      PaymentAuditEvent.countDocuments({}),
    ]);
  const strip = <T>(v: T) => JSON.parse(JSON.stringify(v)) as T;
  return strip({
    payments,
    allocations,
    lineItem,
    invoice,
    credit: credit
      ? { balanceMinor: credit.balanceMinor, entries: credit.entries?.length ?? 0 }
      : null,
    invoiceEvents: invoiceEvents.map((e) => e.eventType).sort(),
    paymentAuditEvents,
  });
}

async function assertAllIntentsSchemaValid() {
  const intents = await PaymentIntent.find({});
  for (const intent of intents) {
    assert.equal(
      intent.validateSync(),
      undefined,
      `intent ${String(intent._id)} with status ${intent.status} must pass schema validation`
    );
  }
}

describe("1. normal success", () => {
  test("posts one Payment, pays the line item and invoice, and succeeds the intent", async () => {
    const s = await seed();
    const res = await deliver(s.payload);
    assert.equal(res.status, 200);

    const snap = await snapshot(s);
    assert.equal(snap.payments.length, 1);
    assert.equal(snap.payments[0].status, "completed");
    assert.equal(snap.payments[0].amountMinor, 50_000);
    assert.equal(snap.allocations.length, 1);
    assert.equal(snap.lineItem?.amountPaidMinor, 50_000);
    assert.equal(snap.lineItem?.status, "paid");
    assert.equal(snap.invoice?.status, "paid");
    assert.equal(snap.invoice?.totalOutstandingMinor, 0);
    assert.equal(snap.credit, null);
    assert.deepEqual(snap.invoiceEvents, ["payment_recorded"]);
    assert.equal(snap.paymentAuditEvents, 1);

    const intent = await rawIntent(s.intentId!);
    assert.equal(intent?.status, "succeeded");
    assert.equal(String(intent?.paymentId), String(snap.payments[0]._id));
    await assertAllIntentsSchemaValid();
  });
});

describe("2. duplicate webhook", () => {
  test("a sequential redelivery changes nothing", async () => {
    const s = await seed({ invoiceAmountMinor: 50_000, chargeAmountMinor: 60_000 });
    assert.equal((await deliver(s.payload)).status, 200);
    const first = await snapshot(s);
    assert.equal((await deliver(s.payload)).status, 200);
    const second = await snapshot(s);
    assert.deepEqual(second, first);
    assert.equal(first.credit?.balanceMinor, 10_000);
  });
});

describe("3. concurrent duplicate webhooks", () => {
  for (const variant of [
    { name: "unique index present", dropIndex: false },
    { name: "paystackReference unique index ABSENT", dropIndex: true },
  ]) {
    test(`5 simultaneous deliveries post exactly once (${variant.name})`, async () => {
      if (variant.dropIndex) {
        await Payment.collection.dropIndex("paystackReference_1");
      }
      const s = await seed({ invoiceAmountMinor: 50_000, chargeAmountMinor: 60_000 });
      const responses = await Promise.all(Array.from({ length: 5 }, () => deliver(s.payload)));
      assert.ok(responses.every((r) => r.status === 200), JSON.stringify(responses));

      const snap = await snapshot(s);
      assert.equal(snap.payments.length, 1, "exactly one Payment");
      assert.equal(snap.allocations.length, 1, "exactly one allocation set");
      assert.equal(snap.lineItem?.amountPaidMinor, 50_000);
      assert.equal(snap.invoice?.totalPaidMinor, 50_000);
      assert.equal(snap.credit?.balanceMinor, 10_000, "credit incremented once");
      assert.equal(snap.credit?.entries, 1);
      assert.deepEqual(snap.invoiceEvents, ["adjustment_added", "payment_recorded"]);
      assert.equal(snap.paymentAuditEvents, 1);
      assert.equal((await rawIntent(s.intentId!))?.status, "succeeded");
    });

    test(`5 simultaneous deliveries without a payment intent post nothing and record one reconciliation (${variant.name})`, async () => {
      if (variant.dropIndex) {
        await Payment.collection.dropIndex("paystackReference_1");
      }
      const s = await seed({ withIntent: false });
      const before = await snapshot(s);
      const responses = await Promise.all(Array.from({ length: 5 }, () => deliver(s.payload)));
      assert.ok(responses.every((r) => r.status === 200), JSON.stringify(responses));

      assert.deepEqual(await snapshot(s), before, "metadata alone is never trusted to post");
      const records = await unmatchedRecords();
      assert.equal(records.length, 1, "deterministic id: one record for all deliveries");
      assert.equal(records[0].status, "reconciliation_required");
      assert.equal(records[0].reconciliationReason, "intent_missing");
      assert.equal(records[0].paystackReference, s.reference);
      assert.equal(records[0].reconciliationDetails.provider.amountMinor, 50_000);
      await assertAllIntentsSchemaValid();
    });
  }
});

describe("4 + 5. failure during posting, then retry", () => {
  for (const injection of [
    { name: "InvoiceEvent.create (before Payment)", target: InvoiceEvent },
    { name: "PaymentAuditEvent.create (after Payment, allocations, credit)", target: PaymentAuditEvent },
  ]) {
    test(`failure at ${injection.name} leaves no partial state; redelivery succeeds`, async () => {
      const s = await seed({ invoiceAmountMinor: 50_000, chargeAmountMinor: 60_000 });
      const before = await snapshot(s);

      const injected = mock.method(
        injection.target,
        "create",
        async () => {
          throw new Error("regression: injected posting failure");
        },
        { times: 1 }
      );
      const first = await deliver(s.payload);
      injected.mock.restore();

      assert.equal(first.status, 500, "posting failure returns 500 so Paystack retries");
      const afterFailure = await snapshot(s);
      assert.deepEqual(afterFailure, before, "no partial financial state committed");

      const failedIntent = await rawIntent(s.intentId!);
      assert.equal(failedIntent?.status, "awaiting_webhook", "intent stays claimable");
      assert.match(String(failedIntent?.lastPostingError), /injected posting failure/);
      assert.equal(failedIntent?.postingAttempts, 1);
      await assertAllIntentsSchemaValid();

      const retry = await deliver(s.payload);
      assert.equal(retry.status, 200);
      const afterRetry = await snapshot(s);
      assert.equal(afterRetry.payments.length, 1);
      assert.equal(afterRetry.lineItem?.amountPaidMinor, 50_000);
      assert.equal(afterRetry.invoice?.status, "paid");
      assert.equal(afterRetry.credit?.balanceMinor, 10_000);
      assert.equal(afterRetry.credit?.entries, 1);
      const repaired = await rawIntent(s.intentId!);
      assert.equal(repaired?.status, "succeeded");
      assert.equal(repaired?.lastPostingError, null);
    });
  }
});

describe("6. historical processing intents", () => {
  async function markLegacyProcessing(intentId: mongoose.Types.ObjectId) {
    await mongoose.connection
      .db!.collection("paymentintents")
      .updateOne({ _id: intentId }, { $set: { status: "processing", failureReason: null } });
  }

  test("stuck intent with orphan line-item write is repaired without double counting", async () => {
    const s = await seed();
    await markLegacyProcessing(s.intentId!);
    // Old code wrote line items before crashing, without a Payment.
    await InvoiceLineItem.updateOne(
      { _id: s.lineItemId },
      { $set: { amountPaidMinor: 50_000, amountOutstandingMinor: 0, isFullyPaid: true, status: "paid" } }
    );

    assert.equal((await deliver(s.payload)).status, 200);
    const snap = await snapshot(s);
    assert.equal(snap.payments.length, 1);
    assert.equal(snap.allocations.length, 1, "allocated against true outstanding, not stale line item");
    assert.equal(snap.lineItem?.amountPaidMinor, 50_000);
    assert.equal(snap.invoice?.status, "paid");
    assert.equal(snap.credit, null, "no spurious overpayment credit");
    assert.equal((await rawIntent(s.intentId!))?.status, "succeeded");
    await assertAllIntentsSchemaValid();
  });

  test("stuck intent with orphan credit reuses the legacy payment id and does not credit twice", async () => {
    const s = await seed({ invoiceAmountMinor: 50_000, chargeAmountMinor: 60_000 });
    await markLegacyProcessing(s.intentId!);
    const legacyPaymentId = oid();
    await InvoiceLineItem.updateOne(
      { _id: s.lineItemId },
      { $set: { amountPaidMinor: 50_000, amountOutstandingMinor: 0, isFullyPaid: true, status: "paid" } }
    );
    await StudentCreditBalance.create({
      schoolId: s.schoolId,
      studentId: s.studentId,
      balanceMinor: 10_000,
      entries: [
        { type: "credit", amountMinor: 10_000, reason: "Overpayment", sourcePaymentId: legacyPaymentId },
      ],
    });
    await InvoiceEvent.create({
      schoolId: s.schoolId,
      invoiceId: s.invoiceId,
      studentId: s.studentId,
      eventType: "adjustment_added",
      description: "Credit added from overpayment",
      metadata: { amountMinor: 10_000, sourcePaymentId: legacyPaymentId },
      relatedPaymentId: legacyPaymentId,
      performedBy: null,
    });

    assert.equal((await deliver(s.payload)).status, 200);
    const snap = await snapshot(s);
    assert.equal(snap.payments.length, 1);
    assert.equal(String(snap.payments[0]._id), String(legacyPaymentId), "links to orphan writes");
    assert.equal(snap.credit?.balanceMinor, 10_000, "credit not doubled");
    assert.equal(snap.credit?.entries, 1);
    assert.deepEqual(snap.invoiceEvents, ["adjustment_added", "payment_recorded"]);
    assert.equal((await rawIntent(s.intentId!))?.status, "succeeded");
  });

  test("ambiguous legacy partial state is flagged for reconciliation instead of guessed", async () => {
    const s = await seed();
    await markLegacyProcessing(s.intentId!);
    for (const relatedPaymentId of [oid(), oid()]) {
      await InvoiceEvent.create({
        schoolId: s.schoolId,
        invoiceId: s.invoiceId,
        studentId: s.studentId,
        eventType: "payment_recorded",
        description: "Payment recorded",
        relatedPaymentId,
        performedBy: null,
      });
    }

    assert.equal((await deliver(s.payload)).status, 200);
    assert.equal((await snapshot(s)).payments.length, 0);
    const intent = await rawIntent(s.intentId!);
    assert.equal(intent?.status, "reconciliation_required");
    assert.equal(intent?.reconciliationReason, "legacy_partial_state_ambiguous");
    await assertAllIntentsSchemaValid();
  });
});

describe("7. missing invoice", () => {
  test("persists reconciliation_required, posts nothing, and recovers once the invoice exists", async () => {
    const s = await seed({ createInvoice: false });
    const first = await deliver(s.payload);
    assert.equal(first.status, 200, "acknowledged: retrying cannot fix a missing invoice");

    const flagged = await rawIntent(s.intentId!);
    assert.equal(flagged?.status, "reconciliation_required");
    assert.equal(flagged?.reconciliationReason, "invoice_not_found");
    assert.ok(flagged?.reconciliationRequiredAt instanceof Date);
    assert.equal(flagged?.paystackReference, s.reference);
    assert.equal(flagged?.parentPayableMinor, 50_000, "intended amount preserved");
    assert.equal(flagged?.reconciliationDetails?.provider?.amountMinor, 50_000, "provider amount recorded");
    assert.equal(flagged?.reconciliationDetails?.provider?.currency, "GHS");
    assert.equal(await Payment.countDocuments({ paystackReference: s.reference }), 0);
    await assertAllIntentsSchemaValid();

    await createInvoice({
      schoolId: s.schoolId,
      studentId: s.studentId,
      invoiceId: s.invoiceId,
      lineItemId: s.lineItemId,
      invoiceAmountMinor: 50_000,
    });
    assert.equal((await deliver(s.payload)).status, 200);
    const snap = await snapshot(s);
    assert.equal(snap.payments.length, 1);
    assert.equal(snap.invoice?.status, "paid");
    const recovered = await rawIntent(s.intentId!);
    assert.equal(recovered?.status, "succeeded");
    assert.equal(recovered?.reconciliationReason, null);
    assert.equal(recovered?.reconciliationDetails, null);
  });
});

describe("8. charge validation against the persisted intent", () => {
  /** Asserts a charge was recorded for reconciliation on the intent and nothing was posted. */
  async function assertRecordedOnIntent(
    s: Seed,
    before: Awaited<ReturnType<typeof snapshot>>,
    reason: string,
    mismatches: string[]
  ) {
    assert.deepEqual(await snapshot(s), before, "nothing posted");
    const intent = await rawIntent(s.intentId!);
    assert.equal(intent?.status, "reconciliation_required", "never failed, never succeeded");
    assert.equal(intent?.reconciliationReason, reason);
    assert.deepEqual(intent?.reconciliationDetails?.mismatches, mismatches);
    assert.ok(intent?.reconciliationDetails?.provider, "provider facts persisted");
    assert.ok(intent?.reconciliationDetails?.expected, "expected facts persisted");
    assert.equal(intent?.paystackReference, s.reference, "own reference not overwritten");
    assert.equal(intent?.failureReason, null);
    await assertAllIntentsSchemaValid();
    return intent!;
  }

  test("correct amount (parent pays the platform fee) posts the invoice amount, not the gateway amount", async () => {
    const s = await seed({ invoiceAmountMinor: 50_000, platformFeeMinor: 1_000 });
    assert.equal(s.data.amount, 51_000);
    assert.equal((await deliver(s.payload)).status, 200);
    const snap = await snapshot(s);
    assert.equal(snap.payments.length, 1);
    assert.equal(snap.payments[0].amountMinor, 50_000);
    assert.equal(snap.invoice?.status, "paid");
    assert.equal(snap.credit, null, "fee is not credited as overpayment");
    assert.equal((await rawIntent(s.intentId!))?.status, "succeeded");
  });

  for (const variant of [
    { name: "lower", amount: 40_000 },
    { name: "higher", amount: 60_000 },
  ]) {
    test(`${variant.name} Paystack amount is recorded as amount_mismatch and never posted`, async () => {
      const s = await seed();
      const before = await snapshot(s);
      const res = await deliver(chargeWith(s, (d) => (d.amount = variant.amount)));
      assert.equal(res.status, 200, "acknowledged: a retry cannot fix a mismatch");
      const intent = await assertRecordedOnIntent(s, before, "amount_mismatch", ["amount_mismatch"]);
      assert.equal(intent.reconciliationDetails.provider.amountMinor, variant.amount);
      assert.equal(intent.reconciliationDetails.expected.amountMinor, 50_000);
      assert.equal(intent.parentPayableMinor, 50_000, "intended amount not overwritten");
    });
  }

  test("wrong currency is recorded as currency_mismatch and never posted", async () => {
    const s = await seed();
    const before = await snapshot(s);
    await deliver(chargeWith(s, (d) => (d.currency = "USD")));
    const intent = await assertRecordedOnIntent(s, before, "currency_mismatch", ["currency_mismatch"]);
    assert.equal(intent.reconciliationDetails.provider.currency, "USD");
    assert.equal(intent.reconciliationDetails.expected.currency, "GHS");
  });

  test("all mismatches are listed; the primary reason follows priority", async () => {
    const s = await seed();
    const before = await snapshot(s);
    await deliver(
      chargeWith(s, (d) => {
        d.currency = "NGN";
        d.amount = 1;
      })
    );
    await assertRecordedOnIntent(s, before, "currency_mismatch", ["currency_mismatch", "amount_mismatch"]);
  });

  for (const field of ["invoiceId", "studentId", "schoolId"] as const) {
    test(`metadata ${field} that differs from the intent is recorded as metadata_mismatch and posts to neither target`, async () => {
      const s = await seed();
      const other = await seed({ withIntent: false });
      const before = await snapshot(s);
      const otherBefore = await snapshot(other);
      await deliver(chargeWith(s, (d) => (d.metadata[field] = String(other[field]))));
      await assertRecordedOnIntent(s, before, "metadata_mismatch", ["metadata_mismatch"]);
      assert.deepEqual(await snapshot(other), otherBefore, "metadata target untouched");
    });
  }

  test("a foreign reference is recorded as an unmatched charge; the intent stays claimable and later posts", async () => {
    const s = await seed();
    const before = await snapshot(s);
    const foreign = `EDSX-FEE-${oid()}-${Date.now()}`;
    await deliver(chargeWith(s, (d) => (d.reference = foreign)));

    assert.deepEqual(await snapshot(s), before);
    assert.equal(await Payment.countDocuments({ paystackReference: foreign }), 0);
    const intent = await rawIntent(s.intentId!);
    assert.equal(intent?.status, "awaiting_webhook", "intent untouched by another transaction");
    const [record] = await unmatchedRecords();
    assert.equal(record.reconciliationReason, "reference_mismatch");
    assert.equal(record.paystackReference, foreign);
    assert.equal(record.reconciliationDetails.relatedPaymentIntentId, String(s.intentId));

    assert.equal((await deliver(s.payload)).status, 200);
    assert.equal((await snapshot(s)).payments.length, 1, "genuine charge still posts");
    assert.equal((await unmatchedRecords()).length, 1, "unmatched record survives the genuine posting");
    await assertAllIntentsSchemaValid();
  });

  test("a second charge against an already-succeeded intent is recorded as unmatched, not posted", async () => {
    const s = await seed();
    await deliver(s.payload);
    const afterFirst = await snapshot(s);
    const second = `EDSX-FEE-${String(s.intentId)}-${Date.now() + 1}`;
    await deliver(chargeWith(s, (d) => (d.reference = second)));

    assert.deepEqual(await snapshot(s), afterFirst);
    assert.equal(await Payment.countDocuments({ paystackReference: second }), 0);
    assert.equal((await rawIntent(s.intentId!))?.status, "succeeded");
    const [record] = await unmatchedRecords();
    assert.equal(record.reconciliationReason, "reference_mismatch");
    assert.equal(record.paystackReference, second);
  });

  test("an unknown paymentIntentId is recorded as intent_not_found and never posted", async () => {
    const s = await seed({ withIntent: false });
    const before = await snapshot(s);
    await deliver(chargeWith(s, (d) => (d.metadata.paymentIntentId = String(oid()))));
    assert.deepEqual(await snapshot(s), before);
    const [record] = await unmatchedRecords();
    assert.equal(record.reconciliationReason, "intent_not_found");
    assert.equal(String(record.invoiceId), String(s.invoiceId), "metadata kept only as a label");
    await assertAllIntentsSchemaValid();
  });

  test("redelivered and concurrent mismatched charges stay idempotent", async () => {
    const s = await seed();
    const before = await snapshot(s);
    const payload = chargeWith(s, (d) => (d.amount = 1));
    await Promise.all(Array.from({ length: 5 }, () => deliver(payload)));
    await deliver(payload);
    await assertRecordedOnIntent(s, before, "amount_mismatch", ["amount_mismatch"]);
    assert.equal(await PaymentIntent.countDocuments({}), 1, "no extra records");
  });
});

describe("9. model validation", () => {
  test("Payment.paystackReference unique index is buildable and enforced", async () => {
    const indexes = await Payment.collection.indexes();
    const idx = indexes.find((i) => i.name === "paystackReference_1");
    assert.equal(idx?.unique, true);
    const base = {
      schoolId: oid(),
      studentId: oid(),
      invoiceId: oid(),
      amountMinor: 1,
      paymentDate: new Date(),
      paymentMethod: "paystack",
      status: "completed",
    };
    await Payment.create({ ...base, paystackReference: "REF-UNIQUE" });
    await assert.rejects(Payment.create({ ...base, paystackReference: "REF-UNIQUE" }), /E11000/);
    // Payments without a reference (cash, bank) are excluded from the constraint.
    await Payment.create({ ...base, paymentMethod: "cash" });
    await Payment.create({ ...base, paymentMethod: "cash" });
  });

  test("schema enum covers every status the posting flow persists", () => {
    const enumValues = (PaymentIntent.schema.path("status") as unknown as { enumValues: string[] })
      .enumValues;
    for (const status of ["awaiting_webhook", "processing", "reconciliation_required", "succeeded", "failed"]) {
      assert.ok(enumValues.includes(status), `${status} in enum`);
    }
    assert.deepEqual([...enumValues].sort(), [...PAYMENT_INTENT_STATUSES].sort());
  });

  test("invalid statuses are rejected by document and runValidators updates", async () => {
    const s = await seed();
    const doc = new PaymentIntent({
      schoolId: s.schoolId,
      studentId: s.studentId,
      invoiceId: s.invoiceId,
      amountMinor: 1,
      paymentMethod: "paystack",
      idempotencyKey: crypto.randomUUID(),
      status: "bogus",
    });
    assert.ok(doc.validateSync()?.errors?.status, "document validation rejects unknown status");
    await assert.rejects(
      PaymentIntent.updateOne({ _id: s.intentId }, { $set: { status: "bogus" } }, { runValidators: true })
    );
  });
});

describe("10. outbound call safety", () => {
  test("no real external HTTP call was attempted by any delivery", () => {
    assert.deepEqual(externalCalls, []);
  });
});
