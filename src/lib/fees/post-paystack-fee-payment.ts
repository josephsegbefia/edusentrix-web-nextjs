/**
 * Atomic, idempotent posting of a provider-confirmed Paystack school-fee charge.
 *
 * All financial writes (Payment, allocations, credit, invoice events, audit
 * events, invoice/line-item totals, intent state) commit in one MongoDB
 * transaction keyed on the Paystack reference. Concurrent deliveries serialize
 * on the PaymentIntent and Invoice documents (write conflicts are retried by
 * `withTransaction`), and `Payment.paystackReference` is unique.
 *
 * A charge is only posted when its reference, amount, currency and metadata
 * match the persisted PaymentIntent; anything else is recorded as
 * `reconciliation_required` and never posted or marked failed.
 *
 * Callers must perform signature/provider verification first and run external
 * side effects (email, notifications, ledger) only after this resolves.
 */
import crypto from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import { PaymentIntent, type PaymentIntentStatus } from "@/models/PaymentIntent";
import { generatePaymentInternalReference } from "@/models/PaymentReferenceCounter";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { allocateToInvoiceLineItems } from "@/lib/fees/allocateToInvoiceLineItems";
import { formatMoney } from "@/lib/fees/money";
import { reconcileInvoicePaymentState } from "@/lib/fees/reconcile-invoice-payment-state";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import type { AuditRequestContext } from "@/lib/audit/types";

type ObjectId = mongoose.Types.ObjectId;

export type PaystackFeeChargeData = {
  id?: number;
  reference: string;
  amount: number;
  fees?: number;
  currency?: string;
  status: string;
  gateway_response?: string;
  channel?: string;
  paid_at?: string;
  created_at?: string;
  metadata?: {
    schoolId?: string;
    invoiceId?: string;
    studentId?: string;
    paymentIntentId?: string;
    parentUserId?: string;
    invoiceAmountMinor?: number | string | null;
    payerMode?: string | null;
    edusentrixTransactionFeeMinor?: number | string | null;
  } & Record<string, unknown>;
};

export type FeePostingLedgerData = {
  schoolId: ObjectId;
  studentId: ObjectId;
  invoiceId: ObjectId;
  paymentId: ObjectId;
  amountMinor: number;
  currency: string;
  reference: string;
  paymentDate: Date;
  invoiceNumber: string | null;
  academicPeriodId: string | null;
};

export type FeePostingResult =
  | {
      outcome: "posted";
      ledger: FeePostingLedgerData;
      followUp: {
        parentUserId: ObjectId | null;
        balanceMinor: number;
        receiptNumber: string;
      };
    }
  | { outcome: "already_posted"; ledger: FeePostingLedgerData | null }
  | {
      outcome: "reconciliation_required";
      reason: FeeReconciliationReason;
      paymentIntentId: ObjectId | null;
    };

export type FeeReconciliationReason =
  | "invoice_not_found"
  | "reference_belongs_to_other_school"
  | "legacy_partial_state_ambiguous"
  | ChargeMismatch
  | "intent_not_found"
  | "intent_missing";

/** Ordered by priority: the first detected mismatch becomes the primary reason. */
const CHARGE_MISMATCHES = [
  "reference_mismatch",
  "metadata_mismatch",
  "currency_mismatch",
  "amount_mismatch",
] as const;
type ChargeMismatch = (typeof CHARGE_MISMATCHES)[number];

export class InvalidFeeMetadataError extends Error {}

const DUPLICATE_KEY = 11000;
const DEFAULT_CURRENCY = "GHS";

type IntentRow = {
  _id: ObjectId;
  schoolId: ObjectId;
  studentId: ObjectId;
  invoiceId: ObjectId;
  status: PaymentIntentStatus;
  amountMinor?: number;
  platformFeeMinor?: number;
  parentPayableMinor?: number;
  payerMode?: "payer_pays" | "school_absorbs" | "waived";
  paystackReference?: string | null;
  currency?: string | null;
  initiatedBy?: ObjectId | null;
  paymentId?: ObjectId | null;
  createdAt?: Date;
};

const INTENT_FIELDS =
  "schoolId studentId invoiceId status amountMinor platformFeeMinor parentPayableMinor payerMode paystackReference currency initiatedBy paymentId createdAt";

type ProviderFacts = {
  reference: string;
  amountMinor: number | null;
  currency: string | null;
  feesMinor: number | null;
  paidAt: string | null;
  metadata: {
    schoolId: string | null;
    invoiceId: string | null;
    studentId: string | null;
    paymentIntentId: string | null;
  };
};

function providerFacts(data: PaystackFeeChargeData): ProviderFacts {
  const amount = Number(data.amount);
  const fees = Number(data.fees);
  const meta = data.metadata;
  return {
    reference: data.reference,
    amountMinor: Number.isFinite(amount) ? Math.round(amount) : null,
    currency: data.currency ? String(data.currency).toUpperCase() : null,
    feesMinor: Number.isFinite(fees) ? Math.round(fees) : null,
    paidAt: data.paid_at || null,
    metadata: {
      schoolId: meta?.schoolId ? String(meta.schoolId) : null,
      invoiceId: meta?.invoiceId ? String(meta.invoiceId) : null,
      studentId: meta?.studentId ? String(meta.studentId) : null,
      paymentIntentId: meta?.paymentIntentId ? String(meta.paymentIntentId) : null,
    },
  };
}

function expectedChargeAmountMinor(intent: IntentRow) {
  const parentPayable = Math.round(Number(intent.parentPayableMinor || 0));
  return parentPayable > 0 ? parentPayable : Math.round(Number(intent.amountMinor || 0));
}

function intentCurrency(intent: IntentRow) {
  return String(intent.currency || DEFAULT_CURRENCY).toUpperCase();
}

function referenceMatchesIntent(intent: IntentRow, reference: string) {
  if (intent.paystackReference) return intent.paystackReference === reference;
  return reference.startsWith(`EDSX-FEE-${String(intent._id)}-`);
}

/**
 * Compares the provider charge with the persisted intent. Webhook metadata is
 * only compared, never trusted: posting always uses the intent's own values.
 */
function findChargeMismatches(intent: IntentRow, facts: ProviderFacts) {
  const mismatches: ChargeMismatch[] = [];
  if (!referenceMatchesIntent(intent, facts.reference)) mismatches.push("reference_mismatch");
  if (
    facts.metadata.schoolId !== String(intent.schoolId) ||
    facts.metadata.invoiceId !== String(intent.invoiceId) ||
    facts.metadata.studentId !== String(intent.studentId)
  ) {
    mismatches.push("metadata_mismatch");
  }
  if (facts.currency !== intentCurrency(intent)) mismatches.push("currency_mismatch");
  if (facts.amountMinor !== expectedChargeAmountMinor(intent)) mismatches.push("amount_mismatch");

  return {
    mismatches: CHARGE_MISMATCHES.filter((m) => mismatches.includes(m)),
    expected: {
      reference: intent.paystackReference || `EDSX-FEE-${String(intent._id)}-*`,
      amountMinor: expectedChargeAmountMinor(intent),
      currency: intentCurrency(intent),
      schoolId: String(intent.schoolId),
      invoiceId: String(intent.invoiceId),
      studentId: String(intent.studentId),
    },
  };
}

/**
 * Deterministic id so duplicate or concurrent deliveries of the same unmatched
 * charge converge on one record using only the built-in `_id` index.
 */
export function unmatchedChargeIntentId(reference: string) {
  const hex = crypto
    .createHash("sha256")
    .update(`paystack-unmatched:${reference}`)
    .digest("hex")
    .slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

type LegacyPartialState = {
  paymentId: ObjectId;
  creditApplied: boolean;
  adjustmentEventExists: boolean;
  paymentRecordedEventExists: boolean;
};

function parseObjectId(value: unknown): ObjectId | null {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === DUPLICATE_KEY
  );
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

/**
 * Older webhook code wrote line items, credit and invoice events before
 * creating the Payment, using a pre-generated payment id. If such a run
 * crashed, those orphan writes reference an id with no Payment. Reusing that
 * id lets the repair link to them instead of crediting the student twice.
 */
async function findLegacyPartialState(args: {
  schoolId: ObjectId;
  studentId: ObjectId;
  invoiceId: ObjectId;
  since: Date | undefined;
  session: ClientSession;
}): Promise<LegacyPartialState | "ambiguous" | null> {
  const events = await InvoiceEvent.find({
    schoolId: args.schoolId,
    invoiceId: args.invoiceId,
    eventType: { $in: ["adjustment_added", "payment_recorded"] },
    relatedPaymentId: { $ne: null },
    ...(args.since ? { createdAt: { $gte: args.since } } : {}),
  })
    .select("eventType relatedPaymentId")
    .session(args.session)
    .lean<Array<{ eventType: string; relatedPaymentId: ObjectId }>>();

  if (events.length === 0) return null;

  const candidateIds = [...new Set(events.map((e) => String(e.relatedPaymentId)))];
  const existing = await Payment.find({
    _id: { $in: candidateIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("_id")
    .session(args.session)
    .lean<Array<{ _id: ObjectId }>>();
  const existingIds = new Set(existing.map((p) => String(p._id)));
  const orphanIds = candidateIds.filter((id) => !existingIds.has(id));

  if (orphanIds.length === 0) return null;
  if (orphanIds.length > 1) return "ambiguous";

  const paymentId = new mongoose.Types.ObjectId(orphanIds[0]);
  const credit = await StudentCreditBalance.findOne({
    schoolId: args.schoolId,
    studentId: args.studentId,
    "entries.sourcePaymentId": paymentId,
  })
    .select("_id")
    .session(args.session)
    .lean();

  const orphanEvents = events.filter((e) => String(e.relatedPaymentId) === orphanIds[0]);
  return {
    paymentId,
    creditApplied: Boolean(credit),
    adjustmentEventExists: orphanEvents.some((e) => e.eventType === "adjustment_added"),
    paymentRecordedEventExists: orphanEvents.some((e) => e.eventType === "payment_recorded"),
  };
}

export async function postPaystackFeePayment(args: {
  data: PaystackFeeChargeData;
  auditContext: AuditRequestContext;
}): Promise<FeePostingResult> {
  const { data, auditContext } = args;
  const { reference, metadata } = data;

  // Metadata ids are labels for unmatched-charge records only; posting uses
  // the persisted intent's ids.
  const labelSchoolId = parseObjectId(metadata?.schoolId);
  const labelInvoiceId = parseObjectId(metadata?.invoiceId);
  const labelStudentId = parseObjectId(metadata?.studentId);
  if (!reference || !labelSchoolId || !labelInvoiceId || !labelStudentId) {
    throw new InvalidFeeMetadataError("Invalid Paystack fee metadata");
  }
  const paymentIntentId = parseObjectId(metadata?.paymentIntentId);

  await connectToDatabase();

  // Generated outside the transaction to keep the per-school counter document
  // out of the write set; an aborted or unposted attempt only leaves a gap.
  let internalReference: string | null = null;
  if (paymentIntentId && !(await Payment.exists({ paystackReference: reference }))) {
    const intentSchool = await PaymentIntent.findById(paymentIntentId)
      .select("schoolId")
      .lean<{ schoolId: ObjectId } | null>();
    if (intentSchool?.schoolId) {
      internalReference = await generatePaymentInternalReference(intentSchool.schoolId, "paystack");
    }
  }

  const run = () =>
    runPostingTransaction({
      data,
      auditContext,
      labels: { schoolId: labelSchoolId, invoiceId: labelInvoiceId, studentId: labelStudentId },
      paymentIntentId,
      internalReference,
    });

  try {
    try {
      return await run();
    } catch (error) {
      // A concurrent delivery committed the same reference first; re-running
      // observes that Payment and returns already_posted.
      if (isDuplicateKeyError(error)) return await run();
      throw error;
    }
  } catch (error) {
    if (paymentIntentId) {
      await PaymentIntent.updateOne(
        { _id: paymentIntentId, status: { $ne: "succeeded" } },
        {
          $set: { lastPostingError: errorMessage(error), lastPostingAttemptAt: new Date() },
          $inc: { postingAttempts: 1 },
        },
        { runValidators: true }
      ).catch((recordError) => {
        console.error("Paystack fee posting: failed to record posting error", {
          reference,
          recordError,
        });
      });
    }
    throw error;
  }
}

async function runPostingTransaction(args: {
  data: PaystackFeeChargeData;
  auditContext: AuditRequestContext;
  labels: { schoolId: ObjectId; invoiceId: ObjectId; studentId: ObjectId };
  paymentIntentId: ObjectId | null;
  internalReference: string | null;
}): Promise<FeePostingResult> {
  const { data, auditContext, labels, paymentIntentId } = args;
  const { reference } = data;
  const facts = providerFacts(data);
  const gatewayAmountMinor = Math.max(0, facts.amountMinor ?? 0);
  const processorFeeMinor = Math.max(0, facts.feesMinor ?? 0);

  const session = await mongoose.startSession();
  try {
    let result: FeePostingResult | null = null;

    await session.withTransaction(async () => {
      result = null;
      const now = new Date();

      const loadedIntent = paymentIntentId
        ? await PaymentIntent.findById(paymentIntentId)
            .select(INTENT_FIELDS)
            .session(session)
            .lean<IntentRow | null>()
        : null;

      const reconcile = async (
        reason: FeeReconciliationReason,
        details: Record<string, unknown> = {}
      ) => {
        result = await recordReconciliationRequired(session, {
          intent: loadedIntent,
          labels,
          reason,
          facts,
          details,
          now,
        });
      };

      // 1. Already posted for this provider reference: repair intent + totals.
      const existingPayment = await Payment.findOne({ paystackReference: reference })
        .select("_id schoolId studentId invoiceId amountMinor paymentDate status")
        .session(session)
        .lean<{
          _id: ObjectId;
          schoolId: ObjectId;
          studentId: ObjectId;
          invoiceId: ObjectId | null;
          amountMinor: number;
          paymentDate: Date;
          status: string;
        } | null>();

      if (existingPayment) {
        const expectedSchoolId = loadedIntent?.schoolId ?? labels.schoolId;
        if (String(existingPayment.schoolId) !== String(expectedSchoolId)) {
          await reconcile("reference_belongs_to_other_school", {
            existingPaymentId: String(existingPayment._id),
            existingPaymentSchoolId: String(existingPayment.schoolId),
          });
          return;
        }

        const schoolId = existingPayment.schoolId;
        const targetInvoiceId = existingPayment.invoiceId || loadedIntent?.invoiceId || labels.invoiceId;
        const { invoice } = await reconcileInvoicePaymentState({
          schoolId,
          invoiceId: targetInvoiceId,
          session,
        });

        if (
          loadedIntent &&
          existingPayment.status === "completed" &&
          referenceMatchesIntent(loadedIntent, reference)
        ) {
          await PaymentIntent.updateOne(
            { _id: loadedIntent._id, schoolId },
            {
              $set: {
                status: "succeeded",
                paymentId: existingPayment._id,
                paystackReference: reference,
                failureReason: null,
                reconciliationReason: null,
                reconciliationDetails: null,
                reconciliationRequiredAt: null,
                lastPostingError: null,
                expiresAt: null,
              },
            },
            { session, runValidators: true }
          );
        }

        result = {
          outcome: "already_posted",
          ledger:
            existingPayment.status === "completed"
              ? {
                  schoolId,
                  studentId: existingPayment.studentId,
                  invoiceId: targetInvoiceId,
                  paymentId: existingPayment._id,
                  amountMinor: Number(existingPayment.amountMinor || 0),
                  currency: loadedIntent ? intentCurrency(loadedIntent) : facts.currency || DEFAULT_CURRENCY,
                  reference,
                  paymentDate: existingPayment.paymentDate,
                  invoiceNumber: invoice?.invoiceNumber || null,
                  academicPeriodId: invoice?.academicPeriodId
                    ? String(invoice.academicPeriodId)
                    : null,
                }
              : null,
        };
        return;
      }

      // 2. The charge must belong to a persisted intent and match it exactly.
      if (!loadedIntent) {
        await reconcile(paymentIntentId ? "intent_not_found" : "intent_missing");
        return;
      }

      const { mismatches, expected } = findChargeMismatches(loadedIntent, facts);
      if (mismatches.length > 0) {
        await reconcile(mismatches[0], { mismatches, expected });
        return;
      }

      // 3. Claim the intent. This write is the per-intent mutex: concurrent
      //    transactions touching the same intent hit a WriteConflict and retry.
      //    Any non-succeeded state is claimable: a verified charge.success means
      //    money moved, so the payment must be posted.
      const intent = await PaymentIntent.findOneAndUpdate(
        { _id: loadedIntent._id, status: { $ne: "succeeded" } },
        { $set: { lastPostingAttemptAt: now }, $inc: { postingAttempts: 1 } },
        { session, new: false, runValidators: true }
      )
        .select(INTENT_FIELDS)
        .lean<IntentRow | null>();

      if (!intent) {
        console.warn("Paystack fee posting: intent already succeeded under another payment", {
          reference,
          paymentIntentId: String(loadedIntent._id),
          paymentId: loadedIntent.paymentId ? String(loadedIntent.paymentId) : null,
        });
        result = { outcome: "already_posted", ledger: null };
        return;
      }

      const { schoolId, invoiceId, studentId } = intent;
      const currency = intentCurrency(intent);
      const platformFeeMinor = Math.max(0, Math.round(Number(intent.platformFeeMinor || 0)));
      const netSchoolAmountMinor = Math.max(
        0,
        gatewayAmountMinor - platformFeeMinor - processorFeeMinor
      );

      // 4. Invoice must exist; otherwise persist a recoverable state.
      const invoice = await Invoice.findOne({ _id: invoiceId, schoolId, studentId })
        .select("_id invoiceNumber academicPeriodId")
        .session(session)
        .lean<{ _id: ObjectId; invoiceNumber?: string | null; academicPeriodId?: ObjectId | null } | null>();

      if (!invoice) {
        await reconcile("invoice_not_found");
        return;
      }

      // 5. Legacy partial writes from the pre-transaction code path.
      let legacy: LegacyPartialState | null = null;
      if (intent.status === "processing") {
        const found = await findLegacyPartialState({
          schoolId,
          studentId,
          invoiceId,
          since: intent.createdAt,
          session,
        });
        if (found === "ambiguous") {
          await reconcile("legacy_partial_state_ambiguous");
          return;
        }
        legacy = found;
      }

      if (!args.internalReference) {
        throw new Error("Payment internal reference unavailable; retry delivery");
      }

      const parentUserId = intent.initiatedBy ?? null;
      const amountMinor = Math.max(0, Math.round(Number(intent.amountMinor || 0)));

      // 6. Rebuild line items from committed payments first, so allocations are
      //    computed against true outstanding amounts (this also discards any
      //    orphan line-item writes left by the legacy code path).
      await reconcileInvoicePaymentState({ schoolId, invoiceId, session });

      const lineItems = await InvoiceLineItem.find({ invoiceId })
        .sort({ displayOrder: 1 })
        .select("_id name amountMinor amountPaidMinor amountOutstandingMinor displayOrder createdAt")
        .session(session)
        .lean<
          Array<{
            _id: ObjectId;
            name: string;
            amountMinor: number;
            amountPaidMinor?: number;
            amountOutstandingMinor?: number;
            displayOrder?: number;
            createdAt?: Date;
          }>
        >();

      const { allocations, allocatedMinor, unallocatedMinor } = allocateToInvoiceLineItems({
        lineItems: lineItems.map((li) => ({
          ...li,
          _id: String(li._id),
          sortOrder: li.displayOrder,
        })),
        amountMinor,
        mode: "auto",
      });

      const paymentId = legacy?.paymentId ?? new mongoose.Types.ObjectId();
      const paymentDate = data.paid_at ? new Date(data.paid_at) : now;
      const receiptNumber = args.internalReference;

      await Payment.create(
        [
          {
            _id: paymentId,
            schoolId,
            studentId,
            invoiceId,
            paymentIntentId: intent._id,
            amountMinor,
            platformFeeMinor,
            processorFeeMinor,
            netSchoolAmountMinor,
            paymentDate,
            paymentMethod: "paystack",
            paystackReference: reference,
            paystackTransactionId: data.id ? String(data.id) : null,
            reconciliationStatus: "gateway_verified",
            gatewayVerifiedAt: now,
            gatewayResponse: {
              id: data.id ?? null,
              status: data.status,
              channel: data.channel || null,
              gatewayResponse: data.gateway_response || null,
              currency: data.currency || null,
              fees: processorFeeMinor,
              gatewayAmountMinor,
              paidAt: data.paid_at || null,
              createdAt: data.created_at || null,
              edusentrixTransactionFeeMinor: platformFeeMinor,
              netSchoolAmountMinor,
            },
            internalReference: args.internalReference,
            receiptNumber,
            status: "completed",
            approvalStatus: "not_required",
            receivedBy: null,
          },
        ],
        { session }
      );

      if (allocations.length > 0) {
        await PaymentAllocation.bulkWrite(
          allocations.map((a) => ({
            updateOne: {
              filter: {
                paymentId,
                invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
                installmentScheduleId: null,
                installmentNumber: null,
              },
              update: {
                $setOnInsert: {
                  paymentId,
                  invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
                  amountMinor: a.amountMinor,
                  installmentScheduleId: null,
                  installmentNumber: null,
                  notes: null,
                },
              },
              upsert: true,
            },
          })),
          { ordered: true, session }
        );
      }

      if (unallocatedMinor > 0 && !legacy?.creditApplied) {
        await StudentCreditBalance.updateOne(
          { schoolId, studentId },
          {
            $inc: { balanceMinor: unallocatedMinor },
            $push: {
              entries: {
                type: "credit",
                amountMinor: unallocatedMinor,
                createdAt: now,
                reason: "Overpayment",
                sourcePaymentId: paymentId,
              },
            },
          },
          { upsert: true, session }
        );
      }

      if (unallocatedMinor > 0 && !legacy?.adjustmentEventExists) {
        await InvoiceEvent.create(
          [
            {
              schoolId,
              invoiceId,
              studentId,
              eventType: "adjustment_added",
              description: `Credit added from overpayment: ${formatMoney(unallocatedMinor)}`,
              metadata: { amountMinor: unallocatedMinor, sourcePaymentId: paymentId },
              relatedPaymentId: paymentId,
              performedBy: null,
            },
          ],
          { session }
        );
      }

      if (!legacy?.paymentRecordedEventExists) {
        await InvoiceEvent.create(
          [
            {
              schoolId,
              invoiceId,
              studentId,
              eventType: "payment_recorded",
              description: `Payment recorded: ${formatMoney(amountMinor)} via Paystack`,
              metadata: {
                paymentId,
                amountMinor,
                platformFeeMinor,
                processorFeeMinor,
                netSchoolAmountMinor,
                gatewayAmountMinor,
                payerMode: intent.payerMode || "school_absorbs",
                allocatedMinor,
                unallocatedMinor,
                paymentMethod: "paystack",
                paystackReference: reference,
              },
              relatedPaymentId: paymentId,
              performedBy: null,
            },
          ],
          { session }
        );
      }

      await PaymentAuditEvent.create(
        [
          {
            schoolId,
            paymentId,
            invoiceId,
            studentId,
            eventType: "payment_recorded",
            title: "Payment recorded (Paystack webhook)",
            description: `Recorded ${formatMoney(amountMinor)} via Paystack. Reference: ${reference}`,
            actorId: null,
            metadata: {
              paystackReference: reference,
              platformFeeMinor,
              processorFeeMinor,
              netSchoolAmountMinor,
              gatewayAmountMinor,
              allocatedMinor,
              unallocatedMinor,
              automated: true,
              legacyRepair: Boolean(legacy),
            },
          },
        ],
        { session }
      );

      await writeTransactionalAuditEvent(session, {
        actionCode: "payment.recorded",
        scopeType: "school",
        scopeId: String(schoolId),
        result: "succeeded",
        target: {
          targetEntityType: "Payment",
          targetEntityId: paymentId,
          secondaryEntityType: "Invoice",
          secondaryEntityId: invoiceId,
        },
        context: auditContext,
        payload: {
          metadata: {
            amountMinor,
            gatewayAmountMinor,
            netSchoolAmountMinor,
            channel: data.channel,
          },
        },
        streamKey: `school:${String(schoolId)}:finance`,
      });

      // 7. Recompute totals including the new payment.
      const { invoice: reconciledInvoice } = await reconcileInvoicePaymentState({
        schoolId,
        invoiceId,
        session,
      });

      await PaymentIntent.updateOne(
        { _id: intent._id, schoolId },
        {
          $set: {
            status: "succeeded",
            paymentId,
            paystackReference: reference,
            processorFeeMinor,
            netSchoolAmountMinor,
            failureReason: null,
            reconciliationReason: null,
            reconciliationDetails: null,
            reconciliationRequiredAt: null,
            lastPostingError: null,
            expiresAt: null,
          },
        },
        { session, runValidators: true }
      );

      result = {
        outcome: "posted",
        ledger: {
          schoolId,
          studentId,
          invoiceId,
          paymentId,
          amountMinor,
          currency,
          reference,
          paymentDate,
          invoiceNumber: invoice.invoiceNumber || null,
          academicPeriodId: invoice.academicPeriodId ? String(invoice.academicPeriodId) : null,
        },
        followUp: {
          parentUserId: parentUserId ?? null,
          balanceMinor: Math.max(0, Number(reconciledInvoice?.totalOutstandingMinor || 0)),
          receiptNumber,
        },
      };
    });

    if (!result) {
      throw new Error("Paystack fee posting transaction produced no result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Persists a charge that cannot be posted. The intended amounts are never
 * overwritten; provider facts go to `reconciliationDetails`. A charge whose
 * reference is not this intent's is a different provider transaction, so it
 * (like a charge with no claimable intent) is recorded on a deterministic
 * unmatched-charge intent instead, where a later genuine posting of the
 * intent cannot clear it.
 */
async function recordReconciliationRequired(
  session: ClientSession,
  args: {
    intent: IntentRow | null;
    labels: { schoolId: ObjectId; invoiceId: ObjectId; studentId: ObjectId };
    reason: FeeReconciliationReason;
    facts: ProviderFacts;
    details: Record<string, unknown>;
    now: Date;
  }
): Promise<FeePostingResult> {
  const { intent, facts, reason, now } = args;
  const reconciliationDetails = {
    ...args.details,
    provider: facts,
    detectedAt: now,
  };

  if (
    intent &&
    intent.status !== "succeeded" &&
    referenceMatchesIntent(intent, facts.reference)
  ) {
    const adoptReference = !intent.paystackReference;
    await PaymentIntent.updateOne(
      { _id: intent._id, status: { $ne: "succeeded" } },
      {
        $set: {
          status: "reconciliation_required",
          reconciliationReason: reason,
          reconciliationDetails,
          reconciliationRequiredAt: now,
          failureReason: null,
          expiresAt: null,
          ...(adoptReference ? { paystackReference: facts.reference } : {}),
        },
      },
      { session, runValidators: true }
    );
    return { outcome: "reconciliation_required", reason, paymentIntentId: intent._id };
  }

  const unmatchedId = unmatchedChargeIntentId(facts.reference);
  await PaymentIntent.updateOne(
    { _id: unmatchedId },
    {
      $setOnInsert: {
        schoolId: args.labels.schoolId,
        studentId: args.labels.studentId,
        invoiceId: args.labels.invoiceId,
        amountMinor: Math.max(0, facts.amountMinor ?? 0),
        parentPayableMinor: Math.max(0, facts.amountMinor ?? 0),
        status: "reconciliation_required",
        paymentMethod: "paystack",
        paystackReference: facts.reference,
        currency: facts.currency || DEFAULT_CURRENCY,
        idempotencyKey: `paystack-unmatched:${facts.reference}`,
        initiatedAt: now,
        reconciliationReason: reason,
        reconciliationDetails: {
          ...reconciliationDetails,
          unmatchedCharge: true,
          relatedPaymentIntentId: intent ? String(intent._id) : facts.metadata.paymentIntentId,
        },
        reconciliationRequiredAt: now,
      },
    },
    { upsert: true, session, runValidators: true }
  );
  return { outcome: "reconciliation_required", reason, paymentIntentId: unmatchedId };
}
