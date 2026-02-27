// src/schemas/promotion-policy.ts
// PROMO-BE-002: Zod validation for promotion policy per PROMOTION_SERVICE_SPEC §8.1
import { z } from "zod";

const criteriaKeyEnum = z.enum([
  "attendance_percent",
  "overall_average",
  "subjects_passed_percent",
  "fee_outstanding_minor",
  "discipline_flags",
]);

const operatorEnum = z.enum([">=", "<=", ">", "<", "="]);

const stageEnum = z.enum([
  "nursery",
  "primary",
  "jhs",
  "shs",
  "basic",
  "other",
]);

export const PromotionPolicyCriteriaSchema = z.object({
  key: criteriaKeyEnum,
  operator: operatorEnum,
  value: z.number(),
  weight: z.number().min(0).optional(),
  required: z.boolean().optional(),
});

export const CreatePromotionPolicySchema = z.object({
  name: z.string().trim().min(1, "Policy name is required").max(200),
  appliesTo: z.object({
    stage: stageEnum.optional(),
    gradeIds: z.array(z.string().length(24)).optional(),
  }).optional().default({}),
  criteria: z
    .array(PromotionPolicyCriteriaSchema)
    .min(1, "At least one criterion is required"),
  logic: z.enum(["all_required_pass", "weighted_score"]),
  thresholds: z.object({
    promote: z.number().min(0).max(100),
    holdForReview: z.number().min(0).max(100).optional(),
  }),
  tieBreaker: z.enum(["manual_review", "attendance", "overall_average"]),
  attendanceComputation: z.object({
    treatExcusedAsPresent: z.boolean(),
  }),
  financeHold: z.object({
    enabled: z.boolean(),
    maxOutstandingMinor: z.number().min(0),
  }),
  manualOverrideRules: z.object({
    requireReason: z.boolean(),
    requireApprover: z.boolean(),
  }),
});

export type CreatePromotionPolicyInput = z.infer<
  typeof CreatePromotionPolicySchema
>;
