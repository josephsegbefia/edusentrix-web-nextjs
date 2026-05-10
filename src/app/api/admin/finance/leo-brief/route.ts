import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";

const commandCenterSchema = z.object({
  context: z.object({
    range: z.object({ label: z.string() }),
    currency: z.string().optional(),
    lastRefreshedAt: z.string().optional(),
  }),
  kpis: z.object({
    collectedMinor: z.number().default(0),
    outstandingFeesMinor: z.number().default(0),
    overdueFeesMinor: z.number().default(0),
    overdueStudentCount: z.number().default(0),
    pendingApprovalCount: z.number().default(0),
    pendingApprovalMinor: z.number().default(0),
    unreconciledCount: z.number().default(0),
    unreconciledMinor: z.number().default(0),
    failedTransactionCount: z.number().default(0),
    netCashMovementMinor: z.number().default(0),
  }),
  trust: z.object({
    status: z.enum(["healthy", "needs_review", "critical"]),
    unmatchedCount: z.number().default(0),
    ambiguousCount: z.number().default(0),
    activeAlertCount: z.number().default(0),
    criticalAlertCount: z.number().default(0),
    makerCheckerPendingCount: z.number().default(0),
  }),
  workQueue: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      severity: z.enum(["info", "warning", "critical"]),
      count: z.number().optional(),
      amountMinor: z.number().optional(),
      href: z.string(),
    })
  ),
  fees: z.object({
    collectionRate: z.number().default(0),
    topOverdue: z.array(
      z.object({
        studentName: z.string(),
        amountMinor: z.number(),
        invoiceCount: z.number().optional(),
      })
    ),
  }),
});

function money(amountMinor: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function severityWeight(severity: "info" | "warning" | "critical") {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

export async function POST(req: NextRequest) {
  try {
    await requireFinanceStaff();
    const body = await req.json().catch(() => null);
    const parsed = commandCenterSchema.safeParse(body?.commandCenter);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid finance command-center evidence" },
        { status: 400 }
      );
    }

    const command = parsed.data;
    const currency = command.context.currency || "GHS";
    const topQueue = [...command.workQueue]
      .sort((a, b) => {
        const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
        if (severityDiff) return severityDiff;
        return (b.amountMinor || 0) - (a.amountMinor || 0);
      })
      .slice(0, 3);

    const risks: string[] = [];
    if (command.trust.status === "critical") risks.push("finance controls need critical review");
    if (command.kpis.unreconciledCount > 0) {
      risks.push(`${command.kpis.unreconciledCount} reconciliation item(s) are unresolved`);
    }
    if (command.kpis.overdueStudentCount > 0) {
      risks.push(`${command.kpis.overdueStudentCount} overdue fee account(s) need follow-up`);
    }
    if (command.kpis.failedTransactionCount > 0) {
      risks.push(`${command.kpis.failedTransactionCount} failed transaction(s) should be checked`);
    }

    const recommendedActions = topQueue.map((item) => ({
      title: item.title,
      href: item.href,
      reason: item.amountMinor
        ? `${item.severity} priority, ${money(item.amountMinor, currency)} involved`
        : `${item.severity} priority${item.count ? `, ${item.count} item(s)` : ""}`,
    }));

    const leadingOverdue = command.fees.topOverdue[0];
    const evidence = [
      { label: "Range", value: command.context.range.label },
      { label: "Collected", value: money(command.kpis.collectedMinor, currency) },
      { label: "Outstanding fees", value: money(command.kpis.outstandingFeesMinor, currency) },
      { label: "Unreconciled", value: String(command.kpis.unreconciledCount) },
      { label: "Pending approval", value: String(command.kpis.pendingApprovalCount) },
      { label: "Trust status", value: command.trust.status.replaceAll("_", " ") },
    ];
    if (leadingOverdue) {
      evidence.push({
        label: "Largest overdue account",
        value: `${leadingOverdue.studentName} · ${money(leadingOverdue.amountMinor, currency)}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: `${command.context.range.label}: ${money(
          command.kpis.collectedMinor,
          currency
        )} collected, ${money(command.kpis.outstandingFeesMinor, currency)} outstanding, and ${
          command.kpis.unreconciledCount
        } unreconciled item(s).`,
        riskLevel: command.trust.status,
        risks,
        recommendedActions,
        evidence,
        guardrail:
          "Leo can explain, rank, and draft finance work. Approvals, reminders, reconciliation, refunds, and reversals still require explicit human confirmation.",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error building Leo finance brief:", error);
    return NextResponse.json(
      { success: false, error: "Failed to build Leo finance brief" },
      { status: 500 }
    );
  }
}

