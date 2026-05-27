/**
 * SubscriptionInvoice
 *
 * Platform-generated invoices for EduSentrix subscription charges.
 *
 * Distinct from school fee invoices (FeeInvoice model).
 * This model tracks platform → school billing for:
 *   - Monthly/annual plan charges
 *   - Add-on purchases
 *   - Transaction fee settlements
 *
 * Spec §14.10.
 */

import { Schema, model, models, Types, type Model } from "mongoose";

export type SubscriptionInvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "overdue"
  | "forgiven"
  | "cancelled";

export type SubscriptionInvoiceLineType =
  | "plan_charge"
  | "addon_purchase"
  | "transaction_fee_settlement"
  | "credit_adjustment"
  | "penalty_fee"
  | "refund";

export interface ISubscriptionInvoiceLine {
  lineType: SubscriptionInvoiceLineType;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  reference?: string | null;
}

export interface ISubscriptionInvoice {
  _id: Types.ObjectId;
  invoiceNumber: string;
  schoolId: Types.ObjectId;
  subscriptionId?: Types.ObjectId | null;
  status: SubscriptionInvoiceStatus;
  lines: ISubscriptionInvoiceLine[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: "GHS";
  billingPeriodStart?: Date | null;
  billingPeriodEnd?: Date | null;
  issuedAt?: Date | null;
  dueAt?: Date | null;
  paidAt?: Date | null;
  paidReference?: string | null;
  note?: string | null;
  createdBy?: Types.ObjectId | null;
  createdByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionInvoiceLineSchema = new Schema<ISubscriptionInvoiceLine>(
  {
    lineType: {
      type: String,
      enum: ["plan_charge", "addon_purchase", "transaction_fee_settlement", "credit_adjustment", "penalty_fee", "refund"],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    subtotalMinor: { type: Number, required: true },
    reference: { type: String, default: null },
  },
  { _id: false }
);

const subscriptionInvoiceSchema = new Schema<ISubscriptionInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "SchoolSubscription", default: null, index: true },
    status: {
      type: String,
      enum: ["draft", "issued", "paid", "overdue", "forgiven", "cancelled"],
      required: true,
      default: "draft",
      index: true,
    },
    lines: [subscriptionInvoiceLineSchema],
    subtotalMinor: { type: Number, required: true, min: 0 },
    taxMinor: { type: Number, required: true, default: 0, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["GHS"], default: "GHS" },
    billingPeriodStart: { type: Date, default: null },
    billingPeriodEnd: { type: Date, default: null },
    issuedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paidReference: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    createdByEmail: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

subscriptionInvoiceSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
subscriptionInvoiceSchema.index({ status: 1, dueAt: 1 });

// Auto-generate invoice number before save
subscriptionInvoiceSchema.pre("validate", async function (next) {
  if (!this.invoiceNumber) {
    const count = await (this.constructor as typeof SubscriptionInvoice).countDocuments();
    const seq = String(count + 1).padStart(6, "0");
    this.invoiceNumber = `ESX-INV-${seq}`;
  }
  next();
});

export const SubscriptionInvoice: Model<ISubscriptionInvoice> =
  (models.SubscriptionInvoice as Model<ISubscriptionInvoice>) ||
  model<ISubscriptionInvoice>("SubscriptionInvoice", subscriptionInvoiceSchema);
