import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { expandRecurringEvent } from "@/lib/academic-calendar/recurrence";
import type { CalendarRecurrence } from "@/lib/academic-calendar/types";

const RECURRING_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
const UPCOMING_WINDOW_DAYS = 30;
const UPCOMING_PREVIEW_LIMIT = 6;
const EVENT_QUERY_LIMIT = 1500;

type PeriodCard = {
  id: string;
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

type UpcomingOccurrence = {
  id: string;
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  eventType: string;
  color: string | null;
  isRecurring: boolean;
  status: string;
};

function toObjectId(value: unknown) {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function toPeriodCard(doc: {
  _id: mongoose.Types.ObjectId;
  yearLabel: string;
  term: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}): PeriodCard {
  return {
    id: String(doc._id),
    yearLabel: doc.yearLabel,
    term: doc.term,
    startDate: new Date(doc.startDate).toISOString(),
    endDate: new Date(doc.endDate).toISOString(),
    isCurrent: doc.isCurrent,
  };
}

export async function GET() {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj = toObjectId(schoolId);

    const now = new Date();
    const rangeStart = now;
    const rangeEnd = addDays(now, UPCOMING_WINDOW_DAYS);
    const next7Boundary = addDays(now, 7);

    const [currentPeriodRaw, calendarsCount, eventsConfigured] = await Promise.all([
      AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        isCurrent: true,
      })
        .sort({ startDate: -1 })
        .select("yearLabel term startDate endDate isCurrent")
        .lean(),
      AcademicCalendar.countDocuments({ schoolId: schoolIdObj }),
      AcademicCalendarEvent.countDocuments({
        schoolId: schoolIdObj,
        status: { $ne: "cancelled" },
      }),
    ]);

    const currentPeriod = Array.isArray(currentPeriodRaw)
      ? currentPeriodRaw[0]
      : currentPeriodRaw;

    let previousPeriodRaw: {
      _id: mongoose.Types.ObjectId;
      yearLabel: string;
      term: string;
      startDate: Date;
      endDate: Date;
      isCurrent: boolean;
    } | null = null;

    if (currentPeriod) {
      const baselineDate = new Date(currentPeriod.startDate);
      previousPeriodRaw = await AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        _id: { $ne: currentPeriod._id },
        endDate: { $lt: baselineDate },
      })
        .sort({ endDate: -1 })
        .select("yearLabel term startDate endDate isCurrent")
        .lean();
    } else {
      previousPeriodRaw = await AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        endDate: { $lt: now },
      })
        .sort({ endDate: -1 })
        .select("yearLabel term startDate endDate isCurrent")
        .lean();
    }

    const eventDocs = await AcademicCalendarEvent.find({
      schoolId: schoolIdObj,
      status: { $ne: "cancelled" },
      startDate: { $lte: rangeEnd },
      $or: [
        { endDate: { $gte: rangeStart } },
        { "recurrence.frequency": { $in: RECURRING_FREQUENCIES } },
      ],
    })
      .sort({ startDate: 1 })
      .limit(EVENT_QUERY_LIMIT)
      .select(
        "_id calendarId title startDate endDate allDay status eventType isNonTeachingDay location color coverImageUrl recurrence"
      )
      .lean();

    const occurrences: UpcomingOccurrence[] = eventDocs
      .flatMap((event) => {
        const recurrenceUntilRaw = event.recurrence
          ? (event.recurrence as { until?: Date | string | null }).until
          : null;
        const recurrenceUntil = recurrenceUntilRaw
          ? new Date(recurrenceUntilRaw).toISOString()
          : undefined;

        const expanded = expandRecurringEvent(
          {
            _id: String(event._id),
            calendarId: String(event.calendarId),
            title: event.title,
            startDate: new Date(event.startDate),
            endDate: new Date(event.endDate),
            allDay: Boolean(event.allDay),
            status: event.status,
            eventType: event.eventType,
            isNonTeachingDay: Boolean(event.isNonTeachingDay),
            location: event.location || null,
            color: event.color || null,
            coverImageUrl: event.coverImageUrl || null,
            recurrence: event.recurrence
              ? ({
                  ...event.recurrence,
                  until: recurrenceUntil,
                } as CalendarRecurrence)
              : null,
          },
          rangeStart,
          rangeEnd
        );

        return expanded.map((occurrence) => ({
          id: `${event._id}:${occurrence.start.toISOString()}`,
          eventId: String(event._id),
          title: event.title,
          startDate: occurrence.start.toISOString(),
          endDate: occurrence.end.toISOString(),
          allDay: Boolean(event.allDay),
          eventType: event.eventType,
          color: event.color || null,
          isRecurring: occurrence.isRecurring,
          status: event.status,
        }));
      })
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));

    const byTypeMap = new Map<string, number>();
    for (const occurrence of occurrences) {
      byTypeMap.set(
        occurrence.eventType,
        (byTypeMap.get(occurrence.eventType) || 0) + 1
      );
    }
    const byType = Array.from(byTypeMap.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count);

    const next7DaysCount = occurrences.filter(
      (occurrence) => new Date(occurrence.startDate) <= next7Boundary
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        currentPeriod: currentPeriod ? toPeriodCard(currentPeriod) : null,
        previousPeriod: previousPeriodRaw ? toPeriodCard(previousPeriodRaw) : null,
        upcoming: {
          rangeStart: rangeStart.toISOString(),
          rangeEnd: rangeEnd.toISOString(),
          days: UPCOMING_WINDOW_DAYS,
          totalCount: occurrences.length,
          next7DaysCount,
          byType,
          preview: occurrences.slice(0, UPCOMING_PREVIEW_LIMIT),
        },
        meta: {
          calendarsCount,
          eventsConfigured,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching period overview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch period overview" },
      { status: 500 }
    );
  }
}
