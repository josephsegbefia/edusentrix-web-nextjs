export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { expandRecurringEvent, addMinutesSafe } from "@/lib/academic-calendar/recurrence";
import { resolveAudienceRecipients } from "@/lib/academic-calendar/recipients";
import { createCalendarReminderNotification } from "@/lib/academic-calendar/notifications";

function parsePositiveInt(value: string | null, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-key");
  if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const url = new URL(req.url);
  const windowMinutes = parsePositiveInt(url.searchParams.get("windowMinutes"), 10);
  const lookaheadDays = parsePositiveInt(url.searchParams.get("lookaheadDays"), 30);
  const limit = Math.min(parsePositiveInt(url.searchParams.get("limit"), 200), 500);

  const now = new Date();
  const lookaheadEnd = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  const events = await AcademicCalendarEvent.find({
    status: "published",
    reminders: { $exists: true, $not: { $size: 0 } },
    startDate: { $lte: lookaheadEnd },
  })
    .sort({ startDate: 1 })
    .limit(limit)
    .lean();

  if (events.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, notificationsCreated: 0 });
  }

  const calendarIds = Array.from(
    new Set(events.map((e) => String((e as any).calendarId)))
  ).map((id) => new mongoose.Types.ObjectId(id));

  const calendars = await AcademicCalendar.find({
    _id: { $in: calendarIds },
    isPublished: true,
  })
    .select("_id schoolId")
    .lean();

  const calendarMap = new Map(
    calendars.map((c) => [String(c._id), c])
  );

  let notificationsCreated = 0;
  let processed = 0;

  const windowStart = addMinutesSafe(now, -windowMinutes);
  const windowEnd = addMinutesSafe(now, windowMinutes);

  for (const event of events) {
    const calendar = calendarMap.get(String(event.calendarId));
    if (!calendar) continue;

    processed += 1;

    const reminders = (event.reminders || [])
      .map((r: any) => ({
        minutesBefore: typeof r.minutesBefore === "number" ? r.minutesBefore : 0,
      }))
      .filter((r) => r.minutesBefore >= 0);

    if (reminders.length === 0) continue;

    const maxMinutesBefore = Math.min(
      Math.max(...reminders.map((r) => r.minutesBefore), 0),
      lookaheadDays * 24 * 60
    );

    const rangeStart = addMinutesSafe(now, -windowMinutes);
    const rangeEnd = addMinutesSafe(now, maxMinutesBefore + windowMinutes);

    const occurrences = expandRecurringEvent(
      {
        _id: String(event._id),
        calendarId: String(event.calendarId),
        title: event.title,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        allDay: event.allDay,
        status: event.status,
        eventType: event.eventType,
        isNonTeachingDay: event.isNonTeachingDay,
        location: event.location,
        color: event.color,
        coverImageUrl: event.coverImageUrl,
        recurrence: event.recurrence || null,
      },
      rangeStart,
      rangeEnd
    );

    if (occurrences.length === 0) continue;

    const audience = {
      scope: event.audience?.scope || "school",
      gradeIds: (event.audience?.gradeIds || []).map((id: any) => String(id)),
      classGroupIds: (event.audience?.classGroupIds || []).map((id: any) => String(id)),
      roles: event.audience?.roles || [],
    };

    const recipients = await resolveAudienceRecipients({
      schoolId: calendar.schoolId as mongoose.Types.ObjectId,
      audience,
      academicPeriodId: event.academicPeriodId
        ? new mongoose.Types.ObjectId(String(event.academicPeriodId))
        : null,
    });

    if (recipients.length === 0) continue;

    for (const occurrence of occurrences) {
      for (const reminder of reminders) {
        const reminderAt = addMinutesSafe(occurrence.start, -reminder.minutesBefore);
        if (reminderAt < windowStart || reminderAt > windowEnd) continue;

        const formatted = formatDateTime(occurrence.start);
        const title = `Upcoming: ${event.title}`;
        const body = event.location
          ? `${formatted} · ${event.location}`
          : `${formatted}`;

        for (const recipient of recipients) {
          const actionUrl = recipient.role === "parent"
            ? "/parent/calendar"
            : "/teacher/calendar";

          const created = await createCalendarReminderNotification({
            schoolId: calendar.schoolId as mongoose.Types.ObjectId,
            userId: recipient.userId,
            eventId: event._id as mongoose.Types.ObjectId,
            reminderAt,
            title,
            body,
            actionUrl,
            wardId: recipient.wardId || null,
            priority: reminder.minutesBefore <= 60 ? "high" : "normal",
          });

          if (created) notificationsCreated += 1;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    notificationsCreated,
  });
}
