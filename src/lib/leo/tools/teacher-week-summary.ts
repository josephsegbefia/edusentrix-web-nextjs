import "server-only";
import mongoose, { type Types } from "mongoose";
import { buildTeacherWeekAgenda } from "@/lib/teacher/buildTeacherWeekAgenda";
import type { LeoAssistantDraft } from "@/lib/leo/types";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function extractTeacherIdFromRoute(route?: string | null): string | null {
  if (!route) return null;
  const match = route.match(/\/admin\/teachers\/([a-fA-F0-9]{24})(?:\/|$|\?)/);
  return match?.[1] ?? null;
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function teacherDisplayName(user: { firstName?: string; lastName?: string } | null) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "this teacher";
}

export async function runTeacherWeekSummaryTool(args: {
  schoolId: Types.ObjectId;
  route?: string | null;
  targetDate?: Date;
}): Promise<LeoAssistantDraft> {
  const teacherId = extractTeacherIdFromRoute(args.route);
  if (!teacherId) {
    return {
      contentText:
        "Open a teacher profile first, then ask me again. I need the teacher page route so I can summarize the correct weekly agenda.",
      citations: [{ type: "route", label: "Teachers", ref: "/admin/teachers" }],
      toolsUsed: ["teacher_week_summary"],
    };
  }

  const teacherObjId = new mongoose.Types.ObjectId(teacherId);
  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: args.schoolId,
  })
    .select("_id userId status")
    .lean();

  if (!teacher) {
    return {
      contentText: "I could not find this teacher inside the current school.",
      citations: [{ type: "route", label: "Teachers", ref: "/admin/teachers" }],
      toolsUsed: ["teacher_week_summary"],
    };
  }

  const user = await User.findById(teacher.userId).select("firstName lastName").lean();
  const name = teacherDisplayName(
    user as { firstName?: string; lastName?: string } | null
  );
  const agenda = await buildTeacherWeekAgenda({
    schoolId: args.schoolId,
    teacherId: teacherObjId,
    targetDate: args.targetDate || new Date(),
  });

  const lines = [
    `${name}'s week runs ${formatDateLabel(agenda.weekStart)} to ${formatDateLabel(agenda.weekEnd)}.`,
    `Total load: ${agenda.summary.lessonCount} lesson${agenda.summary.lessonCount === 1 ? "" : "s"} and ${agenda.summary.dutyCount} dut${agenda.summary.dutyCount === 1 ? "y" : "ies"}.`,
  ];

  if (agenda.boundaryState === "outside") {
    lines.push("This week is outside the active academic period, so lesson and duty coverage may be empty.");
  } else if (agenda.boundaryState === "partial") {
    lines.push("This week only partially overlaps the academic period.");
  }

  const busiestDays = agenda.days
    .filter((day) => day.totalCount > 0)
    .sort((left, right) => right.totalCount - left.totalCount)
    .slice(0, 3);

  if (busiestDays.length > 0) {
    lines.push("", "Busiest days:");
    for (const day of busiestDays) {
      lines.push(
        `- ${DAY_NAMES[day.dayOfWeek] || day.date}: ${day.lessonCount} lesson${day.lessonCount === 1 ? "" : "s"}, ${day.dutyCount} dut${day.dutyCount === 1 ? "y" : "ies"}`
      );
    }
  } else {
    lines.push("", "No lessons or duties are scheduled for the visible days in this week.");
  }

  const lessonSamples = agenda.lessons.slice(0, 4);
  if (lessonSamples.length > 0) {
    lines.push("", "Upcoming lessons:");
    for (const lesson of lessonSamples) {
      lines.push(
        `- ${DAY_NAMES[lesson.dayOfWeek] || lesson.date} ${lesson.startTime}-${lesson.endTime}: ${lesson.subjectName} with ${lesson.classLabel}`
      );
    }
  }

  const dutySamples = agenda.duties.slice(0, 3);
  if (dutySamples.length > 0) {
    lines.push("", "Duties:");
    for (const duty of dutySamples) {
      const location = duty.location ? ` at ${duty.location}` : "";
      lines.push(
        `- ${DAY_NAMES[duty.dayOfWeek] || duty.date} ${duty.startTime}-${duty.endTime}: ${duty.dutyName}${location}`
      );
    }
  }

  return {
    contentText: lines.join("\n"),
    citations: [
      { type: "record", label: "Teacher", ref: `Teacher:${teacherId}` },
      { type: "record", label: "Teacher week agenda", ref: "src/lib/teacher/buildTeacherWeekAgenda.ts" },
      { type: "route", label: "Teacher profile", ref: `/admin/teachers/${teacherId}` },
    ],
    toolsUsed: ["teacher_week_summary"],
  };
}
