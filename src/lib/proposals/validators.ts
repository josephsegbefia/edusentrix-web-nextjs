import { z } from "zod";

export const ProposalPricingSchema = z.object({
  currency: z.enum(["GHS", "USD"]).default("GHS"),
  setupFee: z.coerce.number().nonnegative().optional().nullable(),
  recurringFee: z.coerce.number().nonnegative().optional().nullable(),
  cadence: z.enum(["monthly", "termly", "annual"]).optional().nullable(),
  studentRange: z.string().trim().max(80).optional().nullable(),
  discountNote: z.string().trim().max(300).optional().nullable(),
  paymentTerms: z.string().trim().max(300).optional().nullable(),
});

export const ProposalSectionSchema = z.object({
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(180),
  subtitle: z.string().trim().max(220).optional().nullable(),
  content: z.string(),
  order: z.coerce.number().int().min(0),
  enabled: z.boolean().default(true),
  displayStyle: z.enum(["standard", "highlight", "cards", "table", "callout"]).default("standard"),
  pageBreakBefore: z.boolean().default(false),
  pageBreakAfter: z.boolean().default(false),
});

export const CreateProposalSchema = z.object({
  schoolName: z.string().trim().min(2).max(180),
  schoolLocation: z.string().trim().max(180).optional().nullable(),
  schoolId: z.string().trim().optional().nullable(),
  prospectId: z.string().trim().optional().nullable(),
  leadId: z.string().trim().optional().nullable(),
  applicationId: z.string().trim().optional().nullable(),
  source: z.enum(["manual", "school_record", "prospect", "lead", "demo_visit", "application"]).default("manual"),
  recipientName: z.string().trim().max(140).optional().nullable(),
  recipientTitle: z.string().trim().max(140).optional().nullable(),
  recipientEmail: z.string().trim().email().optional().or(z.literal("")).nullable(),
  recipientPhone: z.string().trim().max(40).optional().nullable(),
  proposalType: z.enum(["general", "pilot", "full_implementation", "pricing", "demo_follow_up"]).default("general"),
  templateId: z.string().trim().optional().nullable(),
  selectedModules: z.array(z.string().trim().min(1)).default([]),
  pilotDuration: z.string().trim().max(80).optional().nullable(),
  preparedByName: z.string().trim().max(140).optional().nullable(),
  internalNotes: z.string().trim().max(1000).optional().nullable(),
  pricing: ProposalPricingSchema.optional(),
});

export const UpdateProposalSchema = z.object({
  schoolName: z.string().trim().min(2).max(180).optional(),
  schoolLocation: z.string().trim().max(180).optional().nullable(),
  recipientName: z.string().trim().max(140).optional().nullable(),
  recipientTitle: z.string().trim().max(140).optional().nullable(),
  recipientEmail: z.string().trim().email().optional().or(z.literal("")).nullable(),
  recipientPhone: z.string().trim().max(40).optional().nullable(),
  title: z.string().trim().min(2).max(220).optional(),
  selectedModules: z.array(z.string().trim().min(1)).optional(),
  sections: z.array(ProposalSectionSchema).optional(),
  pricing: ProposalPricingSchema.optional(),
  nextFollowUpDate: z.string().datetime().optional().nullable(),
  followUpNotes: z.string().trim().max(2000).optional().nullable(),
  internalNotes: z.string().trim().max(2000).optional().nullable(),
  status: z
    .enum(["draft", "ready", "sent", "followed_up", "demo_scheduled", "pilot_started", "accepted", "rejected", "archived"])
    .optional(),
});
