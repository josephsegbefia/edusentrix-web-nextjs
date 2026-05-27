/**
 * GET  /api/platform/subscriptions/invoices  — list all school invoices
 * POST /api/platform/subscriptions/invoices  — create invoice
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { School } from "@/models/School";

const LINE_TYPES = [
  "plan_charge",
  "addon_purchase",
  "transaction_fee_settlement",
  "credit_adjustment",
  "penalty_fee",
  "refund",
] as const;

const LineSchema = z.object({
  lineType: z.enum(LINE_TYPES),
  description: z.string().trim().min(1).max(300),
  quantity: z.number().default(1),
  unitPriceMinor: z.number().int().min(0),
  reference: z.string().trim().nullable().optional(),
});

const CreateInvoiceSchema = z.object({
  schoolId: z.string().min(24).max(24),
  subscriptionId: z.string().nullable().optional(),
  lines: z.array(LineSchema).min(1),
  taxMinor: z.number().int().min(0).default(0),
  billingPeriodStart: z.string().datetime().nullable().optional(),
  billingPeriodEnd: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["draft", "issued"]).default("draft"),
});

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.billing.read");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  await connectToDatabase();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const LIMIT = 25;
  const skip = (page - 1) * LIMIT;
  const status = url.searchParams.get("status") ?? null;
  const schoolId = url.searchParams.get("schoolId") ?? null;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (schoolId && mongoose.Types.ObjectId.isValid(schoolId)) filter.schoolId = schoolId;

  const [invoices, total] = await Promise.all([
    SubscriptionInvoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(LIMIT).lean(),
    SubscriptionInvoice.countDocuments(filter),
  ]);

  const schoolIds = [...new Set(invoices.map((i) => String(i.schoolId)))];
  const nameMap: Record<string, string> = {};
  if (schoolIds.length) {
    const schools = await School.find({ _id: { $in: schoolIds } }).select("name").lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>();
    for (const s of schools) nameMap[String(s._id)] = s.name ?? "Unknown";
  }

  return NextResponse.json({
    success: true,
    data: invoices.map((inv) => ({
      ...inv,
      _id: String(inv._id),
      schoolId: String(inv.schoolId),
      subscriptionId: inv.subscriptionId ? String(inv.subscriptionId) : null,
      schoolName: nameMap[String(inv.schoolId)] ?? "Unknown",
    })),
    pagination: { page, limit: LIMIT, total, pages: Math.ceil(total / LIMIT) },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.subscriptions.manage");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  const body = await req.json();
  const parsed = CreateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  await connectToDatabase();

  const lines = parsed.data.lines.map((l) => ({
    ...l,
    subtotalMinor: Math.round(l.quantity * l.unitPriceMinor),
    reference: l.reference ?? null,
  }));
  const subtotalMinor = lines.reduce((sum, l) => sum + l.subtotalMinor, 0);
  const totalMinor = subtotalMinor + (parsed.data.taxMinor ?? 0);

  const invoice = await SubscriptionInvoice.create({
    ...parsed.data,
    lines,
    subtotalMinor,
    totalMinor,
    currency: "GHS",
    issuedAt: parsed.data.status === "issued" ? new Date() : null,
    createdByEmail: auth.email ?? null,
  });

  return NextResponse.json(
    { success: true, data: { ...invoice.toObject(), _id: String(invoice._id) } },
    { status: 201 }
  );
}
