import { Schema, model, models, Types, type Model } from "mongoose";

export interface IStoreOrderLine {
  productId: Types.ObjectId;
  nameSnapshot: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  /** When checkout originates from a supply program line */
  supplyProgramId?: Types.ObjectId | null;
  supplyProgramLineId?: Types.ObjectId | null;
}

export interface IStoreOrder {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  studentId: Types.ObjectId;
  /** Set when entire checkout is for a supply program */
  supplyProgramId?: Types.ObjectId | null;
  lines: IStoreOrderLine[];
  totalMinor: number;
  currency: string;
  status:
    | "pending_payment"
    | "paid"
    | "cancelled"
    | "failed";
  paystackReference?: string | null;
  /** Idempotency for Paystack init */
  idempotencyKey: string;
  failureReason?: string | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const lineSchema = new Schema<IStoreOrderLine>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "StoreProduct",
      required: true,
    },
    nameSnapshot: { type: String, required: true },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
    supplyProgramId: {
      type: Schema.Types.ObjectId,
      ref: "SupplyProgram",
      default: null,
    },
    supplyProgramLineId: {
      type: Schema.Types.ObjectId,
      ref: "SupplyProgramLine",
      default: null,
    },
  },
  { _id: false }
);

const storeOrderSchema = new Schema<IStoreOrder>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    supplyProgramId: {
      type: Schema.Types.ObjectId,
      ref: "SupplyProgram",
      default: null,
      index: true,
    },
    lines: { type: [lineSchema], required: true },
    totalMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "GHS" },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "cancelled", "failed"],
      default: "pending_payment",
      index: true,
    },
    paystackReference: { type: String, default: null, trim: true, sparse: true },
    idempotencyKey: { type: String, required: true, unique: true },
    failureReason: { type: String, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

storeOrderSchema.index({ schoolId: 1, createdAt: -1 });
storeOrderSchema.index({ schoolId: 1, parentUserId: 1, createdAt: -1 });

export const StoreOrder: Model<IStoreOrder> =
  (models.StoreOrder as Model<IStoreOrder>) ||
  model<IStoreOrder>("StoreOrder", storeOrderSchema);
