import "server-only";

import mongoose from "mongoose";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";

/** Audit when a checkout uses sandbox/test Paystack for an internal test school (spec §20). */
export async function recordPaymentSandboxUsed(input: {
  actorId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  reference: string;
  paystackKeyMode: string;
  /** Optional — fee vs store */
  channel?: "parent_fees" | "parent_store";
}) {
  await PlatformAuditLog.create({
    actorId: input.actorId,
    schoolId: input.schoolId,
    action: "internal_test.payment_sandbox_used",
    entityType: "payment_checkout",
    metadata: {
      reference: input.reference,
      paystackKeyMode: input.paystackKeyMode,
      channel: input.channel ?? "parent_fees",
    },
  });
}
