// src/models/PaymentCheckoutLock.ts
import { Schema, model, models, Types } from "mongoose";

/**
 * One document per payable obligation (e.g. `fee:<schoolId>:<invoiceId>`)
 * pointing at the PaymentIntent that currently holds the checkout slot.
 *
 * Uniqueness relies only on the built-in `_id` index, so the guarantee holds
 * even where schema indexes are not auto-built (production `autoIndex: false`).
 * A holder whose intent is terminal no longer blocks; the next checkout takes
 * the slot over with a compare-and-set on `paymentIntentId`.
 */
export interface IPaymentCheckoutLock {
  _id: string;
  schoolId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  paymentIntentId: Types.ObjectId;
  acquiredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentCheckoutLockSchema = new Schema<IPaymentCheckoutLock>(
  {
    _id: { type: String, required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true },
    acquiredAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export function feeCheckoutLockKey(schoolId: Types.ObjectId, invoiceId: Types.ObjectId) {
  return `fee:${String(schoolId)}:${String(invoiceId)}`;
}

export const PaymentCheckoutLock =
  models.PaymentCheckoutLock ||
  model<IPaymentCheckoutLock>("PaymentCheckoutLock", paymentCheckoutLockSchema);
