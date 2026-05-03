import "server-only";

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getPaystackKeyMode } from "@/lib/paystack";
import { loadSchoolInternalTestSnapshot } from "./load-internal-test-context";
import {
  shouldDisableRealPaymentCollection,
  shouldUseSandboxPayments,
} from "./shouldUseSandboxPayments";

/** Blocks parent-initiated checkout when internal-test payment rules disallow it. */
export async function assertParentCheckoutAllowed(
  schoolId: mongoose.Types.ObjectId
): Promise<NextResponse | null> {
  const snap = await loadSchoolInternalTestSnapshot(schoolId);
  if (shouldDisableRealPaymentCollection(snap)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Online payments are disabled for this school's internal test configuration.",
        code: "internal_test_payments_disabled",
      },
      { status: 403 }
    );
  }
  if (shouldUseSandboxPayments(snap) && getPaystackKeyMode() === "live") {
    return NextResponse.json(
      {
        success: false,
        error:
          "This school is configured for sandbox payments only; the gateway is in live mode.",
        code: "internal_test_sandbox_required",
      },
      { status: 400 }
    );
  }
  return null;
}
