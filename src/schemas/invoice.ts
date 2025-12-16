// src/schemas/invoice.ts
import { z } from "zod";

export const InstallmentScheduleConfigSchema = z.object({
  installmentNumber: z.number().int().min(1),
  dueDate: z.string().min(1, "Due date is required"), // ISO date string
  amount: z.number().min(0.01, "Amount must be greater than 0"),
});

export const InvoiceLineItemSchema = z.object({
  feeStructureId: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  description: z.string().max(500).optional().nullable(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  allowsInstallments: z.boolean().default(false),
  numberOfInstallments: z.number().int().min(2).max(12).optional().nullable(),
  installmentSchedule: z.array(InstallmentScheduleConfigSchema).optional().nullable(),
});

export const CreateInvoiceSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  academicPeriodId: z.string().min(1, "Academic period is required"),
  lineItems: z.array(InvoiceLineItemSchema).min(1, "At least one line item is required"),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  terms: z.string().max(500).optional().nullable(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type InvoiceLineItemInput = z.infer<typeof InvoiceLineItemSchema>;
