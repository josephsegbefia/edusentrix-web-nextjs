import "server-only";
import type { Types } from "mongoose";
import { buildOverdueRiskSnapshot } from "@/lib/fees/overdue-risk";
import type { LeoAssistantDraft } from "@/lib/leo/types";

function formatMoney(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(Number(minor || 0) / 100);
}

export async function runFeesOverdueSummaryTool(args: {
  schoolId: Types.ObjectId;
}): Promise<LeoAssistantDraft> {
  const snapshot = await buildOverdueRiskSnapshot({
    schoolId: args.schoolId,
    limit: 40,
    topLimit: 5,
  });

  const { summary } = snapshot;
  const lines = [
    `As of ${new Date(snapshot.asOf).toLocaleString()}, overdue fees total ${formatMoney(summary.totalOutstandingMinor)} across ${summary.overdueInvoiceCount} invoice${summary.overdueInvoiceCount === 1 ? "" : "s"} and ${summary.overdueStudentCount} student${summary.overdueStudentCount === 1 ? "" : "s"}.`,
  ];

  const bucketEntries = Object.values(summary.buckets).filter(
    (bucket) => bucket.invoiceCount > 0
  );
  if (bucketEntries.length > 0) {
    lines.push("", "Aging buckets:");
    for (const bucket of bucketEntries) {
      lines.push(
        `- ${bucket.label}: ${formatMoney(bucket.amountMinor)} from ${bucket.invoiceCount} invoice${bucket.invoiceCount === 1 ? "" : "s"} (${bucket.studentCount} student${bucket.studentCount === 1 ? "" : "s"})`
      );
    }
  }

  if (snapshot.topStudents.length > 0) {
    lines.push("", "Highest-risk students:");
    for (const student of snapshot.topStudents) {
      const classLabel = student.classGroupName ? `, ${student.classGroupName}` : "";
      lines.push(
        `- ${student.studentName}${classLabel}: ${formatMoney(student.totalOutstandingMinor)}, ${student.overdueInvoiceCount} overdue invoice${student.overdueInvoiceCount === 1 ? "" : "s"}, oldest ${student.oldestDaysOverdue} day${student.oldestDaysOverdue === 1 ? "" : "s"} overdue`
      );
    }
  } else {
    lines.push("", "There are no overdue invoices in the current snapshot.");
  }

  if (snapshot.truncated) {
    lines.push(
      "",
      `This answer shows the top overdue rows. The full snapshot contains ${snapshot.totalRows} students.`
    );
  }

  lines.push(
    "",
    "Safe next action: review the overdue report, verify guardian contact details, and send reminders through the approved finance flow."
  );

  return {
    contentText: lines.join("\n"),
    citations: [
      {
        type: "record",
        label: "Overdue risk snapshot",
        ref: "src/lib/fees/overdue-risk.ts",
      },
      { type: "route", label: "Overdue report", ref: "/admin/overdue-report" },
      { type: "route", label: "Finance center", ref: "/admin/finance" },
    ],
    toolsUsed: ["fees_overdue_summary"],
  };
}
