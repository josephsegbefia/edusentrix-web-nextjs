import { NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { renderSubscriptionBillingGuidePdf } from "@/lib/subscriptions/billing-guide-pdf";

export async function GET() {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  const pdf = await renderSubscriptionBillingGuidePdf();
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="edusentrix-subscription-billing-guide.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
