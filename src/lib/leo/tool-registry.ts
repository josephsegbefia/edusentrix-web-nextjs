import "server-only";
import type { Types } from "mongoose";
import type { LeoAssistantDraft, LeoToolKey } from "@/lib/leo/types";
import { withLeoResponseCache } from "@/lib/leo/response-cache";
import { runClassSubjectTeacherLinksTool } from "@/lib/leo/tools/class-subject-teacher-links";
import { runClassTimetableStatusTool } from "@/lib/leo/tools/class-timetable-status";
import { runFeesOverdueSummaryTool } from "@/lib/leo/tools/fees-overdue-summary";
import { runReportBriefTool } from "@/lib/leo/tools/report-brief";
import { runSetupReadinessSummaryTool } from "@/lib/leo/tools/setup-readiness-summary";
import { runSettingsChangeImpactTool } from "@/lib/leo/tools/settings-change-impact";
import { runStudentRiskSummaryTool } from "@/lib/leo/tools/student-risk-summary";
import { runTeacherAssignmentConflictsTool } from "@/lib/leo/tools/teacher-assignment-conflicts";
import { runTeacherWeekSummaryTool } from "@/lib/leo/tools/teacher-week-summary";

export type LeoToolExecutionContext = {
  schoolId: Types.ObjectId;
  route?: string | null;
  userMessage: string;
};

type LeoRegisteredTool = {
  key: LeoToolKey;
  family: "setup" | "timetable" | "teacher" | "student" | "finance" | "reports" | "settings";
  cacheTtlSeconds?: number;
  run: (ctx: LeoToolExecutionContext) => Promise<LeoAssistantDraft>;
};

export const LEO_TOOL_REGISTRY: Record<LeoToolKey, LeoRegisteredTool> = {
  setup_readiness_summary: {
    key: "setup_readiness_summary",
    family: "setup",
    run: (ctx) => runSetupReadinessSummaryTool({ schoolId: ctx.schoolId }),
  },
  teacher_assignment_conflicts: {
    key: "teacher_assignment_conflicts",
    family: "teacher",
    run: (ctx) =>
      runTeacherAssignmentConflictsTool({
        schoolId: ctx.schoolId,
        route: ctx.route ?? null,
      }),
  },
  class_timetable_status: {
    key: "class_timetable_status",
    family: "timetable",
    run: (ctx) =>
      runClassTimetableStatusTool({
        schoolId: ctx.schoolId,
        route: ctx.route ?? null,
      }),
  },
  class_subject_teacher_links: {
    key: "class_subject_teacher_links",
    family: "timetable",
    run: (ctx) =>
      runClassSubjectTeacherLinksTool({
        schoolId: ctx.schoolId,
        route: ctx.route ?? null,
      }),
  },
  teacher_week_summary: {
    key: "teacher_week_summary",
    family: "teacher",
    run: (ctx) =>
      runTeacherWeekSummaryTool({
        schoolId: ctx.schoolId,
        route: ctx.route ?? null,
      }),
  },
  student_risk_summary: {
    key: "student_risk_summary",
    family: "student",
    run: (ctx) =>
      runStudentRiskSummaryTool({
        schoolId: ctx.schoolId,
        route: ctx.route ?? null,
      }),
  },
  fees_overdue_summary: {
    key: "fees_overdue_summary",
    family: "finance",
    cacheTtlSeconds: 180,
    run: (ctx) => runFeesOverdueSummaryTool({ schoolId: ctx.schoolId }),
  },
  report_brief: {
    key: "report_brief",
    family: "reports",
    run: (ctx) => runReportBriefTool({ schoolId: ctx.schoolId }),
  },
  settings_change_impact: {
    key: "settings_change_impact",
    family: "settings",
    run: (ctx) =>
      runSettingsChangeImpactTool({
        schoolId: ctx.schoolId,
        userMessage: ctx.userMessage,
      }),
  },
};

export function getLeoTool(toolKey: LeoToolKey) {
  return LEO_TOOL_REGISTRY[toolKey];
}

export function executeLeoTool(
  toolKey: LeoToolKey,
  ctx: LeoToolExecutionContext
): Promise<LeoAssistantDraft> {
  const tool = getLeoTool(toolKey);
  return withLeoResponseCache(
    {
      schoolId: ctx.schoolId,
      toolKey,
      route: ctx.route ?? null,
      userMessage: ctx.userMessage,
      ttlSeconds: tool.cacheTtlSeconds,
    },
    () => tool.run(ctx)
  );
}
