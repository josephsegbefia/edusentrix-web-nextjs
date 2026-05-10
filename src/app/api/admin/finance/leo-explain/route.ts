import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";

const requestSchema = z.object({
  item: z.object({
    title: z.string(),
    description: z.string(),
    severity: z.enum(["info", "warning", "critical"]),
    count: z.number().optional(),
    amountMinor: z.number().optional(),
    href: z.string(),
  }),
  trustStatus: z.enum(["healthy", "needs_review", "critical"]).optional(),
});

function money(amountMinor?: number) {
  if (amountMinor == null) return null;
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export async function POST(req: NextRequest) {
  try {
    await requireFinanceStaff();
    const body = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid Leo explanation request" }, { status: 400 });
    }

    const { item, trustStatus } = parsed.data;
    const amount = money(item.amountMinor);
    const evidence = [
      item.count != null ? `${item.count} item(s) involved` : null,
      amount ? `${amount} involved` : null,
      `Severity is ${item.severity}`,
      trustStatus ? `Finance trust status is ${trustStatus.replaceAll("_", " ")}` : null,
    ].filter(Boolean) as string[];

    const nextAction =
      item.severity === "critical"
        ? "Open the workflow now, review the evidence, and resolve or document the exception before sharing reports."
        : item.severity === "warning"
          ? "Open the workflow, clear high-confidence items first, and leave notes where human judgment is needed."
          : "Review when current critical and warning finance work is clear.";

    return NextResponse.json({
      success: true,
      data: {
        title: item.title,
        explanation: `${item.description} This matters because unresolved finance exceptions can make collections, balances, or audit exports unreliable.`,
        evidence,
        nextAction,
        href: item.href,
        guardrail:
          "Leo is explaining the queue item only. Any approval, reconciliation, reminder, refund, reversal, or closure must be confirmed by a finance user.",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error explaining finance queue item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to explain finance queue item" },
      { status: 500 }
    );
  }
}

