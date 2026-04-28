import { connectToDatabase } from "@/db/connectToDatabase";
import { Delegation } from "@/models/Delegation";
import { recordActivity } from "@/lib/audit/recordActivity";
import { invalidateMergedDelegationCacheForUser } from "@/lib/delegations/service";

export type ExpireDelegationsResult = {
  expiredCount: number;
  delegationIds: string[];
};

/**
 * Marks delegations with `expiresAt <= now` as `expired` and writes `delegation.expired`
 * audit rows. Authorization already treats date-passed rows as inactive; this keeps DB
 * status aligned and produces lifecycle events.
 */
export async function markExpiredDelegations(): Promise<ExpireDelegationsResult> {
  await connectToDatabase();
  const now = new Date();

  const candidates = await Delegation.find({
    status: "active",
    expiresAt: { $ne: null, $lte: now },
  })
    .select({ _id: 1, schoolId: 1, staffUserId: 1, module: 1, grantedByUserId: 1 })
    .lean();

  const delegationIds: string[] = [];

  for (const row of candidates) {
    const res = await Delegation.updateOne(
      { _id: row._id, status: "active" },
      { $set: { status: "expired" } }
    );
    if (res.modifiedCount === 0) continue;

    delegationIds.push(String(row._id));
    invalidateMergedDelegationCacheForUser(row.schoolId, row.staffUserId);

    await recordActivity({
      schoolId: row.schoolId,
      userId: row.grantedByUserId,
      type: "delegation.expired",
      entityType: "Delegation",
      entityId: String(row._id),
      description: `Delegation expired: ${String(row.module)}`,
      metadata: {
        staffUserId: String(row.staffUserId),
        module: String(row.module),
        expiredByCron: true,
      },
    });
  }

  return { expiredCount: delegationIds.length, delegationIds };
}

export function isDelegationExpiryCronAuthorized(req: {
  headers: { get: (name: string) => string | null };
}): boolean {
  const secret =
    process.env.DELEGATIONS_EXPIRY_CRON_SECRET || process.env.CRON_SECRET || "";
  if (!secret) return false;
  const bearer = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";
  return bearer === `Bearer ${secret}` || xSecret === secret;
}
