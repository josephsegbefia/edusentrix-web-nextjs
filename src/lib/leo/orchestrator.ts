import "server-only";
import type { Types } from "mongoose";
import type { LeoAssistantDraft } from "@/lib/leo/types";
import { buildLeoPageContext } from "@/lib/leo/context-builder";
import { executeLeoTool } from "@/lib/leo/tool-registry";

function wantsSetupReadiness(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return [
    "setup",
    "readiness",
    "checklist",
    "onboarding",
    "dashboard",
    "blocker",
    "blockers",
    "what is left",
    "what's left",
  ].some((needle) => text.includes(needle));
}

function wantsClassTimetableStatus(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return (
    text.includes("/admin/classes/") &&
    [
      "timetable",
      "schedule",
      "publish",
      "conflict",
      "conflicts",
      "lesson",
      "lessons",
      "teacher missing",
      "missing teacher",
      "status",
      "blocker",
      "blockers",
    ].some((needle) => text.includes(needle))
  );
}

function wantsClassSubjectTeacherLinks(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return (
    text.includes("/admin/classes/") &&
    [
      "subject teacher",
      "subject-teacher",
      "teacher links",
      "teacher link",
      "assigned teacher",
      "assigned teachers",
      "missing teachers",
      "missing teacher",
      "co-teach",
      "co-teaching",
      "subject links",
      "subjects tab",
    ].some((needle) => text.includes(needle))
  );
}

function isClassTimetableIntent(message: string) {
  const text = message.toLowerCase();
  return [
    "timetable",
    "publish",
    "conflict",
    "conflicts",
    "lesson",
    "lessons",
    "status",
    "blocker",
    "blockers",
  ].some((needle) => text.includes(needle));
}

function wantsTeacherWeekSummary(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return (
    text.includes("/admin/teachers/") &&
    [
      "week",
      "weekly",
      "schedule",
      "agenda",
      "load",
      "lessons",
      "duties",
      "duty",
      "busy",
      "workload",
    ].some((needle) => text.includes(needle))
  );
}

function wantsTeacherAssignmentConflicts(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return (
    text.includes("/admin/teachers/") &&
    [
      "assignment conflict",
      "assignment conflicts",
      "conflict",
      "conflicts",
      "co-teach",
      "co-teaching",
      "duplicate assignment",
      "assigned already",
      "teacher assignment",
      "teaching assignment",
      "homeroom conflict",
      "subject mismatch",
    ].some((needle) => text.includes(needle))
  );
}

function canUseFinanceTools(role: string) {
  return ["school_admin", "bursar", "billing_owner"].includes(role);
}

function wantsFeesOverdueSummary(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return (
    [
      "/admin/finance",
      "/admin/fees",
      "/admin/overdue-report",
      "fee",
      "fees",
      "finance",
      "overdue",
      "outstanding",
      "defaulter",
      "defaulters",
      "collections",
      "collection",
      "invoice",
      "invoices",
    ].some((needle) => text.includes(needle)) &&
    ["overdue", "outstanding", "defaulter", "defaulters", "risk", "collections", "collection"].some(
      (needle) => text.includes(needle)
    )
  );
}

function wantsStudentRiskSummary(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return (
    text.includes("/admin/students/") &&
    [
      "risk",
      "at risk",
      "insight",
      "insights",
      "summary",
      "performance",
      "attendance",
      "academic",
      "weakness",
      "weaknesses",
      "strength",
      "strengths",
      "intervention",
      "support",
    ].some((needle) => text.includes(needle))
  );
}

function wantsReportBrief(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return (
    text.includes("/admin/reports") ||
    [
      "report brief",
      "reports brief",
      "executive brief",
      "executive summary",
      "school summary",
      "summarize reports",
      "report summary",
    ].some((needle) => text.includes(needle))
  );
}

function wantsSettingsChangeImpact(message: string, route?: string | null) {
  const text = `${message} ${route || ""}`.toLowerCase();
  return (
    text.includes("/admin/settings") ||
    [
      "settings impact",
      "setting impact",
      "what happens if",
      "if i change",
      "impact of changing",
      "change the setting",
      "late cutoff",
      "working days",
      "period duration",
      "school day",
      "attendance notifications",
      "teacher studio",
      "offline mode",
      "leo access",
    ].some((needle) => text.includes(needle))
  );
}

function wantsLibraryBookRecommendations(message: string) {
  const text = message.toLowerCase();
  const libraryHints = [
    "library",
    "book",
    "books",
    "reading list",
    "catalogue",
    "catalog",
  ];
  const hasLibrary = libraryHints.some((h) => text.includes(h));
  const hasGradeHint =
    text.includes("grade") ||
    text.includes("jhs") ||
    text.includes("shs") ||
    text.includes("form ") ||
    text.includes("class ") ||
    /\b[a-f\d]{24}\b/i.test(message);
  return hasLibrary && hasGradeHint;
}

function normalizeInput(input: string) {
  return input.trim().toLowerCase().replace(/[!.?]+$/g, "").replace(/\s+/g, " ");
}

function isGreeting(input: string) {
  const text = normalizeInput(input);
  return [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
    "yo",
  ].includes(text);
}

function wantsHelp(input: string) {
  const text = normalizeInput(input);
  return [
    "help",
    "what can you do",
    "what can you help me with",
    "what do you do",
    "how can you help",
    "what can leo do",
    "show me what you can do",
    "what should i ask",
  ].some((needle) => text.includes(needle));
}

function wantsInvestigate(input: string) {
  const text = normalizeInput(input);
  return [
    "investigate",
    "investigation",
    "deep dive",
    "look into",
    "trace this",
    "find the root cause",
  ].some((needle) => text.includes(needle));
}

function routeAwareHelp(route?: string | null) {
  if (route?.includes("/admin/classes/")) {
    return [
      "For this class, try asking:",
      "- What is the timetable status for this class?",
      "- Which subjects are missing teachers?",
      "- Are there subject-teacher link issues?",
    ];
  }
  if (route?.includes("/admin/teachers/")) {
    return [
      "For this teacher, try asking:",
      "- Summarize this teacher's week.",
      "- Are there assignment conflicts for this teacher?",
      "- How busy is this teacher?",
    ];
  }
  if (route?.includes("/admin/students/")) {
    return [
      "For this student, try asking:",
      "- Summarize this student's risk profile.",
      "- What subjects need support?",
      "- How are attendance and fees affecting this student?",
    ];
  }
  if (
    route?.includes("/admin/finance") ||
    route?.includes("/admin/fees") ||
    route?.includes("/admin/overdue-report")
  ) {
    return [
      "For finance, try asking:",
      "- Summarize overdue fees.",
      "- Who are the highest-risk defaulters?",
      "- Break down outstanding fees by age.",
    ];
  }
  if (route?.includes("/admin/reports")) {
    return [
      "For reports, try asking:",
      "- Give me an executive report brief.",
      "- What are the key report flags?",
      "- Summarize school performance for the current period.",
    ];
  }
  if (route?.includes("/admin/settings")) {
    return [
      "For settings, try asking:",
      "- What happens if I change working days?",
      "- What is the impact of changing the late cutoff?",
      "- How does Leo access affect users?",
    ];
  }
  return [
    "I can help with read-only admin questions like:",
    "- What setup items are still blocking us?",
    "- Summarize overdue fees.",
    "- Give me an executive report brief.",
    "- Explain a class timetable or subject-teacher issue.",
    "- Summarize a teacher's week or a student's risk profile.",
  ];
}

function helpReply(route?: string | null): LeoAssistantDraft {
  return {
    contentText: [
      "I can help you understand what is happening in the school without changing anything yet.",
      "",
      ...routeAwareHelp(route),
      "",
      "I currently give cited summaries and explanations. I do not yet send messages, publish timetables, or update records.",
    ].join("\n"),
    citations: [
      {
        type: "route",
        label: "Leo Copilot Roadmap",
        ref: "docs/LEO_COPILOT_ROADMAP.md",
      },
    ],
    toolsUsed: [],
  };
}

function greetingReply(route?: string | null): LeoAssistantDraft {
  return {
    contentText: [
      "Hello, I’m Leo.",
      "",
      "I can help summarize school setup, timetables, teacher workload, student risk, overdue fees, reports, and settings impact.",
      "",
      ...routeAwareHelp(route),
    ].join("\n"),
    citations: [
      {
        type: "route",
        label: "Leo Copilot Roadmap",
        ref: "docs/LEO_COPILOT_ROADMAP.md",
      },
    ],
    toolsUsed: [],
  };
}

function naturalFallbackReply(input: string, route?: string | null): LeoAssistantDraft {
  const trimmed = input.trim();
  return {
    contentText: [
      "I can help with that if you point me to one of the areas I can currently read.",
      "",
      ...routeAwareHelp(route),
      "",
      trimmed
        ? `I heard: "${trimmed.slice(0, 220)}${trimmed.length > 220 ? "..." : ""}"`
        : "",
      "Try asking the same thing with a page or topic, for example “summarize this student’s risk” or “show overdue fee risks.”",
    ]
      .filter(Boolean)
      .join("\n"),
    citations: [
      {
        type: "route",
        label: "Leo Copilot Roadmap",
        ref: "docs/LEO_COPILOT_ROADMAP.md",
      },
    ],
    toolsUsed: [],
  };
}

function investigateUnavailableReply(route?: string | null): LeoAssistantDraft {
  return {
    contentText: [
      "Investigate mode is not enabled yet.",
      "",
      "For now, I can still explain what I can read on this page and return cited summaries without changing records.",
      "",
      ...routeAwareHelp(route),
    ].join("\n"),
    citations: [
      {
        type: "route",
        label: "Leo Copilot Roadmap",
        ref: "docs/LEO_COPILOT_ROADMAP.md",
      },
    ],
    toolsUsed: [],
  };
}

export async function draftLeoAssistantResponse(args: {
  schoolId: Types.ObjectId;
  role: string;
  userMessage: string;
  pageContextSnapshot?: Record<string, unknown> | null;
}): Promise<LeoAssistantDraft> {
  const pageContext = buildLeoPageContext(args.pageContextSnapshot);
  const route = pageContext.route;

  if (isGreeting(args.userMessage)) {
    return greetingReply(route);
  }

  if (wantsHelp(args.userMessage)) {
    return helpReply(route);
  }

  if (pageContext.mode === "investigate" || wantsInvestigate(args.userMessage)) {
    return investigateUnavailableReply(route);
  }

  if (args.role === "school_admin" && wantsClassSubjectTeacherLinks(args.userMessage, route)) {
    return executeLeoTool("class_subject_teacher_links", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (
    args.role === "school_admin" &&
    wantsClassTimetableStatus(args.userMessage, route) &&
    !wantsClassSubjectTeacherLinks(args.userMessage, route)
  ) {
    return executeLeoTool("class_timetable_status", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (args.role === "school_admin" && wantsTeacherAssignmentConflicts(args.userMessage, route)) {
    return executeLeoTool("teacher_assignment_conflicts", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (args.role === "school_admin" && wantsTeacherWeekSummary(args.userMessage, route)) {
    return executeLeoTool("teacher_week_summary", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (args.role === "school_admin" && wantsStudentRiskSummary(args.userMessage, route)) {
    return executeLeoTool("student_risk_summary", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (canUseFinanceTools(args.role) && wantsFeesOverdueSummary(args.userMessage, route)) {
    return executeLeoTool("fees_overdue_summary", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (args.role === "school_admin" && wantsReportBrief(args.userMessage, route)) {
    return executeLeoTool("report_brief", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (args.role === "school_admin" && wantsSettingsChangeImpact(args.userMessage, route)) {
    return executeLeoTool("settings_change_impact", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (
    args.role === "school_admin" &&
    typeof route === "string" &&
    route.includes("/admin/classes/") &&
    !isClassTimetableIntent(args.userMessage)
  ) {
    return executeLeoTool("class_subject_teacher_links", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (args.role === "school_admin" && wantsSetupReadiness(args.userMessage, route)) {
    return executeLeoTool("setup_readiness_summary", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  if (
    (args.role === "school_admin" || args.role === "teacher") &&
    wantsLibraryBookRecommendations(args.userMessage)
  ) {
    return executeLeoTool("library_recommend_books", {
      schoolId: args.schoolId,
      route,
      userMessage: args.userMessage,
    });
  }

  return naturalFallbackReply(args.userMessage, route);
}
