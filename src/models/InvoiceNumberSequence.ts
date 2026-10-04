// src/models/InvoiceNumberSequence.ts
import { Schema, model, models, Types, type Model } from "mongoose";

/**
 * Durable per-school, per-year invoice number counter.
 *
 * `_id` is deterministic (`invoice:<schoolId>:<year>`) so the default `_id`
 * index is the only uniqueness guarantee needed. `seq` is the last allocated
 * sequence; it only ever moves forward (`$inc` / `$max`), so numbers are never
 * reused even when invoices are deleted or transactions abort.
 */
export interface IInvoiceNumberSequence {
  _id: string;
  schoolId: Types.ObjectId;
  year: number;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceNumberSequenceSchema = new Schema<IInvoiceNumberSequence>(
  {
    _id: { type: String, required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

export function invoiceNumberSequenceKey(
  schoolId: Types.ObjectId | string,
  year: number
): string {
  return `invoice:${String(schoolId)}:${year}`;
}

export const InvoiceNumberSequence: Model<IInvoiceNumberSequence> =
  (models.InvoiceNumberSequence as Model<IInvoiceNumberSequence>) ||
  model<IInvoiceNumberSequence>(
    "InvoiceNumberSequence",
    invoiceNumberSequenceSchema
  );
