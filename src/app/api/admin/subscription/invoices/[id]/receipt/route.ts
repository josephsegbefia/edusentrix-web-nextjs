import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { School } from "@/models/School";
import { renderSubscriptionReceiptPdf } from "@/lib/subscriptions/subscription-receipts";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireSchoolAdmin();

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid invoice ID." }, { status: 400 });
  }

  await connectToDatabase();

  const invoice = await SubscriptionInvoice.findOne({
    _id: id,
    schoolId: auth.schoolId,
    status: "paid",
  });
  if (!invoice) {
    return NextResponse.json({ success: false, error: "Paid invoice not found." }, { status: 404 });
  }

  const school = await School.findById(auth.schoolId).select("name").lean<{ name?: string | null } | null>();
  const pdf = await renderSubscriptionReceiptPdf({
    invoice: invoice.toObject() as never,
    schoolName: school?.name || "School",
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}-receipt.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
