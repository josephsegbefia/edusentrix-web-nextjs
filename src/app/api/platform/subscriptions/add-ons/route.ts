/**
 * GET  /api/platform/subscriptions/add-ons  — list catalog packages
 * POST /api/platform/subscriptions/add-ons  — create a package
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AddOnPackage, ADDON_PACKAGE_TYPES } from "@/models/AddOnPackage";

const CreatePackageSchema = z.object({
  code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/, "Lowercase alphanumeric + underscores only"),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).nullable().optional(),
  type: z.enum(ADDON_PACKAGE_TYPES as [string, ...string[]]),
  quantity: z.number().int().min(1),
  displayQuantity: z.number().nullable().optional(),
  displayUnit: z.string().trim().max(30).nullable().optional(),
  priceMinor: z.number().int().min(0),
  active: z.boolean().default(true),
  availableToPlans: z.array(z.string()).default([]),
  expiresWithBillingPeriod: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  await connectToDatabase();

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? null;
  const activeOnly = url.searchParams.get("activeOnly") !== "false";

  const filter: Record<string, unknown> = {};
  if (activeOnly) filter.active = true;
  if (type) filter.type = type;

  const packages = await AddOnPackage.find(filter)
    .sort({ type: 1, sortOrder: 1, priceMinor: 1 })
    .lean();

  return NextResponse.json({
    success: true,
    data: packages.map((p) => ({ ...p, _id: String(p._id) })),
  });
}

export async function POST(req: NextRequest) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  const body = await req.json();
  const parsed = CreatePackageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const existing = await AddOnPackage.findOne({ code: parsed.data.code });
  if (existing) {
    return NextResponse.json({ success: false, error: `Package code "${parsed.data.code}" already exists.` }, { status: 409 });
  }

  const pkg = await AddOnPackage.create({ ...parsed.data, currency: "GHS" });

  return NextResponse.json(
    { success: true, data: { ...pkg.toObject(), _id: String(pkg._id) } },
    { status: 201 }
  );
}
