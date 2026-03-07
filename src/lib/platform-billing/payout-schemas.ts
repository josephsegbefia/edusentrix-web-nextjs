import { z } from "zod";

export const PlatformPayoutDestinationInputSchema = z
  .object({
    method: z.enum(["bank", "mobile_money"]),
    accountName: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().min(4).max(40),
    bankName: z.string().trim().max(120).optional().nullable().default(null),
    bankCode: z.string().trim().max(40).optional().nullable().default(null),
    providerName: z.string().trim().max(120).optional().nullable().default(null),
    notes: z.string().trim().max(240).optional().nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.method === "bank" && !value.bankName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bank name is required for bank payouts.",
        path: ["bankName"],
      });
    }

    if (value.method === "mobile_money" && !value.providerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provider name is required for mobile money payouts.",
        path: ["providerName"],
      });
    }
  });
