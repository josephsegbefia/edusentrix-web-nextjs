/**
 * GET /api/admin/subscription/invoices
 *
 * School admin: view their school's subscription invoices.
 * Read-only. Filters out draft invoices from school view.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";

export async function GET(req: NextRequest) {
  const auth = await requireSchoolAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const { schoolId } = auth;

  await connectToDatabase();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const LIMIT = 10;
  const skip = (page - 1) * LIMIT;

  const [invoices, total] = await Promise.all([
    SubscriptionInvoice.find({
      schoolId,
      status: { $nin: ["draft", "cancelled"] },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(LIMIT)
      .lean(),
    SubscriptionInvoice.countDocuments({
      schoolId,
      status: { $nin: ["draft", "cancelled"] },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: invoices.map((inv) => ({
      _id: String(inv._id),
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      totalMinor: inv.totalMinor,
      currency: inv.currency,
      billingPeriodStart: inv.billingPeriodStart?.toISOString() ?? null,
      billingPeriodEnd: inv.billingPeriodEnd?.toISOString() ?? null,
      issuedAt: inv.issuedAt?.toISOString() ?? null,
      dueAt: inv.dueAt?.toISOString() ?? null,
      paidAt: inv.paidAt?.toISOString() ?? null,
      note: inv.note ?? null,
    })),
    pagination: { page, limit: LIMIT, total, pages: Math.ceil(total / LIMIT) },
  });
}
