// src/models/PaymentReferenceCounter.ts
import { Schema, model, models, Types } from "mongoose";

export type PaymentMethodForRef =
  | "cash"
  | "bank_transfer"
  | "mobile_money"
  | "paystack"
  | "cheque"
  | "other";

const PREFIX_BY_METHOD: Record<PaymentMethodForRef, string> = {
  cash: "RCP",
  bank_transfer: "BNK",
  mobile_money: "MOM",
  paystack: "PSK",
  cheque: "CHQ",
  other: "PAY",
};

export function getPaymentReferencePrefix(
  paymentMethod: PaymentMethodForRef
): string {
  return PREFIX_BY_METHOD[paymentMethod] ?? "PAY";
}

const counterSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

counterSchema.index(
  { schoolId: 1, year: 1 },
  { unique: true, name: "uniq_school_year" }
);

const PaymentReferenceCounter =
  models.PaymentReferenceCounter ||
  model("PaymentReferenceCounter", counterSchema);

/**
 * Generates a unique internal payment reference.
 * Format: {PREFIX}-{YY}-{SEQ} e.g. RCP-24-000001, PSK-24-000042
 */
export async function generatePaymentInternalReference(
  schoolId: Types.ObjectId,
  paymentMethod: PaymentMethodForRef
): Promise<string> {
  const prefix = getPaymentReferencePrefix(paymentMethod);
  const year = new Date().getFullYear();
  const shortYear = year % 100;

  const doc = await PaymentReferenceCounter.findOneAndUpdate(
    { schoolId, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seq = doc?.seq ?? 1;
  return `${prefix}-${String(shortYear).padStart(2, "0")}-${String(seq).padStart(6, "0")}`;
}
