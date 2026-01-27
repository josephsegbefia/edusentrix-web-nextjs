// src/schemas/payment.ts
import { z } from "zod";
import { Schema as MongooseSchema } from "mongoose";

export const PaymentAllocationSchema = z.object({
  invoiceLineItemId: z.string().min(1, "Line item is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  installmentScheduleId: z.string().optional().nullable(),
  installmentNumber: z.number().int().min(1).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const CreatePaymentSchema = z
  .object({
    invoiceId: z.string().min(1, "Invoice is required"),
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    paymentMethod: z.enum([
      "cash",
      "bank_transfer",
      "mobile_money",
      "paystack",
      "cheque",
      "other",
    ]),
    approvalStatus: {
      type: String,
      enum: ["not_required", "pending", "approved", "rejected"],
      default: "not_required",
      index: true,
    },
    submittedBy: {
      type: MongooseSchema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reviewdBy: {
      type: MongooseSchema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, defaul: null, trim: true },
    requestAllocations: {
      type: [
        {
          invoiceLineItemId: {
            type: MongooseSchema.Types.ObjectId,
            ref: "InvoiceLineItem",
            required: true,
          },
          amountMinor: { type: Number, required: true },
          installmentScheduleId: {
            type: MongooseSchema.Types.ObjectId,
            ref: "InstallmentSchedule",
            default: null,
          },
          installmentNumber: { type: Number, default: null },
          notes: { type: String, default: null, trim: true },
        },
      ],
      default: [],
    },
    allocations: z
      .array(PaymentAllocationSchema)
      .min(1, "At least one allocation is required"),
    paymentDate: z.string().optional(),
    notes: z.string().max(1000).optional().nullable(),
    receiptNumber: z.string().max(50).optional().nullable(),
  })
  .refine(
    (data) => {
      const totalAllocated = data.allocations.reduce(
        (sum, a) => sum + a.amount,
        0
      );
      return Math.abs(totalAllocated - data.amount) < 0.01;
    },
    {
      message: "Allocation amounts must sum to payment amount",
      path: ["allocations"],
    }
  );

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type PaymentAllocationInput = z.infer<typeof PaymentAllocationSchema>;
