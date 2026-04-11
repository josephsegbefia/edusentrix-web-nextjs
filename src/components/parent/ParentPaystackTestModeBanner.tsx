"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { PaystackKeyMode } from "@/types/paystack-key-mode";

type Props = {
  paystackKeyMode: PaystackKeyMode;
  /** When false, parents are not offered online Paystack checkout — hide the banner. */
  onlinePaymentsReady: boolean;
};

/**
 * Shown on parent fee surfaces when the deployment uses Paystack test keys and the school
 * can accept online checkout. Matches admin payment-setup test-mode copy.
 */
export function ParentPaystackTestModeBanner({
  paystackKeyMode,
  onlinePaymentsReady,
}: Props) {
  if (!onlinePaymentsReady || paystackKeyMode !== "test") {
    return null;
  }

  return (
    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-100">
      <AlertCircle className="h-4 w-4 text-amber-200" />
      <AlertTitle>Paystack test mode</AlertTitle>
      <AlertDescription className="text-amber-100/90">
        This school uses test checkout right now. Payments and receipts appear in the Paystack
        dashboard only when Test mode is on — they will not show in live mode.
      </AlertDescription>
    </Alert>
  );
}
