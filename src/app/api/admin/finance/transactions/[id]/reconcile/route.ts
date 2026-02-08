import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  FinancialTransaction,
  type ReconciliationProvider,
  type ReconciliationStatus,
} from "@/models/FinancialTransaction";
import { Payment } from "@/models/Payment";
import { recordActivity } from "@/lib/audit/recordActivity";

type ReconciliationAction = "match" | "unmatch" | "dispute" | "ignore";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface TransactionLean {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  status: string;
  category: string;
  sourceModule: string;
  method: string;
  sourceId?: mongoose.Types.ObjectId | string | null;
  grossAmountMinor: number;
  currency: string;
  createdBy?: mongoose.Types.ObjectId | null;
  approval?: {
    requestedBy?: mongoose.Types.ObjectId | null;
  } | null;
  reconciliation?: {
    status?: ReconciliationStatus;
    provider?: ReconciliationProvider | null;
    providerReference?: string | null;
    settlementBatchId?: string | null;
  } | null;
}

const RECONCILIATION_PROVIDERS = [
  "paystack",
  "hubtel",
  "mtn_momo",
  "bank",
  "manual",
] as const;

const RECONCILIATION_ACTIONS = [
  "match",
  "unmatch",
  "dispute",
  "ignore",
] as const;

const RECONCILIATION_TRANSITIONS: Record<
  ReconciliationStatus,
  ReconciliationStatus[]
> = {
  unmatched: ["matched", "disputed", "ignored"],
  matched: ["unmatched", "disputed"],
  disputed: ["matched", "unmatched", "ignored"],
  ignored: ["unmatched", "matched"],
};

const MATCH_ALLOWED_TRANSACTION_STATUSES = new Set([
  "success",
  "refunded",
  "reversed",
]);

const DUAL_CONTROL_THRESHOLD_MINOR = (() => {
  const parsed = Number.parseInt(
    process.env.RECONCILIATION_DUAL_CONTROL_THRESHOLD_MINOR || "",
    10
  );
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 1_000_000; // GHS 10,000 by default
})();

function objectIdEquals(
  left?: mongoose.Types.ObjectId | null,
  right?: mongoose.Types.ObjectId | null
): boolean {
  if (!left || !right) return false;
  return String(left) === String(right);
}

function evaluateDualControlPolicy(transaction: TransactionLean) {
  const triggers: string[] = [];

  if (transaction.sourceModule === "manual") {
    triggers.push("manual_entry");
  }

  if (transaction.grossAmountMinor >= DUAL_CONTROL_THRESHOLD_MINOR) {
    triggers.push("high_value");
  }

  if (transaction.category === "refund" || transaction.category === "adjustment") {
    triggers.push("sensitive_category");
  }

  return {
    required: triggers.length > 0,
    triggers,
    thresholdMinor: DUAL_CONTROL_THRESHOLD_MINOR,
  };
}

const ReconcileSchema = z
  .object({
    action: z.enum(RECONCILIATION_ACTIONS),
    provider: z.enum(RECONCILIATION_PROVIDERS).optional(),
    providerReference: z.string().trim().max(120).optional(),
    settlementBatchId: z.string().trim().max(120).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const hasProviderReference = Boolean(data.providerReference?.trim());
    const hasReason = Boolean(data.reason?.trim());

    if (data.action === "match") {
      if (!data.provider) {
        ctx.addIssue({
          code: "custom",
          path: ["provider"],
          message: "Provider is required when marking a transaction as matched",
        });
      }
      if (!hasProviderReference) {
        ctx.addIssue({
          code: "custom",
          path: ["providerReference"],
          message: "Provider reference is required when marking a transaction as matched",
        });
      }
    }

    if ((data.action === "dispute" || data.action === "ignore") && !hasReason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Reason is required for dispute or ignore actions",
      });
    }
  });

function normalizeText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapActionToStatus(action: ReconciliationAction): ReconciliationStatus {
  if (action === "match") return "matched";
  if (action === "unmatch") return "unmatched";
  if (action === "dispute") return "disputed";
  return "ignored";
}

async function syncLinkedPaymentReconciliation(params: {
  schoolId: mongoose.Types.ObjectId;
  sourceModule: string;
  sourceId?: mongoose.Types.ObjectId | string | null;
  action: ReconciliationAction;
  provider: ReconciliationProvider | null;
  settlementBatchId: string | null;
  at: Date;
}) {
  if (params.sourceModule !== "fees" || !params.sourceId) return;

  const paymentId = String(params.sourceId);
  if (!mongoose.Types.ObjectId.isValid(paymentId)) return;

  const setPayload: Record<string, unknown> = {};

  if (params.action === "unmatch") {
    setPayload.reconciliationStatus = "unmatched";
    setPayload.gatewayVerifiedAt = null;
    setPayload.bankMatchedAt = null;
  } else if (params.action === "dispute" || params.action === "ignore") {
    setPayload.reconciliationStatus = "needs_review";
  } else {
    const isBankStyleMatch =
      params.provider === "bank" || params.provider === "manual";
    const hasSettlementBatch = Boolean(params.settlementBatchId);

    if (hasSettlementBatch) {
      setPayload.reconciliationStatus = "fully_reconciled";
      setPayload.bankMatchedAt = params.at;
      if (!isBankStyleMatch) {
        setPayload.gatewayVerifiedAt = params.at;
      }
    } else if (isBankStyleMatch) {
      setPayload.reconciliationStatus = "bank_matched";
      setPayload.bankMatchedAt = params.at;
    } else {
      setPayload.reconciliationStatus = "gateway_verified";
      setPayload.gatewayVerifiedAt = params.at;
    }
  }

  await Payment.updateOne(
    {
      _id: new mongoose.Types.ObjectId(paymentId),
      schoolId: params.schoolId,
    },
    { $set: setPayload }
  );
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    const parsed = ReconcileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request payload" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const action = data.action as ReconciliationAction;
    const targetStatus = mapActionToStatus(action);
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    const transactionIdObj = new mongoose.Types.ObjectId(id);
    const now = new Date();

    const transaction = (await FinancialTransaction.findOne({
      _id: transactionIdObj,
      schoolId: schoolIdObj,
    })
      .select(
        "_id schoolId status category sourceModule method sourceId grossAmountMinor currency createdBy approval.requestedBy reconciliation"
      )
      .lean()) as TransactionLean | null;

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (
      action === "match" &&
      !MATCH_ALLOWED_TRANSACTION_STATUSES.has(transaction.status)
    ) {
      return NextResponse.json(
        {
          error:
            "Only finalized transactions can be marked as matched. Pending/failed records must be resolved first.",
        },
        { status: 400 }
      );
    }

    const dualControlPolicy = evaluateDualControlPolicy(transaction);
    const isSameAsCreator = objectIdEquals(transaction.createdBy, userIdObj);
    const isSameAsApprovalRequester = objectIdEquals(
      transaction.approval?.requestedBy || null,
      userIdObj
    );

    if (
      dualControlPolicy.required &&
      (isSameAsCreator || isSameAsApprovalRequester)
    ) {
      return NextResponse.json(
        {
          error:
            "Dual-control policy requires a different checker for this high-risk transaction.",
          code: "maker_checker_required",
          policy: {
            ...dualControlPolicy,
            actorConflict: isSameAsCreator
              ? "created_by_current_user"
              : "requested_by_current_user",
          },
        },
        { status: 409 }
      );
    }

    const currentStatus = transaction.reconciliation?.status || "unmatched";
    const allowedTargets = RECONCILIATION_TRANSITIONS[currentStatus];

    if (!allowedTargets.includes(targetStatus)) {
      return NextResponse.json(
        {
          error: `Invalid reconciliation transition: ${currentStatus} -> ${targetStatus}`,
        },
        { status: 409 }
      );
    }

    const normalizedProviderReference = normalizeText(data.providerReference);
    const normalizedSettlementBatchId = normalizeText(data.settlementBatchId);
    const normalizedReason = normalizeText(data.reason);
    const existingProvider = transaction.reconciliation?.provider || null;
    const existingProviderReference =
      normalizeText(transaction.reconciliation?.providerReference) || null;
    const existingSettlementBatchId =
      normalizeText(transaction.reconciliation?.settlementBatchId) || null;

    let nextProvider: ReconciliationProvider | null = existingProvider;
    let nextProviderReference: string | null = existingProviderReference;
    let nextSettlementBatchId: string | null = existingSettlementBatchId;
    let matchedAt: Date | null = null;
    let matchedBy: mongoose.Types.ObjectId | null = null;

    if (action === "match") {
      nextProvider = data.provider || null;
      nextProviderReference = normalizedProviderReference;
      nextSettlementBatchId = normalizedSettlementBatchId;
      matchedAt = now;
      matchedBy = userIdObj;
    } else if (action === "unmatch") {
      nextProvider = null;
      nextProviderReference = null;
      nextSettlementBatchId = null;
    } else {
      nextProvider = data.provider || existingProvider;
      nextProviderReference = normalizedProviderReference || existingProviderReference;
      nextSettlementBatchId =
        normalizedSettlementBatchId || existingSettlementBatchId;
    }

    const reconciliationFilter: Record<string, unknown> = {
      _id: transactionIdObj,
      schoolId: schoolIdObj,
    };
    if (currentStatus === "unmatched") {
      reconciliationFilter.$or = [
        { "reconciliation.status": "unmatched" },
        { "reconciliation.status": { $exists: false } },
      ];
    } else {
      reconciliationFilter["reconciliation.status"] = currentStatus;
    }

    const historyEntry = {
      action,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      provider: nextProvider,
      providerReference: nextProviderReference,
      settlementBatchId: nextSettlementBatchId,
      reason: normalizedReason,
      policy: {
        dualControlRequired: dualControlPolicy.required,
        triggers: dualControlPolicy.triggers,
        thresholdMinor: dualControlPolicy.thresholdMinor,
      },
      performedBy: userIdObj,
      performedAt: now,
    };

    const updateResult = await FinancialTransaction.updateOne(reconciliationFilter, {
      $set: {
        "reconciliation.status": targetStatus,
        "reconciliation.provider": nextProvider,
        "reconciliation.providerReference": nextProviderReference,
        "reconciliation.settlementBatchId": nextSettlementBatchId,
        "reconciliation.matchedAt": matchedAt,
        "reconciliation.matchedBy": matchedBy,
        "meta.lastReconciliationAction": historyEntry,
        updatedAt: now,
      },
      $push: {
        "meta.reconciliationHistory": {
          $each: [historyEntry],
          $slice: -200,
        },
      },
    });

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        {
          error:
            "Transaction reconciliation changed during processing. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    try {
      await syncLinkedPaymentReconciliation({
        schoolId: schoolIdObj,
        sourceModule: transaction.sourceModule,
        sourceId: transaction.sourceId,
        action,
        provider: nextProvider,
        settlementBatchId: nextSettlementBatchId,
        at: now,
      });
    } catch (syncError) {
      // Do not fail reconciliation if the linked payment sync fails.
      // The reconciliation history remains the source of truth for replay.
      console.error("Failed to sync linked payment reconciliation:", syncError);
    }

    await recordActivity({
      schoolId: String(schoolIdObj),
      userId: String(userIdObj),
      type: "transaction.adjusted",
      entityType: "financial_transaction",
      entityId: id,
      description: `Reconciliation ${action} (${currentStatus} -> ${targetStatus}) for ${(transaction.grossAmountMinor / 100).toFixed(2)} ${transaction.currency}`,
      metadata: {
        action,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        provider: nextProvider,
        providerReference: nextProviderReference,
        settlementBatchId: nextSettlementBatchId,
        reason: normalizedReason,
        policy: {
          dualControlRequired: dualControlPolicy.required,
          triggers: dualControlPolicy.triggers,
          thresholdMinor: dualControlPolicy.thresholdMinor,
        },
      },
    });

    const updatedTransaction = await FinancialTransaction.findById(transactionIdObj)
      .select("reconciliation meta.updatedAt meta.lastReconciliationAction")
      .lean();

    return NextResponse.json({
      success: true,
      action,
      data: updatedTransaction,
      message: `Transaction marked as ${targetStatus}`,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error reconciling transaction:", error);
    return NextResponse.json(
      { error: "Failed to update reconciliation" },
      { status: 500 }
    );
  }
}
