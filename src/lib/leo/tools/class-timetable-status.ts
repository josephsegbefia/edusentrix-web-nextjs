import "server-only";
import mongoose, { type Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { TimetableConflict } from "@/models/TimetableConflict";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import type { LeoAssistantDraft } from "@/lib/leo/types";

function extractClassIdFromRoute(route?: string | null): string | null {
  if (!route) return null;
  const match = route.match(/\/admin\/classes\/([a-fA-F0-9]{24})(?:\/|$|\?)/);
  return match?.[1] ?? null;
}

function formatSeverityCounts(errorCount: number, warningCount: number) {
  if (errorCount === 0 && warningCount === 0) {
    return "No open timetable conflicts are currently recorded for this class.";
  }
  const parts = [];
  if (errorCount > 0) parts.push(`${errorCount} error${errorCount === 1 ? "" : "s"}`);
  if (warningCount > 0) parts.push(`${warningCount} warning${warningCount === 1 ? "" : "s"}`);
  return `Open conflicts touching this class: ${parts.join(" and ")}.`;
}

export async function runClassTimetableStatusTool(args: {
  schoolId: Types.ObjectId;
  route?: string | null;
}): Promise<LeoAssistantDraft> {
  const classId = extractClassIdFromRoute(args.route);
  if (!classId) {
    return {
      contentText:
        "Open a specific class timetable first, then ask me again. I need the class page route so I can scope the timetable status safely.",
      citations: [{ type: "route", label: "Classes", ref: "/admin/classes" }],
      toolsUsed: ["class_timetable_status"],
    };
  }

  const classObjId = new mongoose.Types.ObjectId(classId);
  const [classGroup, currentPeriod] = await Promise.all([
    ClassGroup.findOne({ _id: classObjId, schoolId: args.schoolId })
      .select("name gradeId")
      .populate("gradeId", "name")
      .lean(),
    AcademicPeriod.findOne({ schoolId: args.schoolId, isCurrent: true })
      .select("_id yearLabel term")
      .lean(),
  ]);

  if (!classGroup) {
    return {
      contentText: "I could not find this class inside the current school.",
      citations: [{ type: "route", label: "Classes", ref: "/admin/classes" }],
      toolsUsed: ["class_timetable_status"],
    };
  }

  const gradeName =
    typeof classGroup.gradeId === "object" &&
    classGroup.gradeId !== null &&
    "name" in classGroup.gradeId
      ? String(classGroup.gradeId.name || "")
      : "";
  const classLabel = `${gradeName} ${classGroup.name || ""}`.trim() || "this class";

  if (!currentPeriod) {
    return {
      contentText: `I found ${classLabel}, but there is no current academic period. Set the current period before reviewing timetable readiness.`,
      citations: [
        { type: "record", label: "Class group", ref: `ClassGroup:${classId}` },
        { type: "route", label: "Academic periods", ref: "/admin/periods" },
      ],
      toolsUsed: ["class_timetable_status"],
    };
  }

  const version = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: currentPeriod._id,
    status: { $in: ["draft", "published"] },
  })
    .sort({ status: 1, updatedAt: -1 })
    .select("_id status publishedAt updatedAt")
    .lean();

  if (!version) {
    return {
      contentText: `No timetable version exists yet for ${classLabel} in ${currentPeriod.term} ${currentPeriod.yearLabel}. Start by adding lessons in the class timetable grid.`,
      citations: [
        { type: "record", label: "Class group", ref: `ClassGroup:${classId}` },
        { type: "route", label: "Class timetable", ref: `/admin/classes/${classId}?tab=schedule` },
      ],
      toolsUsed: ["class_timetable_status"],
    };
  }

  const slots = await TimetableSlot.find({
    versionId: version._id,
    schoolId: args.schoolId,
    classGroupId: classObjId,
  })
    .select("_id subjectId teacherId dayOfWeek startTime endTime")
    .lean();

  const slotIds = slots.map((slot) => slot._id);
  const conflicts =
    slotIds.length > 0
      ? await TimetableConflict.find({
          schoolId: args.schoolId,
          versionId: version._id,
          status: "open",
          slotIds: { $in: slotIds },
        })
          .select("code severity message")
          .limit(8)
          .lean()
      : [];

  const missingTeacherCount = slots.filter((slot) => !slot.teacherId).length;
  const subjectCount = new Set(slots.map((slot) => String(slot.subjectId || "")).filter(Boolean))
    .size;
  const errorCount = conflicts.filter((conflict) => conflict.severity === "error").length;
  const warningCount = conflicts.filter((conflict) => conflict.severity === "warning").length;

  const lines = [
    `${classLabel} has ${slots.length} lesson${slots.length === 1 ? "" : "s"} in the ${version.status} timetable for ${currentPeriod.term} ${currentPeriod.yearLabel}.`,
    `${subjectCount} subject${subjectCount === 1 ? "" : "s"} appear in this class timetable.`,
    missingTeacherCount > 0
      ? `${missingTeacherCount} lesson${missingTeacherCount === 1 ? "" : "s"} still need a teacher.`
      : "Every listed lesson has a teacher assigned.",
    formatSeverityCounts(errorCount, warningCount),
  ];

  if (conflicts.length > 0) {
    lines.push("", "Top open conflicts:");
    for (const conflict of conflicts.slice(0, 4)) {
      lines.push(`- ${conflict.code}: ${conflict.message}`);
    }
  }

  if (version.status !== "published") {
    lines.push("", "Safe next action: resolve any error conflicts and missing teachers before publishing.");
  }

  return {
    contentText: lines.join("\n"),
    citations: [
      { type: "record", label: "Class group", ref: `ClassGroup:${classId}` },
      { type: "record", label: "Timetable version", ref: `TimetableVersion:${String(version._id)}` },
      { type: "route", label: "Class timetable", ref: `/admin/classes/${classId}?tab=schedule` },
    ],
    toolsUsed: ["class_timetable_status"],
  };
}
