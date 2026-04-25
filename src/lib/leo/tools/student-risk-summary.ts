import "server-only";
import mongoose, { type Types } from "mongoose";
import { buildStudentInsightsDTO } from "@/lib/insights/buildStudentInsightsDTO";
import type { LeoAssistantDraft } from "@/lib/leo/types";

function extractStudentIdFromRoute(route?: string | null): string | null {
  if (!route) return null;
  const match = route.match(/\/admin\/students\/([a-fA-F0-9]{24})(?:\/|$|\?)/);
  return match?.[1] ?? null;
}

function formatMoney(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(Number(minor || 0) / 100);
}

function riskSentence(riskLevel: "low" | "medium" | "high") {
  if (riskLevel === "high") return "This student needs immediate follow-up.";
  if (riskLevel === "medium") return "This student needs closer monitoring.";
  return "This student is currently on track based on the available data.";
}

export async function runStudentRiskSummaryTool(args: {
  schoolId: Types.ObjectId;
  route?: string | null;
}): Promise<LeoAssistantDraft> {
  const studentId = extractStudentIdFromRoute(args.route);
  if (!studentId) {
    return {
      contentText:
        "Open a specific student profile first, then ask me again. I need the student page route so I can summarize the correct risk profile.",
      citations: [{ type: "route", label: "Students", ref: "/admin/students" }],
      toolsUsed: ["student_risk_summary"],
    };
  }

  const dto = await buildStudentInsightsDTO({
    schoolId: args.schoolId,
    studentId: new mongoose.Types.ObjectId(studentId),
  });

  const rb = dto.ruleBased;
  const lines = [
    `${dto.studentName} is currently marked ${rb.riskLevel} risk for ${dto.currentPeriodLabel || "the selected period"}. ${riskSentence(rb.riskLevel)}`,
  ];

  const profileParts = [dto.gradeName, dto.classGroupName].filter(Boolean);
  if (profileParts.length > 0) {
    lines.push(`Profile: ${profileParts.join(" / ")}.`);
  }

  if (rb.classPosition != null || rb.trend) {
    const movement =
      rb.trendDelta != null
        ? ` (${rb.trendDelta > 0 ? "+" : ""}${rb.trendDelta} points)`
        : "";
    lines.push(
      `Academic signal: ${rb.trend} trend${movement}${
        rb.classPosition != null && rb.classSize != null
          ? `, position ${rb.classPosition} of ${rb.classSize}`
          : ""
      }.`
    );
  }

  if (rb.attendanceRate != null) {
    lines.push(
      `Attendance signal: ${rb.attendanceRate}% attendance${
        rb.attendanceFlag ? " (below the monitoring threshold)" : ""
      }${rb.mostMissedDay ? `; most missed day is ${rb.mostMissedDay}` : ""}.`
    );
  }

  if (dto.feesDetail) {
    lines.push(
      `Fee signal: ${formatMoney(dto.feesDetail.outstandingMinor)} outstanding, status ${
        rb.feesStatus || "unknown"
      }, ${rb.overdueInvoices} overdue invoice${rb.overdueInvoices === 1 ? "" : "s"}.`
    );
  }

  if (rb.weaknesses.length > 0) {
    lines.push("", "Priority academic subjects:");
    for (const subject of rb.weaknesses.slice(0, 3)) {
      const classAvg =
        subject.classAvg != null ? `; class average ${subject.classAvg}` : "";
      lines.push(`- ${subject.subject}: ${subject.score}${classAvg}`);
    }
  }

  if (rb.strengths.length > 0) {
    lines.push("", "Current strengths:");
    for (const subject of rb.strengths.slice(0, 3)) {
      lines.push(`- ${subject.subject}: ${subject.score}`);
    }
  }

  if (dto.recentComments.length > 0) {
    lines.push("", "Recent teacher comments:");
    for (const comment of dto.recentComments.slice(0, 2)) {
      lines.push(`- ${comment.teacherName || "Teacher"}: ${comment.comment}`);
    }
  }

  lines.push(
    "",
    "Safe next action: review the student insights tab with the class teacher before contacting the guardian or planning interventions."
  );

  return {
    contentText: lines.join("\n"),
    citations: [
      { type: "record", label: "Student insights", ref: "src/lib/insights/buildStudentInsightsDTO.ts" },
      { type: "record", label: "Student", ref: `Student:${studentId}` },
      { type: "route", label: "Student profile", ref: `/admin/students/${studentId}` },
    ],
    toolsUsed: ["student_risk_summary"],
  };
}
