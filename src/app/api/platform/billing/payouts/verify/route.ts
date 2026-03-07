import { POST as verifyPayoutChange } from "@/app/api/platform/billing/payout-settings/route";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  return verifyPayoutChange(req);
}
