/**
 * GET   /api/platform/subscriptions/invoices/[id]
 * PATCH /api/platform/subscriptions/invoices/[id]  — update status, paid ref, note
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";
import { sendSubscriptionReceiptForInvoice } from "@/lib/subscriptions/subscription-receipts";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  status: z.enum(["draft", "issued", "paid", "overdue", "forgiven", "cancelled"]).optional(),
  paidAt: z.string().datetime().nullable().optional(),
  paidReference: z.string().trim().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

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
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

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

  const previous = await SubscriptionInvoice.findById(id).lean();
  const invoice = await SubscriptionInvoice.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!invoice) return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });

  if (parsed.data.status === "paid" && previous?.status !== "paid") {
    await recordSubscriptionEvent({
      schoolId: invoice.schoolId,
      subscriptionId: invoice.subscriptionId ?? null,
      eventType: "payment_recorded",
      actorEmail: perm.actor.email ?? null,
      summary: `Subscription invoice ${invoice.invoiceNumber} marked paid.`,
      metadata: {
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        totalMinor: invoice.totalMinor,
        paidReference: invoice.paidReference ?? null,
      },
    });

    try {
      await sendSubscriptionReceiptForInvoice(invoice._id);
    } catch (error) {
      console.error("[subscription-receipt] Failed to send receipt", error);
    }
  }

  return NextResponse.json({
    success: true,
    data: { ...invoice.toObject(), _id: String(invoice._id) },
  });
}
