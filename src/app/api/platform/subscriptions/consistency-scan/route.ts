/**
 * POST /api/platform/subscriptions/consistency-scan
 *
 * Run the entitlement consistency scanner and return leakage issues.
 * Spec §19.3.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { runEntitlementConsistencyScan } from "@/lib/subscriptions/consistency-scanner";

const BodySchema = z.object({
  limit: z.number().int().min(1).max(500).default(100),
  schoolId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.billing.read");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  await connectToDatabase();

  const report = await runEntitlementConsistencyScan(parsed.data);

  return NextResponse.json({ success: true, data: report });
}
