import "server-only";
import type { Types } from "mongoose";
import { getSchoolSetupReadiness } from "@/lib/admin/school-setup-readiness";
import type { LeoAssistantDraft } from "@/lib/leo/types";

function priorityLabel(priority: string) {
  if (priority === "blocking") return "Blocking";
  if (priority === "high") return "High priority";
  return "Next";
}

export async function runSetupReadinessSummaryTool(args: {
  schoolId: Types.ObjectId;
}): Promise<LeoAssistantDraft> {
  const readiness = await getSchoolSetupReadiness(args.schoolId);
  const incomplete = readiness.items.filter((item) => !item.done);
  const complete = readiness.items.filter((item) => item.done);
  const top = incomplete.slice(0, 4);

  const lines = [
    `Your school setup is ${readiness.completionPercent}% complete (${complete.length}/${readiness.items.length} checklist items done).`,
    "",
    readiness.coachMessage,
  ];

  if (top.length > 0) {
    lines.push("", "Most important remaining items:");
    for (const item of top) {
      lines.push(
        `- ${priorityLabel(item.priority)}: ${item.title}. ${item.description} Fix here: ${item.href}`
      );
    }
  } else {
    lines.push("", "All core setup blockers are complete. Keep an eye on policy changes and term updates.");
  }

  return {
    contentText: lines.join("\n"),
    citations: [
      {
        type: "record",
        label: "School setup readiness checklist",
        ref: "src/lib/admin/school-setup-readiness.ts",
      },
      {
        type: "route",
        label: "Admin dashboard setup checklist",
        ref: "/admin",
      },
    ],
    toolsUsed: ["setup_readiness_summary"],
  };
}
