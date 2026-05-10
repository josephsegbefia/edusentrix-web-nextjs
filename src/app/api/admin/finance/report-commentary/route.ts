import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";

const evidenceSchema = z.object({
  reportType: z.enum([
    "collections",
    "debtors",
    "invoices",
    "cashbook",
    "reconciliation",
    "disbursements",
  ]),
  commandCenter: z.object({
    context: z.object({
      range: z.object({ label: z.string() }),
      currency: z.string().optional(),
    }),
    kpis: z.object({
      collectedMinor: z.number().default(0),
      outstandingFeesMinor: z.number().default(0),
      overdueFeesMinor: z.number().default(0),
      overdueStudentCount: z.number().default(0),
      pendingApprovalCount: z.number().default(0),
      unreconciledCount: z.number().default(0),
      netCashMovementMinor: z.number().default(0),
    }),
    trust: z.object({
      status: z.enum(["healthy", "needs_review", "critical"]),
      unmatchedCount: z.number().default(0),
      ambiguousCount: z.number().default(0),
      activeAlertCount: z.number().default(0),
    }),
    fees: z.object({
      collectionRate: z.number().default(0),
      topOverdue: z.array(
        z.object({
          studentName: z.string(),
          amountMinor: z.number(),
        })
      ),
    }),
  }),
});

function money(amountMinor: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

const reportLabels: Record<z.infer<typeof evidenceSchema>["reportType"], string> = {
  collections: "Collections report",
  debtors: "Debtors report",
  invoices: "Invoice report",
  cashbook: "Cashbook / ledger report",
  reconciliation: "Reconciliation report",
  disbursements: "Disbursement report",
};

export async function POST(req: NextRequest) {
  try {
    await requireFinanceStaff();
    const body = await req.json().catch(() => null);
    const parsed = evidenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid report commentary evidence" },
        { status: 400 }
      );
    }

    const { reportType, commandCenter } = parsed.data;
    const currency = commandCenter.context.currency || "GHS";
    const label = reportLabels[reportType];
    const topOverdue = commandCenter.fees.topOverdue[0];

    const highlights = [
      `${money(commandCenter.kpis.collectedMinor, currency)} collected for ${commandCenter.context.range.label.toLowerCase()}`,
      `${money(commandCenter.kpis.outstandingFeesMinor, currency)} currently outstanding`,
      `${Math.round(commandCenter.fees.collectionRate)}% collection rate`,
    ];

    const risks: string[] = [];
    if (commandCenter.kpis.overdueStudentCount > 0) {
      risks.push(
        `${commandCenter.kpis.overdueStudentCount} overdue account(s), totaling ${money(
          commandCenter.kpis.overdueFeesMinor,
          currency
        )}`
      );
    }
    if (commandCenter.kpis.unreconciledCount > 0) {
      risks.push(`${commandCenter.kpis.unreconciledCount} unreconciled item(s) remain open`);
    }
    if (commandCenter.trust.status !== "healthy") {
      risks.push(`finance trust status is ${commandCenter.trust.status.replaceAll("_", " ")}`);
    }

    const commentary = [
      `${label} commentary for ${commandCenter.context.range.label}.`,
      `The school collected ${money(commandCenter.kpis.collectedMinor, currency)} and has ${money(
        commandCenter.kpis.outstandingFeesMinor,
        currency
      )} outstanding. The current collection rate is ${Math.round(commandCenter.fees.collectionRate)}%.`,
      risks.length
        ? `Key attention areas: ${risks.join("; ")}.`
        : "No major finance exceptions are visible from the command-center evidence.",
      topOverdue
        ? `The largest overdue account in this snapshot is ${topOverdue.studentName} at ${money(
            topOverdue.amountMinor,
            currency
          )}.`
        : "No top overdue account was provided in this snapshot.",
      "Finance should confirm source filters and reconciliation status before sharing this commentary externally.",
    ].join("\n\n");

    return NextResponse.json({
      success: true,
      data: {
        reportType,
        title: `${label} commentary`,
        commentary,
        highlights,
        risks,
        evidence: [
          { label: "Range", value: commandCenter.context.range.label },
          { label: "Collected", value: money(commandCenter.kpis.collectedMinor, currency) },
          {
            label: "Outstanding",
            value: money(commandCenter.kpis.outstandingFeesMinor, currency),
          },
          { label: "Collection rate", value: `${Math.round(commandCenter.fees.collectionRate)}%` },
          { label: "Trust status", value: commandCenter.trust.status.replaceAll("_", " ") },
        ],
        guardrail:
          "This is a draft narrative. Finance must verify report filters, reconciliation status, and export evidence before sharing.",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error generating finance report commentary:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate finance report commentary" },
      { status: 500 }
    );
  }
}

