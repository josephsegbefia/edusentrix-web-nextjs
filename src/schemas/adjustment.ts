// src/schemas/adjustment.ts
import { z } from "zod";

export const AddAdjustmentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  lineItems: z.array(
    z.object({
      name: z.string().min(1, "Name is required"),
      description: z.string().max(500).optional().nullable(),
      amount: z.number().refine((val) => val !== 0, {
        message: "Amount cannot be zero",
      }),
      adjustmentType: z.enum(["waiver", "scholarship", "correction", "penalty", "other"]),
      adjustmentReason: z.string().min(1, "Reason is required").max(500),
    })
  ).min(1, "At least one adjustment line item is required"),
});

export type AddAdjustmentInput = z.infer<typeof AddAdjustmentSchema>;
