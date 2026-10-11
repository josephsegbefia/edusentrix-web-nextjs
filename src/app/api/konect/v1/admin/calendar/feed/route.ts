import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { expandRecurringEvent } from "@/lib/academic-calendar/recurrence";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calendarId: z.string().optional(),
  academicPeriodId: z.string().optional(),
  status: z.enum(["draft", "published", "cancelled", "all"]).default("published"),
  eventType: z.string().optional(),
});

function dateAtUtcStart(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid calendar range." }, { status: 400 });
  const from = dateAtUtcStart(parsed.data.from);
  const toDate = dateAtUtcStart(parsed.data.to);
  if (!from || !toDate || from > toDate) return NextResponse.json({ success: false, error: "Invalid calendar range." }, { status: 400 });
  if (toDate.getTime() - from.getTime() > 62 * 86400000) return NextResponse.json({ success: false, error: "Calendar range is limited to 62 days." }, { status: 400 });
  await connectToDatabase();

  const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
  const school = await School.findById(schoolIdObj).select("timeZone").lean();
  const timezone = school?.timeZone || "Africa/Accra";
  const calendarQuery: Record<string, unknown> = { schoolId: schoolIdObj };
  if (parsed.data.calendarId) {
    if (!mongoose.Types.ObjectId.isValid(parsed.data.calendarId)) return NextResponse.json({ success: false, error: "Invalid calendar id." }, { status: 400 });
    calendarQuery._id = parsed.data.calendarId;
  }
  if (parsed.data.academicPeriodId) {
    if (!mongoose.Types.ObjectId.isValid(parsed.data.academicPeriodId)) return NextResponse.json({ success: false, error: "Invalid academic period id." }, { status: 400 });
    calendarQuery.academicPeriodId = parsed.data.academicPeriodId;
  }
  const calendars = await AcademicCalendar.find(calendarQuery).select("_id name color isPublished academicPeriodId").lean();
  const calendarIds = calendars.map((calendar) => calendar._id);
  const eventQuery: Record<string, unknown> = { schoolId: schoolIdObj, calendarId: { $in: calendarIds } };
  if (parsed.data.status !== "all") eventQuery.status = parsed.data.status;
  if (parsed.data.eventType) eventQuery.eventType = parsed.data.eventType;
  const events = await AcademicCalendarEvent.find({
    ...eventQuery,
    $or: [
      { recurrence: null, startDate: { $lte: new Date(toDate.getTime() + 86399999) }, endDate: { $gte: from } },
      { recurrence: { $ne: null } },
    ],
  }).sort({ startDate: 1 }).limit(500).lean();
  const calendarById = new Map(calendars.map((calendar) => [String(calendar._id), calendar]));
  const rows = events.map((event) => {
    const occurrenceSource = {
      _id: String(event._id), calendarId: String(event.calendarId), title: event.title,
      startDate: new Date(event.startDate), endDate: new Date(event.endDate), allDay: event.allDay,
      status: event.status, eventType: event.eventType, isNonTeachingDay: event.isNonTeachingDay,
      location: event.location, color: event.color, recurrence: event.recurrence ? { ...event.recurrence, until: event.recurrence.until?.toISOString() } : null,
    };
    const occurrences = expandRecurringEvent(occurrenceSource, from, new Date(toDate.getTime() + 86399999));
    const calendar = calendarById.get(String(event.calendarId));
    return {
      id: String(event._id), calendarId: String(event.calendarId), academicPeriodId: event.academicPeriodId ? String(event.academicPeriodId) : null,
      title: event.title, description: event.description || null, startDate: event.startDate.toISOString(), endDate: event.endDate.toISOString(),
      allDay: event.allDay, location: event.location || null, status: event.status, eventType: event.eventType,
      isNonTeachingDay: event.isNonTeachingDay, audienceScope: event.audience?.scope || "school", recurrence: event.recurrence || null,
      calendar: { name: calendar?.name || "Calendar", color: calendar?.color || null },
      occurrences: occurrences.map((occurrence) => ({ startDate: occurrence.start.toISOString(), endDate: occurrence.end.toISOString(), isRecurring: occurrence.isRecurring })),
    };
  });
  const periodIds = rows.map((row) => row.academicPeriodId).filter((id): id is string => Boolean(id));
  const periods = await AcademicPeriod.find({ _id: { $in: periodIds }, schoolId: schoolIdObj }).select("_id term yearLabel startDate endDate").lean();
  const periodById = new Map(periods.map((period) => [String(period._id), period]));
  const inRangeRows = rows.filter((row) => row.occurrences.length > 0);
  return NextResponse.json({ success: true, data: { timezone, range: { from: parsed.data.from, to: parsed.data.to }, periods: periods.map((period) => ({ id: String(period._id), term: period.term, yearLabel: period.yearLabel, startDate: period.startDate.toISOString(), endDate: period.endDate.toISOString() })), events: inRangeRows.map((row) => ({ ...row, academicPeriod: row.academicPeriodId ? periodById.get(row.academicPeriodId) || null : null })) } });
}
