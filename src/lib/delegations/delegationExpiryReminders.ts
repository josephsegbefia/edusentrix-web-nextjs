import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import { Delegation } from "@/models/Delegation";
import { Notification } from "@/models/Notification";
import { School } from "@/models/School";
import type { DelegationModule } from "@/lib/delegations/types";
import { notifyDelegationExpiryReminder } from "@/lib/delegations/notifications";

export type DelegationExpiryRemindersResult = { reminded: number };

/**
 * In-app + email reminder for delegations expiring within 3 days (DELEGATIONS_FEATURE_SPEC §23).
 * One reminder per delegation via Notification deduplication.
 */
export async function sendDelegationExpiryReminders(): Promise<DelegationExpiryRemindersResult> {
  await connectToDatabase();
  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const rows = await Delegation.find({
    status: "active",
    expiresAt: { $gt: now, $lte: horizon },
  })
    .select({ _id: 1, schoolId: 1, staffUserId: 1, module: 1, expiresAt: 1 })
    .lean();

  let reminded = 0;
  for (const row of rows) {
    const delegationId = row._id;
    const dup = await Notification.findOne({
      schoolId: row.schoolId,
      userId: row.staffUserId,
      "metadata.kind": "delegation_expiry_reminder",
      "metadata.delegationId": String(delegationId),
    })
      .select({ _id: 1 })
      .lean();
    if (dup) continue;

    const expiresAt = row.expiresAt;
    if (!expiresAt) continue;

    const school = await School.findById(row.schoolId).select({ name: 1 }).lean<{ name?: string } | null>();

    await notifyDelegationExpiryReminder({
      schoolId: row.schoolId,
      staffUserId: row.staffUserId,
      delegationId,
      module: row.module as DelegationModule,
      expiresAt,
      schoolName: school?.name,
    });
    reminded += 1;
  }

  return { reminded };
}
