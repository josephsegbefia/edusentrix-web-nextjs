/**
 * Fail-closed, atomic start of a Paystack fee checkout.
 *
 * 1. Every non-terminal intent for the invoice is evaluated. Anything that may
 *    still turn into money moving blocks; only provider-confirmed failures or
 *    attempts past their bounded window are released.
 * 2. The checkout slot is then claimed in one transaction together with the
 *    new intent: either a fresh `PaymentCheckoutLock` insert or a
 *    compare-and-set takeover from a terminal holder. Racing requests lose on
 *    the `_id` key or the compare-and-set, so exactly one attempt (and one
 *    provider initialization) proceeds.
 * 3. The provider is initialized outside the transaction.
 */
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { PaymentCheckoutLock, feeCheckoutLockKey } from "@/models/PaymentCheckoutLock";
import { PaymentIntent, type PaymentIntentStatus } from "@/models/PaymentIntent";

type ObjectId = mongoose.Types.ObjectId;

export const PAYMENT_PENDING_RECONCILIATION_CODE = "payment_pending_reconciliation";

export const PAYMENT_PENDING_RECONCILIATION_MESSAGE =
  "We've received a payment for this invoice and are confirming it. Please refresh in a moment.";

export const FEE_CHECKOUT_BLOCKS = {
  checkout_in_progress:
    "A payment for this invoice is already being started. Please wait a moment and check its status before trying again.",
  [PAYMENT_PENDING_RECONCILIATION_CODE]: PAYMENT_PENDING_RECONCILIATION_MESSAGE,
  payment_pending_verification:
    "Paystack is still processing an earlier payment for this invoice. Please finish that payment or try again after it expires.",
  payment_status_unknown:
    "We couldn't confirm the status of an earlier payment for this invoice. Please check its status again in a few minutes before paying.",
} as const;

export type FeeCheckoutBlockCode = keyof typeof FEE_CHECKOUT_BLOCKS;

/** A just-created attempt is still initializing; never verify or release it. */
export const CHECKOUT_INITIATION_GRACE_MS = 2 * 60 * 1000;
/** How long an attempt whose provider status cannot be read keeps blocking. */
export const UNKNOWN_STATUS_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Validity of an initialized checkout (matches the Paystack session window). */
export const CHECKOUT_INTENT_TTL_MS = 60 * 60 * 1000;

const MAX_VERIFICATIONS = 3;
const MAX_ACTIVE_INTENTS = 10;

const ACTIVE_STATUSES: PaymentIntentStatus[] = [
  "initiated",
  "awaiting_webhook",
  "processing",
  "reconciliation_required",
];
const TERMINAL_STATUSES: PaymentIntentStatus[] = ["succeeded", "failed", "cancelled", "expired"];

export type VerifyFn = (reference: string) => Promise<{ status?: string | null }>;
export type InitializeFn = (args: {
  reference: string;
  paymentIntentId: ObjectId;
}) => Promise<{ reference: string; authorizationUrl: string }>;

export type FeeCheckoutIntentFields = {
  amountMinor: number;
  platformFeeMinor: number;
  parentPayableMinor: number;
  payerMode: "payer_pays" | "school_absorbs" | "waived";
  currency: string;
  initiatedBy: ObjectId | null;
};

export type FeeCheckoutBlocked = {
  ok: false;
  code: FeeCheckoutBlockCode;
  message: string;
  reason: string;
  paymentIntentId: ObjectId | null;
};

export type FeeCheckoutStarted = {
  ok: true;
  paymentIntentId: ObjectId;
  reference: string;
  authorizationUrl: string;
  expiresAt: Date;
};

type ActiveIntentRow = {
  _id: ObjectId;
  status: PaymentIntentStatus;
  paystackReference?: string | null;
  initiatedAt?: Date | null;
  createdAt?: Date | null;
  expiresAt?: Date | null;
};

type Evaluation =
  | { action: "block"; code: FeeCheckoutBlockCode; reason: string }
  | { action: "release"; status: "failed" | "expired"; failureReason: string };

class CheckoutSlotTakenError extends Error {}

function blocked(
  code: FeeCheckoutBlockCode,
  reason: string,
  paymentIntentId: ObjectId | null
): FeeCheckoutBlocked {
  return { ok: false, code, message: FEE_CHECKOUT_BLOCKS[code], reason, paymentIntentId };
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

async function evaluateActiveIntent(
  intent: ActiveIntentRow,
  verify: VerifyFn,
  canVerify: boolean,
  now: Date
): Promise<Evaluation> {
  if (intent.status === "processing" || intent.status === "reconciliation_required") {
    return {
      action: "block",
      code: PAYMENT_PENDING_RECONCILIATION_CODE,
      reason: "provider_confirmed_pending_posting",
    };
  }

  const startedAt = (intent.initiatedAt ?? intent.createdAt ?? now).getTime();
  const ageMs = now.getTime() - startedAt;

  if (intent.status === "initiated" && ageMs < CHECKOUT_INITIATION_GRACE_MS) {
    return { action: "block", code: "checkout_in_progress", reason: "initialization_in_progress" };
  }

  const unknown = (reason: string): Evaluation =>
    ageMs < UNKNOWN_STATUS_WINDOW_MS
      ? { action: "block", code: "payment_status_unknown", reason }
      : {
          action: "release",
          status: "expired",
          failureReason: "Payment status could not be confirmed within the checkout window.",
        };

  const reference = (intent.paystackReference || "").trim();
  if (!reference) return unknown("reference_unavailable");
  if (!canVerify) return unknown("verification_limit_reached");

  let providerStatus: string;
  try {
    const verification = await verify(reference);
    providerStatus = String(verification?.status || "").toLowerCase();
  } catch (error) {
    console.warn("Fee checkout guard: could not verify earlier payment attempt", {
      paymentIntentId: String(intent._id),
      error: error instanceof Error ? error.message : String(error),
    });
    return unknown("verification_unavailable");
  }

  if (providerStatus === "success") {
    return {
      action: "block",
      code: PAYMENT_PENDING_RECONCILIATION_CODE,
      reason: "provider_reports_success",
    };
  }
  if (providerStatus === "failed" || providerStatus === "abandoned") {
    return {
      action: "release",
      status: "failed",
      failureReason: "Paystack reports this payment did not complete.",
    };
  }
  if (intent.expiresAt && now < intent.expiresAt) {
    return { action: "block", code: "payment_pending_verification", reason: "provider_pending" };
  }
  return {
    action: "release",
    status: "expired",
    failureReason: "Checkout expired before Paystack confirmed the payment.",
  };
}

/**
 * Returns a block when any existing attempt for this invoice may still move
 * money, after releasing attempts that are provably dead or past their window.
 */
export async function evaluateExistingFeeIntents(args: {
  schoolId: ObjectId;
  invoiceId: ObjectId;
  verify: VerifyFn;
  now?: Date;
}): Promise<FeeCheckoutBlocked | null> {
  const now = args.now ?? new Date();

  const active = await PaymentIntent.find({
    schoolId: args.schoolId,
    invoiceId: args.invoiceId,
    status: { $in: ACTIVE_STATUSES },
  })
    .sort({ createdAt: -1 })
    .limit(MAX_ACTIVE_INTENTS + 1)
    .select("_id status paystackReference initiatedAt createdAt expiresAt")
    .lean<ActiveIntentRow[]>();

  if (active.length > MAX_ACTIVE_INTENTS) {
    return blocked("payment_status_unknown", "too_many_active_attempts", active[0]._id);
  }

  let verifications = 0;
  for (const intent of active) {
    const needsVerify =
      intent.status === "awaiting_webhook" ||
      (intent.status === "initiated" && Boolean(intent.paystackReference));
    const evaluation = await evaluateActiveIntent(
      intent,
      args.verify,
      verifications < MAX_VERIFICATIONS,
      now
    );
    if (needsVerify) verifications += 1;

    if (evaluation.action === "block") {
      return blocked(evaluation.code, evaluation.reason, intent._id);
    }

    const released = await PaymentIntent.updateOne(
      { _id: intent._id, status: intent.status },
      {
        $set: {
          status: evaluation.status,
          failureReason: evaluation.failureReason,
          expiresAt: null,
        },
      },
      { runValidators: true }
    );
    if (released.modifiedCount !== 1) {
      // The attempt changed state concurrently; re-evaluation is the caller's retry.
      return blocked("checkout_in_progress", "attempt_state_changed", intent._id);
    }
  }

  return null;
}

/**
 * Claims the per-invoice checkout slot and creates the new intent atomically.
 * Throws CheckoutSlotTakenError when another attempt holds a live slot.
 */
async function claimCheckoutSlot(args: {
  schoolId: ObjectId;
  studentId: ObjectId;
  invoiceId: ObjectId;
  intentId: ObjectId;
  reference: string;
  intentFields: FeeCheckoutIntentFields;
  now: Date;
}) {
  const lockKey = feeCheckoutLockKey(args.schoolId, args.invoiceId);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const lock = await PaymentCheckoutLock.findById(lockKey)
        .session(session)
        .lean<{ _id: string; paymentIntentId: ObjectId } | null>();

      if (!lock) {
        await PaymentCheckoutLock.create(
          [
            {
              _id: lockKey,
              schoolId: args.schoolId,
              invoiceId: args.invoiceId,
              paymentIntentId: args.intentId,
              acquiredAt: args.now,
            },
          ],
          { session }
        );
      } else {
        const holder = await PaymentIntent.findById(lock.paymentIntentId)
          .select("status")
          .session(session)
          .lean<{ status: PaymentIntentStatus } | null>();
        if (holder && !TERMINAL_STATUSES.includes(holder.status)) {
          throw new CheckoutSlotTakenError();
        }
        const takeover = await PaymentCheckoutLock.updateOne(
          { _id: lockKey, paymentIntentId: lock.paymentIntentId },
          { $set: { paymentIntentId: args.intentId, acquiredAt: args.now } },
          { session }
        );
        if (takeover.modifiedCount !== 1) throw new CheckoutSlotTakenError();
      }

      await PaymentIntent.create(
        [
          {
            _id: args.intentId,
            schoolId: args.schoolId,
            studentId: args.studentId,
            invoiceId: args.invoiceId,
            amountMinor: args.intentFields.amountMinor,
            platformFeeMinor: args.intentFields.platformFeeMinor,
            parentPayableMinor: args.intentFields.parentPayableMinor,
            payerMode: args.intentFields.payerMode,
            currency: args.intentFields.currency,
            status: "initiated",
            paymentMethod: "paystack",
            paystackReference: args.reference,
            idempotencyKey: randomUUID(),
            initiatedBy: args.intentFields.initiatedBy,
            initiatedAt: args.now,
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function startFeeCheckoutAttempt(args: {
  schoolId: ObjectId;
  studentId: ObjectId;
  invoiceId: ObjectId;
  intentFields: FeeCheckoutIntentFields;
  verify: VerifyFn;
  initialize: InitializeFn;
  now?: Date;
}): Promise<FeeCheckoutStarted | FeeCheckoutBlocked> {
  const now = args.now ?? new Date();

  const block = await evaluateExistingFeeIntents({
    schoolId: args.schoolId,
    invoiceId: args.invoiceId,
    verify: args.verify,
    now,
  });
  if (block) return block;

  const intentId = new mongoose.Types.ObjectId();
  const reference = `EDSX-FEE-${String(intentId)}-${now.getTime()}`;

  try {
    await claimCheckoutSlot({
      schoolId: args.schoolId,
      studentId: args.studentId,
      invoiceId: args.invoiceId,
      intentId,
      reference,
      intentFields: args.intentFields,
      now,
    });
  } catch (error) {
    if (error instanceof CheckoutSlotTakenError || isDuplicateKeyError(error)) {
      return blocked("checkout_in_progress", "slot_held_by_concurrent_attempt", null);
    }
    throw error;
  }

  let init: { reference: string; authorizationUrl: string };
  try {
    init = await args.initialize({ reference, paymentIntentId: intentId });
  } catch (initError) {
    await PaymentIntent.updateOne(
      { _id: intentId, status: "initiated" },
      {
        $set: {
          status: "failed",
          failureReason:
            initError instanceof Error ? initError.message.slice(0, 500) : "Checkout failed",
        },
      },
      { runValidators: true }
    ).catch(() => undefined);
    throw initError;
  }

  if (init.reference !== reference) {
    console.warn("Fee checkout: provider returned a different reference", {
      paymentIntentId: String(intentId),
      expected: reference,
      received: init.reference,
    });
  }

  const expiresAt = new Date(now.getTime() + CHECKOUT_INTENT_TTL_MS);
  // Conditional: a fast webhook may already have posted this intent.
  await PaymentIntent.updateOne(
    { _id: intentId, status: "initiated" },
    {
      $set: {
        status: "awaiting_webhook",
        paystackReference: init.reference,
        expiresAt,
        failureReason: null,
      },
    },
    { runValidators: true }
  );

  return {
    ok: true,
    paymentIntentId: intentId,
    reference: init.reference,
    authorizationUrl: init.authorizationUrl,
    expiresAt,
  };
}
