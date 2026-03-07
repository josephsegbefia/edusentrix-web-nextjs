import { GET as getPayoutSettings } from "@/app/api/platform/billing/payout-settings/route";
import { POST as createChallenge } from "@/app/api/platform/billing/payout-settings/challenge/route";
import type { NextRequest } from "next/server";

export async function GET() {
  return getPayoutSettings();
}

export async function PATCH(req: NextRequest) {
  return createChallenge(req);
}
