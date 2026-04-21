// src/schemas/fee.ts
import { z } from "zod";

/** Coerce empty / NaN number inputs to undefined so optional amounts validate reliably */
const optionalNonNegMajor = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return undefined;
  return n;
}, z.number().min(0).optional());

const optionalInstallmentCount = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return undefined;
  return n;
}, z.number().int().min(2).max(12).optional().nullable());

export const CreateFeeStructureSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  code: z.string().min(1, "Code is required").max(20).transform((val) => val.toUpperCase()),
  description: z.string().max(500).optional().nullable(),
  category: z.enum(["tuition", "library", "sports", "uniform", "other"]),
  isActive: z.boolean(),
  defaultAmount: optionalNonNegMajor,
  allowsInstallments: z.boolean(),
  maxInstallments: optionalInstallmentCount,
});

export type CreateFeeStructureInput = z.infer<typeof CreateFeeStructureSchema>;

export const UpdateFeeStructureSchema = CreateFeeStructureSchema.partial();

export type UpdateFeeStructureInput = z.infer<typeof UpdateFeeStructureSchema>;
