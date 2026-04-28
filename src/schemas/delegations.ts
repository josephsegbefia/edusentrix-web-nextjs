import { z } from "zod";
import { listImplementedModules } from "@/lib/delegations/registry";

const implementedModuleEnum = z.enum(
  listImplementedModules() as [string, ...string[]]
);

export const CreateDelegationBodySchema = z.object({
  staffUserId: z.string().min(1),
  module: implementedModuleEnum,
  preset: z.string().min(1),
  expiresAt: z.string().datetime().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export const PatchDelegationBodySchema = z.object({
  preset: z.string().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  note: z.string().max(2000).optional().nullable(),
});

export const RevokeDelegationBodySchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
});

export type CreateDelegationBody = z.infer<typeof CreateDelegationBodySchema>;
export type PatchDelegationBody = z.infer<typeof PatchDelegationBodySchema>;
