import { NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { syncCanonicalSubscriptionPlans } from "@/lib/subscriptions/default-plan-seeds";

export async function POST() {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  await connectToDatabase();
  const result = await syncCanonicalSubscriptionPlans();

  return NextResponse.json({ success: true, data: result });
}
