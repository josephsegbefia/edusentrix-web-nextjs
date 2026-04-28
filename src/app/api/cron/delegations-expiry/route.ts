// POST/GET — mark `active` delegations past `expiresAt` as `expired` + audit.
//
// Auth: `DELEGATIONS_EXPIRY_CRON_SECRET` or fallback `CRON_SECRET`, via
// `Authorization: Bearer <secret>` or `x-cron-secret: <secret>`.

import { NextRequest, NextResponse } from "next/server";
import {
  isDelegationExpiryCronAuthorized,
  markExpiredDelegations,
} from "@/lib/delegations/expireDelegations";
import { sendDelegationExpiryReminders } from "@/lib/delegations/delegationExpiryReminders";

export async function POST(req: NextRequest) {
  if (!isDelegationExpiryCronAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await markExpiredDelegations();
    const reminders = await sendDelegationExpiryReminders();
    return NextResponse.json({
      success: true,
      data: { ...expired, expiryReminders: reminders },
    });
  } catch (e) {
    console.error("delegations-expiry cron:", e);
    return NextResponse.json(
      { success: false, error: "Failed to expire delegations" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
