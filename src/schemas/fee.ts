// src/schemas/fee.ts
import { z } from "zod";

export const CreateFeeStructureSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  code: z.string().min(1, "Code is required").max(20).transform((val) => val.toUpperCase()),
  description: z.string().max(500).optional().nullable(),
  category: z.enum(["tuition", "library", "sports", "uniform", "other"]),
  isActive: z.boolean().default(true),
  defaultAmount: z.number().min(0).optional().nullable(),
  allowsInstallments: z.boolean().default(false),
  maxInstallments: z.number().int().min(2).max(12).optional().nullable(),
});

export type CreateFeeStructureInput = z.infer<typeof CreateFeeStructureSchema>;

export const UpdateFeeStructureSchema = CreateFeeStructureSchema.partial();

export type UpdateFeeStructureInput = z.infer<typeof UpdateFeeStructureSchema>;
