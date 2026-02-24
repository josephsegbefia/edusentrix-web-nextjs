import mongoose from "mongoose";
import { Teacher } from "@/models/Teacher";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { createTeacherNotification } from "@/lib/teachers/teacherNotifications";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sanitizeReminderOffsets(offsets?: number[]) {
  const source = Array.isArray(offsets) ? offsets : [2, 1];
  const normalized = source
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v >= 0 && v <= 30)
    .map((v) => Math.floor(v));
  return Array.from(new Set(normalized)).sort((a, b) => b - a);
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function runTeacherLeaveAutomation(args?: {
  schoolId?: mongoose.Types.ObjectId;
  reminderOffsets?: number[];
  now?: Date;
}) {
  const now = args?.now ? new Date(args.now) : new Date();
  const today = startOfDay(now);
  const reminderOffsets = sanitizeReminderOffsets(args?.reminderOffsets);

  const baseQuery: Record<string, unknown> = {
    status: "on_leave",
    leaveEndDate: { $ne: null },
  };

  if (args?.schoolId) {
    baseQuery.schoolId = args.schoolId;
  }

  let autoActivated = 0;
  let remindersCreated = 0;
  let remindersDeduped = 0;

  const expiredTeachers = await Teacher.find({
    ...baseQuery,
    leaveEndDate: { $lt: today },
  })
    .select("_id schoolId userId leaveEndDate")
    .lean();

  for (const teacher of expiredTeachers) {
    const teacherId = String(teacher._id);
    const leaveEndDate = teacher.leaveEndDate
      ? startOfDay(new Date(teacher.leaveEndDate))
      : null;

    const updateResult = await Teacher.updateOne(
      { _id: teacher._id, status: "on_leave" },
      {
        $set: {
          status: "active",
          terminationDate: null,
          leaveEndedAt: now,
          leaveEndedBy: null,
          leaveAutoActivatedAt: now,
        },
      }
    );

    if (updateResult.modifiedCount === 0) continue;
    autoActivated += 1;

    if (teacher.userId && teacher.schoolId && leaveEndDate) {
      await createTeacherNotification({
        schoolId: teacher.schoolId as mongoose.Types.ObjectId,
        userId: teacher.userId as mongoose.Types.ObjectId,
        type: "system",
        title: "Leave Period Ended",
        body: `Your leave period ended on ${formatDate(
          leaveEndDate
        )}. Your account is now active.`,
        actionUrl: "/teacher/notifications",
        priority: "normal",
        dedupeKey: `teacher.leave.auto-ended:${teacherId}:${leaveEndDate.toISOString()}`,
        metadata: {
          teacherId,
          event: "teacher.leave.auto_ended",
          leaveEndDate: leaveEndDate.toISOString(),
          autoActivatedAt: now.toISOString(),
        },
      });
    }

    if (teacher.schoolId) {
      await logTeacherActivity({
        teacherId,
        schoolId: teacher.schoolId,
        type: "leave.cancelled",
        title: "Leave auto-ended",
        description: leaveEndDate
          ? `Leave period ended on ${formatDate(
              leaveEndDate
            )}. Teacher was automatically reactivated.`
          : "Leave period ended. Teacher was automatically reactivated.",
        metadata: {
          leaveEndDate: leaveEndDate?.toISOString(),
          autoActivatedAt: now.toISOString(),
        },
      });
    }
  }

  if (reminderOffsets.length > 0) {
    const maxOffset = Math.max(...reminderOffsets);
    const reminderWindowEnd = new Date(today.getTime() + maxOffset * DAY_MS);

    const reminderCandidates = await Teacher.find({
      ...baseQuery,
      leaveEndDate: { $gte: today, $lte: reminderWindowEnd },
    })
      .select("_id schoolId userId leaveEndDate leaveReminderOffsetsSent")
      .lean();

    for (const teacher of reminderCandidates) {
      if (!teacher.leaveEndDate || !teacher.userId || !teacher.schoolId) continue;

      const leaveEndDate = startOfDay(new Date(teacher.leaveEndDate));
      const daysUntilEnd = Math.round(
        (leaveEndDate.getTime() - today.getTime()) / DAY_MS
      );

      if (!reminderOffsets.includes(daysUntilEnd)) continue;

      const alreadySent = Array.isArray(teacher.leaveReminderOffsetsSent)
        ? teacher.leaveReminderOffsetsSent.includes(daysUntilEnd)
        : false;
      if (alreadySent) continue;

      const dedupeKey = `teacher.leave.reminder:${String(
        teacher._id
      )}:${leaveEndDate.toISOString()}:${daysUntilEnd}`;

      const response = await createTeacherNotification({
        schoolId: teacher.schoolId as mongoose.Types.ObjectId,
        userId: teacher.userId as mongoose.Types.ObjectId,
        type: "reminder",
        title: "Leave Ending Soon",
        body:
          daysUntilEnd === 0
            ? `Your leave period ends today (${formatDate(leaveEndDate)}).`
            : daysUntilEnd === 1
            ? `Your leave period ends tomorrow (${formatDate(leaveEndDate)}).`
            : `Your leave period ends in ${daysUntilEnd} days (${formatDate(
                leaveEndDate
              )}).`,
        actionUrl: "/teacher/notifications",
        priority: daysUntilEnd <= 1 ? "high" : "normal",
        dedupeKey,
        metadata: {
          teacherId: String(teacher._id),
          event: "teacher.leave.approaching_end",
          leaveEndDate: leaveEndDate.toISOString(),
          daysUntilEnd,
        },
      });

      if (!response.created && !response.duplicate) continue;

      await Teacher.updateOne(
        { _id: teacher._id, status: "on_leave" },
        {
          $addToSet: { leaveReminderOffsetsSent: daysUntilEnd },
          $set: { leaveLastReminderAt: now },
        }
      );

      if (response.created) remindersCreated += 1;
      if (response.duplicate) remindersDeduped += 1;
    }
  }

  return {
    autoActivated,
    remindersCreated,
    remindersDeduped,
    reminderOffsets,
    asOf: now.toISOString(),
  };
}
