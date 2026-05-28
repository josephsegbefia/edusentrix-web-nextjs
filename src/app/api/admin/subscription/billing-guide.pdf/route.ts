import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { renderSubscriptionBillingGuidePdf } from "@/lib/subscriptions/billing-guide-pdf";

export async function GET() {
  await requireSchoolAdmin();
  const pdf = await renderSubscriptionBillingGuidePdf();
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="edusentrix-subscription-billing-guide.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
