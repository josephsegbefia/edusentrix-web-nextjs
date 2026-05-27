/**
 * GET   /api/platform/subscriptions/invoices/[id]
 * PATCH /api/platform/subscriptions/invoices/[id]  — update status, paid ref, note
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  status: z.enum(["draft", "issued", "paid", "overdue", "forgiven", "cancelled"]).optional(),
  paidAt: z.string().datetime().nullable().optional(),
  paidReference: z.string().trim().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.billing.read");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid ID." }, { status: 400 });
  }

  await connectToDatabase();

  const invoice = await SubscriptionInvoice.findById(id).lean();
  if (!invoice) return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: { ...invoice, _id: String(invoice._id), schoolId: String(invoice.schoolId) },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.subscriptions.manage");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid ID." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  await connectToDatabase();

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "paid" && !parsed.data.paidAt) {
    update.paidAt = new Date();
  }
  if (parsed.data.status === "issued") {
    update.issuedAt = new Date();
  }

  const invoice = await SubscriptionInvoice.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!invoice) return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: { ...invoice.toObject(), _id: String(invoice._id) },
  });
}
