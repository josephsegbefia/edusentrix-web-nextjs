/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { Payment } from "@/models/Payment";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import {
  ReconciliationIngestion,
  type ReconciliationMatchMethod,
  type ReconciliationSourceType,
} from "@/models/ReconciliationIngestion";
import { ReconciliationRun } from "@/models/ReconciliationRun";

export const RECONCILIATION_SLA_HOURS = (() => {
  const parsed = Number(process.env.RECONCILIATION_SLA_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 48;
})();

const AMOUNT_DATE_MATCH_WINDOW_DAYS = (() => {
  const parsed = Number(process.env.RECONCILIATION_MATCH_WINDOW_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
})();

const INGESTION_BATCH_LIMIT = (() => {
  const parsed = Number(process.env.RECONCILIATION_INGESTION_BATCH_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
})();

type PaymentStatusUpdate = {
  paymentId: mongoose.Types.ObjectId;
  from: string;
  to: string;
  set: Record<string, unknown>;
  invoiceId?: mongoose.Types.ObjectId | null;
  studentId?: mongoose.Types.ObjectId | null;
  reason: string;
};

type IngestionMatchOutcome =
  | {
      kind: "matched";
      paymentId: mongoose.Types.ObjectId;
      matchMethod: ReconciliationMatchMethod;
      confidence: number;
      reason: string;
    }
  | {
      kind: "ambiguous";
      candidatePaymentIds: mongoose.Types.ObjectId[];
      reason: string;
    }
  | {
      kind: "unmatched";
      reason: string;
    };

function hoursSince(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60));
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function normalizeReconciliationReference(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || null;
}

function dateDiffDays(a: Date, b: Date) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function nextStatusBySource(params: {
  currentStatus: string;
  sourceType: ReconciliationSourceType;
  gatewayVerifiedAt?: Date | string | null;
  bankMatchedAt?: Date | string | null;
}) {
  const hasGateway = Boolean(normalizeDate(params.gatewayVerifiedAt));
  const hasBank = Boolean(normalizeDate(params.bankMatchedAt));

  if (params.sourceType === "manual") {
    return "fully_reconciled";
  }
  if (params.sourceType === "gateway") {
    return hasBank || params.currentStatus === "bank_matched"
      ? "fully_reconciled"
      : "gateway_verified";
  }
  return hasGateway || params.currentStatus === "gateway_verified"
    ? "fully_reconciled"
    : "bank_matched";
}

function paymentReferenceTokens(payment: any) {
  const raw = [
    payment.internalReference,
    payment.paystackReference,
    payment.paystackTransactionId,
    payment.externalReference,
    payment.receiptNumber,
  ];
  return Array.from(
    new Set(
      raw
        .map((value) => normalizeReconciliationReference(String(value || "")))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function dedupeObjectIds(ids: mongoose.Types.ObjectId[]) {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findIngestionMatch(params: {
  ingestion: any;
  payments: any[];
}): IngestionMatchOutcome {
  const { ingestion, payments } = params;
  const txnDate = normalizeDate(ingestion.transactionDate);

  const externalToken = normalizeReconciliationReference(ingestion.externalTxnId);
  const referenceToken = normalizeReconciliationReference(ingestion.normalizedReference);
  const candidateTokens = Array.from(
    new Set([externalToken, referenceToken].filter((v): v is string => Boolean(v)))
  );

  const exactExternalMatches =
    ingestion.sourceType === "gateway" && externalToken
      ? payments.filter((payment) =>
          paymentReferenceTokens(payment).includes(externalToken)
        )
      : [];
  if (exactExternalMatches.length === 1) {
    return {
      kind: "matched",
      paymentId: exactExternalMatches[0]._id,
      matchMethod: "exact_external_id",
      confidence: 100,
      reason: "Matched by external transaction identifier.",
    };
  }
  if (exactExternalMatches.length > 1) {
    return {
      kind: "ambiguous",
      candidatePaymentIds: dedupeObjectIds(
        exactExternalMatches.map((payment) => payment._id)
      ),
      reason: "Multiple payments share the same external transaction identifier.",
    };
  }

  const exactRefMatches =
    candidateTokens.length > 0
      ? payments.filter((payment) => {
          const tokens = paymentReferenceTokens(payment);
          return candidateTokens.some((token) => tokens.includes(token));
        })
      : [];
  if (exactRefMatches.length === 1) {
    return {
      kind: "matched",
      paymentId: exactRefMatches[0]._id,
      matchMethod: "exact_reference",
      confidence: 96,
      reason: "Matched by reference token.",
    };
  }
  if (exactRefMatches.length > 1) {
    return {
      kind: "ambiguous",
      candidatePaymentIds: dedupeObjectIds(
        exactRefMatches.map((payment) => payment._id)
      ),
      reason: "Multiple payments share the same reference token.",
    };
  }

  if (!txnDate) {
    return { kind: "unmatched", reason: "Missing transaction date in ingestion item." };
  }

  const amountDateMatches = payments.filter((payment) => {
    const paymentDate = normalizeDate(payment.paymentDate || payment.createdAt);
    if (!paymentDate) return false;
    if (Number(payment.amountMinor || 0) !== Number(ingestion.amountMinor || 0)) {
      return false;
    }
    return dateDiffDays(paymentDate, txnDate) <= AMOUNT_DATE_MATCH_WINDOW_DAYS;
  });

  if (amountDateMatches.length === 1) {
    return {
      kind: "matched",
      paymentId: amountDateMatches[0]._id,
      matchMethod: "amount_date_single",
      confidence: 78,
      reason: "Single payment matched by amount and transaction date window.",
    };
  }

  if (amountDateMatches.length > 1) {
    return {
      kind: "ambiguous",
      candidatePaymentIds: dedupeObjectIds(
        amountDateMatches.map((payment) => payment._id)
      ),
      reason: "Multiple payments matched amount/date rules.",
    };
  }

  return {
    kind: "unmatched",
    reason: "No deterministic candidate found for this ingestion item.",
  };
}

async function updateStalePaymentStatuses(params: {
  schoolId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
}) {
  const candidates = await Payment.find({
    schoolId: params.schoolId,
    status: "completed",
    reconciliationStatus: {
      $in: ["unmatched", "gateway_verified", "bank_matched", "needs_review"],
    },
  })
    .select(
      "_id invoiceId studentId paymentMethod paystackReference paymentDate createdAt reconciliationStatus gatewayVerifiedAt bankMatchedAt"
    )
    .lean();

  const updates: PaymentStatusUpdate[] = [];

  for (const payment of candidates) {
    const current = String(payment.reconciliationStatus || "unmatched");
    let target: string | null = null;

    if (payment.gatewayVerifiedAt && payment.bankMatchedAt) {
      target = "fully_reconciled";
    } else if (payment.bankMatchedAt) {
      target = "bank_matched";
    } else if (
      payment.paymentMethod === "paystack" &&
      payment.paystackReference &&
      current === "unmatched"
    ) {
      target = "gateway_verified";
    } else if (
      current !== "needs_review" &&
      hoursSince(payment.paymentDate || payment.createdAt) > RECONCILIATION_SLA_HOURS
    ) {
      target = "needs_review";
    }

    if (!target || target === current) continue;

    const set: Record<string, unknown> = { reconciliationStatus: target };
    if (target === "gateway_verified" && !payment.gatewayVerifiedAt) {
      set.gatewayVerifiedAt = new Date();
    }
    if (target === "bank_matched" && !payment.bankMatchedAt) {
      set.bankMatchedAt = new Date();
    }
    if (target === "fully_reconciled") {
      if (!payment.gatewayVerifiedAt) set.gatewayVerifiedAt = new Date();
      if (!payment.bankMatchedAt) set.bankMatchedAt = new Date();
    }

    updates.push({
      paymentId: payment._id as mongoose.Types.ObjectId,
      from: current,
      to: target,
      set,
      invoiceId: (payment.invoiceId as mongoose.Types.ObjectId) || null,
      studentId: (payment.studentId as mongoose.Types.ObjectId) || null,
      reason:
        target === "needs_review"
          ? "SLA breach"
          : "Deterministic payment status refresh",
    });
  }

  if (updates.length === 0) {
    return {
      inspected: candidates.length,
      updated: 0,
      byStatus: {} as Record<string, number>,
      staleEscalated: 0,
    };
  }

  await Payment.bulkWrite(
    updates.map((update) => ({
      updateOne: {
        filter: { _id: update.paymentId, schoolId: params.schoolId },
        update: { $set: update.set },
      },
    }))
  );

  await PaymentAuditEvent.insertMany(
    updates.map((update) => ({
      schoolId: params.schoolId,
      paymentId: update.paymentId,
      invoiceId: update.invoiceId,
      studentId: update.studentId,
      eventType: "reconciliation_updated",
      title: "Reconciliation status updated",
      description: `${update.from.replaceAll("_", " ")} -> ${update.to.replaceAll(
        "_",
        " "
      )}`,
      actorId: params.userId || null,
      metadata: {
        previousStatus: update.from,
        nextStatus: update.to,
        automated: true,
        reason: update.reason,
      },
    }))
  );

  const byStatus = updates.reduce(
    (acc, update) => {
      acc[update.to] = (acc[update.to] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    inspected: candidates.length,
    updated: updates.length,
    byStatus,
    staleEscalated: byStatus.needs_review || 0,
  };
}

async function matchIngestionItems(params: {
  schoolId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
}) {
  const [ingestions, payments] = await Promise.all([
    ReconciliationIngestion.find({
      schoolId: params.schoolId,
      status: { $in: ["unmatched", "ambiguous"] },
    })
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(INGESTION_BATCH_LIMIT)
      .lean(),
    Payment.find({
      schoolId: params.schoolId,
      status: "completed",
    })
      .select(
        "_id invoiceId studentId amountMinor paymentDate createdAt reconciliationStatus gatewayVerifiedAt bankMatchedAt internalReference paystackReference paystackTransactionId externalReference receiptNumber"
      )
      .lean(),
  ]);

  let matched = 0;
  let ambiguous = 0;
  let unchanged = 0;
  let paymentStatusUpdated = 0;
  let errors = 0;

  for (const ingestion of ingestions) {
    try {
      const outcome = findIngestionMatch({ ingestion, payments });

      if (outcome.kind === "unmatched") {
        const changed =
          ingestion.status !== "unmatched" ||
          (ingestion.candidatePaymentIds || []).length > 0 ||
          ingestion.matchedPaymentId;
        if (changed) {
          await ReconciliationIngestion.updateOne(
            { _id: ingestion._id, schoolId: params.schoolId },
            {
              $set: {
                status: "unmatched",
                matchMethod: "none",
                matchedPaymentId: null,
                candidatePaymentIds: [],
                confidence: 0,
                notes: outcome.reason,
              },
            }
          );
        } else {
          unchanged += 1;
        }
        continue;
      }

      if (outcome.kind === "ambiguous") {
        ambiguous += 1;
        const changed =
          ingestion.status !== "ambiguous" ||
          String(ingestion.matchMethod || "none") !== "none" ||
          String(ingestion.matchedPaymentId || "") !== "";
        await ReconciliationIngestion.updateOne(
          { _id: ingestion._id, schoolId: params.schoolId },
          {
            $set: {
              status: "ambiguous",
              matchMethod: "none",
              matchedPaymentId: null,
              candidatePaymentIds: outcome.candidatePaymentIds,
              confidence: 0,
              notes: outcome.reason,
            },
          }
        );
        if (!changed) unchanged += 1;
        continue;
      }

      matched += 1;
      const payment = payments.find(
        (entry) => String(entry._id) === String(outcome.paymentId)
      );
      if (!payment) {
        errors += 1;
        continue;
      }

      await ReconciliationIngestion.updateOne(
        { _id: ingestion._id, schoolId: params.schoolId },
        {
          $set: {
            status: "matched",
            matchMethod: outcome.matchMethod,
            matchedPaymentId: outcome.paymentId,
            candidatePaymentIds: [outcome.paymentId],
            confidence: outcome.confidence,
            notes: outcome.reason,
          },
        }
      );

      const now = new Date();
      const nextStatus = nextStatusBySource({
        currentStatus: String(payment.reconciliationStatus || "unmatched"),
        sourceType: ingestion.sourceType,
        gatewayVerifiedAt: payment.gatewayVerifiedAt,
        bankMatchedAt: payment.bankMatchedAt,
      });

      const set: Record<string, unknown> = {};
      if (ingestion.sourceType === "gateway" || ingestion.sourceType === "manual") {
        if (!payment.gatewayVerifiedAt) {
          set.gatewayVerifiedAt = now;
        }
      }
      if (ingestion.sourceType === "bank" || ingestion.sourceType === "manual") {
        if (!payment.bankMatchedAt) {
          set.bankMatchedAt = now;
        }
      }
      if (String(payment.reconciliationStatus || "unmatched") !== nextStatus) {
        set.reconciliationStatus = nextStatus;
      }

      if (Object.keys(set).length > 0) {
        paymentStatusUpdated += 1;
        await Payment.updateOne(
          { _id: payment._id, schoolId: params.schoolId },
          { $set: set }
        );

        await PaymentAuditEvent.create({
          schoolId: params.schoolId,
          paymentId: payment._id,
          invoiceId: payment.invoiceId || null,
          studentId: payment.studentId || null,
          eventType: "reconciliation_updated",
          title: "Payment reconciled",
          description: `Reconciled from ${
            ingestion.sourceType
          } ingestion via ${outcome.matchMethod.replaceAll("_", " ")}.`,
          actorId: params.userId || null,
          metadata: {
            previousStatus: payment.reconciliationStatus,
            nextStatus,
            ingestionId: ingestion._id,
            sourceType: ingestion.sourceType,
            matchMethod: outcome.matchMethod,
            confidence: outcome.confidence,
            automated: true,
          },
        });
      }
    } catch {
      errors += 1;
    }
  }

  return {
    inspectedIngestion: ingestions.length,
    matched,
    ambiguous,
    unchanged,
    paymentStatusUpdated,
    errors,
  };
}

export async function runDeterministicReconciliation(params: {
  schoolId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  mode?: "manual" | "scheduled";
  notes?: string | null;
}) {
  const run = await ReconciliationRun.create({
    schoolId: params.schoolId,
    mode: params.mode || "manual",
    status: "running",
    startedAt: new Date(),
    triggeredBy: params.userId || null,
    notes: params.notes || null,
    summary: {
      inspectedIngestion: 0,
      matched: 0,
      ambiguous: 0,
      unchanged: 0,
      staleEscalated: 0,
      paymentStatusUpdated: 0,
      errors: 0,
    },
  });

  try {
    const [paymentStatusRefresh, ingestionSummary] = await Promise.all([
      updateStalePaymentStatuses({
        schoolId: params.schoolId,
        userId: params.userId || null,
      }),
      matchIngestionItems({
        schoolId: params.schoolId,
        userId: params.userId || null,
      }),
    ]);

    const summary = {
      inspectedIngestion: ingestionSummary.inspectedIngestion,
      matched: ingestionSummary.matched,
      ambiguous: ingestionSummary.ambiguous,
      unchanged: ingestionSummary.unchanged,
      staleEscalated: paymentStatusRefresh.staleEscalated,
      paymentStatusUpdated:
        ingestionSummary.paymentStatusUpdated + paymentStatusRefresh.updated,
      errors: ingestionSummary.errors,
    };

    await ReconciliationRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          summary,
          metadata: {
            paymentStatusRefresh,
          },
        },
      }
    );

    return {
      runId: String(run._id),
      status: "completed" as const,
      summary,
      paymentStatusRefresh,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run reconciliation.";

    await ReconciliationRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: message,
        },
      }
    );

    throw error;
  }
}

export async function applyManualReconciliationMatch(params: {
  schoolId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  ingestionId: mongoose.Types.ObjectId;
  paymentId: mongoose.Types.ObjectId;
  note?: string | null;
}) {
  const [ingestion, payment] = await Promise.all([
    ReconciliationIngestion.findOne({
      _id: params.ingestionId,
      schoolId: params.schoolId,
    }),
    Payment.findOne({
      _id: params.paymentId,
      schoolId: params.schoolId,
      status: "completed",
    }).select(
      "_id invoiceId studentId reconciliationStatus gatewayVerifiedAt bankMatchedAt"
    ),
  ]);

  if (!ingestion) {
    throw new Error("Reconciliation ingestion item not found.");
  }
  if (!payment) {
    throw new Error("Payment not found or not eligible for reconciliation.");
  }

  ingestion.status = "matched";
  ingestion.matchMethod = "manual";
  ingestion.matchedPaymentId = payment._id;
  ingestion.candidatePaymentIds = [payment._id];
  ingestion.confidence = 100;
  ingestion.notes = params.note || "Manually matched by finance staff.";
  await ingestion.save();

  const nextStatus = nextStatusBySource({
    currentStatus: String(payment.reconciliationStatus || "unmatched"),
    sourceType: ingestion.sourceType,
    gatewayVerifiedAt: payment.gatewayVerifiedAt,
    bankMatchedAt: payment.bankMatchedAt,
  });
  const set: Record<string, unknown> = {};
  if (ingestion.sourceType === "gateway" || ingestion.sourceType === "manual") {
    if (!payment.gatewayVerifiedAt) set.gatewayVerifiedAt = new Date();
  }
  if (ingestion.sourceType === "bank" || ingestion.sourceType === "manual") {
    if (!payment.bankMatchedAt) set.bankMatchedAt = new Date();
  }
  if (String(payment.reconciliationStatus || "unmatched") !== nextStatus) {
    set.reconciliationStatus = nextStatus;
  }
  if (Object.keys(set).length > 0) {
    await Payment.updateOne(
      { _id: payment._id, schoolId: params.schoolId },
      { $set: set }
    );
  }

  await PaymentAuditEvent.create({
    schoolId: params.schoolId,
    paymentId: payment._id,
    invoiceId: payment.invoiceId || null,
    studentId: payment.studentId || null,
    eventType: "reconciliation_updated",
    title: "Manual reconciliation match",
    description: params.note || "Finance staff manually matched reconciliation evidence.",
    actorId: params.userId || null,
    metadata: {
      ingestionId: ingestion._id,
      matchMethod: "manual",
      sourceType: ingestion.sourceType,
      previousStatus: payment.reconciliationStatus,
      nextStatus,
    },
  });

  return {
    ingestionId: String(ingestion._id),
    paymentId: String(payment._id),
    nextStatus,
  };
}

