// src/schemas/bulk-invoice.ts
import { z } from "zod";

export const InstallmentScheduleConfigSchema = z.object({
  installmentNumber: z.number().int().min(1),
  dueDate: z.string().min(1, "Due date is required"), // ISO date string
  amount: z.number().min(0.01, "Amount must be greater than 0"),
});

export const BulkInvoiceLineItemSchema = z.object({
  feeStructureId: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  description: z.string().max(500).optional().nullable(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  allowsInstallments: z.boolean(),
  numberOfInstallments: z.number().int().min(2).max(12).optional().nullable(),
  installmentSchedule: z.array(InstallmentScheduleConfigSchema).optional().nullable(),
});

export const BulkCreateInvoiceSchema = z.object({
  academicPeriodId: z.string().min(1, "Academic period is required"),
  studentIds: z.array(z.string().min(1)).min(1, "At least one student is required"),
  lineItems: z.array(BulkInvoiceLineItemSchema).min(1, "At least one line item is required"),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  terms: z.string().max(500).optional().nullable(),
});

export type BulkCreateInvoiceInput = z.infer<typeof BulkCreateInvoiceSchema>;
