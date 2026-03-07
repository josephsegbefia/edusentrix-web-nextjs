import { type HydratedDocument } from "mongoose";
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack";
import {
  SchoolDisbursement,
  type ISchoolDisbursement,
  type SchoolDisbursementStatus,
} from "@/models/SchoolDisbursement";

type PaystackTransferSnapshot = Pick<
  {
    id?: number;
    transfer_code?: string;
    status?: string;
    reason?: string | null;
    fee_charged?: number;
  },
  "id" | "transfer_code" | "status" | "reason" | "fee_charged"
> & {
  reference?: string | null;
  gateway_response?: string | null;
};

export function mapTransferStatusToDisbursementStatus(
  status?: string | null
): SchoolDisbursementStatus {
  if (status === "success") return "completed";
  if (status === "reversed") return "cancelled";
  if (status === "failed") return "failed";
  return "processing";
}

export function buildTransferReconciliationUpdate(args: {
  amountMinor: number;
  platformFeeMinor: number;
  existingProcessorFeeMinor?: number;
  transfer: PaystackTransferSnapshot;
}) {
  const processorFeeMinorRaw =
    typeof args.transfer.fee_charged === "number"
      ? args.transfer.fee_charged
      : Number(args.transfer.fee_charged);
  const processorFeeMinor = Number.isFinite(processorFeeMinorRaw)
    ? Math.max(0, Math.round(processorFeeMinorRaw))
    : Math.max(0, Math.round(args.existingProcessorFeeMinor || 0));
  const totalDebitMinor =
    Math.max(0, Math.round(args.amountMinor || 0)) +
    Math.max(0, Math.round(args.platformFeeMinor || 0)) +
    processorFeeMinor;
  const status = mapTransferStatusToDisbursementStatus(args.transfer.status);

  return {
    status,
    processorFeeMinor,
    totalDebitMinor,
    processedAt: new Date(),
    gateway: {
      transferCode:
        args.transfer.transfer_code || args.transfer.reference || null,
      transferId:
        args.transfer.id !== undefined && args.transfer.id !== null
          ? String(args.transfer.id)
          : null,
      transferStatus: args.transfer.status || null,
      response: args.transfer,
      lastError:
        status === "completed"
          ? null
          : args.transfer.reason ||
            args.transfer.gateway_response ||
            args.transfer.status ||
            "Transfer reconciliation failed",
    },
  };
}

export async function dispatchApprovedPaystackDisbursement(
  disbursement: HydratedDocument<ISchoolDisbursement>
) {
  const resolvedBankCode = disbursement.destination?.bankCode || null;

  if (!resolvedBankCode) {
    throw new Error(
      "A bank/provider code is required for automated payout initiation."
    );
  }

  const recipient = await createTransferRecipient({
    method: disbursement.destination.method,
    name: disbursement.destination.accountName,
    accountNumber: disbursement.destination.accountNumber,
    bankCode: resolvedBankCode,
    currency: disbursement.currency || "GHS",
    description: `${disbursement.recipientType} payout ${disbursement.reference}`,
  });

  const transfer = await initiateTransfer({
    amountMinor: disbursement.amountMinor,
    recipientCode: recipient.recipient_code,
    reason: disbursement.purpose,
    reference: disbursement.reference,
    currency: disbursement.currency || "GHS",
  });

  const update = {
    status: "processing" as const,
    processedAt: new Date(),
    "destination.bankCode": resolvedBankCode,
    "gateway.recipientCode": recipient.recipient_code,
    "gateway.transferCode": transfer.transfer_code || null,
    "gateway.transferId":
      transfer.id !== undefined && transfer.id !== null
        ? String(transfer.id)
        : null,
    "gateway.transferStatus": transfer.status || "pending",
    "gateway.response": transfer,
    "gateway.lastError": null,
  };

  await SchoolDisbursement.findByIdAndUpdate(disbursement._id, {
    $set: update,
  });

  return {
    recipient,
    transfer,
  };
}
