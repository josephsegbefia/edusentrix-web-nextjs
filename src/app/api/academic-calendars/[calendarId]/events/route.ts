import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { canEditCalendar } from "@/lib/academic-calendar/permissions";
import { expandRecurringEvent, clampRange, getRangeDefaults } from "@/lib/academic-calendar/recurrence";
import { DEFAULT_AUDIENCE_ROLES } from "@/lib/academic-calendar/types";
import { resolveEditorIds } from "@/lib/academic-calendar/editors";

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  allDay: z.boolean().optional(),
  location: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  status: z.enum(["draft", "published", "cancelled"]).optional(),
  eventType: z
    .enum([
      "academic",
      "exam",
      "holiday",
      "sports",
      "meeting",
      "activity",
      "non_teaching_day",
      "custom",
    ])
    .optional(),
  isNonTeachingDay: z.boolean().optional(),
  audience: z
    .object({
      scope: z.enum(["school", "grades", "classes"]).optional(),
      gradeIds: z.array(z.string()).optional(),
      classGroupIds: z.array(z.string()).optional(),
      roles: z.array(z.string()).optional(),
    })
    .optional(),
  recurrence: z
    .object({
      frequency: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
      interval: z.number().min(1).max(365).optional(),
      byWeekday: z.array(z.number().min(0).max(6)).optional(),
      byMonthDay: z.array(z.number().min(1).max(31)).optional(),
      until: z.coerce.date().optional().nullable(),
      count: z.number().min(1).max(500).optional(),
    })
    .optional()
    .nullable(),
  editorScope: z.enum(["calendar", "event"]).optional(),
  editorIds: z.array(z.string()).optional(),
  reminders: z
    .array(
      z.object({
        minutesBefore: z.number().min(0),
        channel: z.enum(["in_app"]).optional(),
      })
    )
    .optional(),
});

function parseDateParam(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ calendarId: string }> }
) {
  const context = await requireSchoolMember({ allowedRoles: ["teacher", "bursar"] });
  await connectToDatabase();

  const { calendarId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(calendarId)) {
    return NextResponse.json({ error: "Invalid calendar ID" }, { status: 400 });
  }

  const calendarObjId = new mongoose.Types.ObjectId(calendarId);
  const calendar = await AcademicCalendar.findOne({
    _id: calendarObjId,
    schoolId: context.schoolId,
  }).lean();

  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const canEdit = canEditCalendar({
    userId: context.userId,
    roles: context.roles,
    isAdmin: context.isAdmin,
    calendar: calendar,
  });

  if (!canEdit) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = parseDateParam(url.searchParams.get("from"));
  const to = parseDateParam(url.searchParams.get("to"));

  const defaults = getRangeDefaults();
  const range = clampRange(from || defaults.start, to || defaults.end);

  const includeDraft = url.searchParams.get("publishedOnly") !== "1";

  const eventQuery: Record<string, unknown> = {
    schoolId: context.schoolId,
    calendarId: calendarObjId,
  };

  if (!includeDraft) {
    eventQuery.status = "published";
  }

  const events = await AcademicCalendarEvent.find(eventQuery)
    .sort({ startDate: 1 })
    .lean();

  const occurrences = events.flatMap((event) => {
    const expanded = expandRecurringEvent(
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
      range.start,
      range.end
    );

    return expanded.map((occurrence) => ({
      id: `${event._id}:${occurrence.start.toISOString()}`,
      eventId: String(event._id),
      calendarId: String(event.calendarId),
      title: event.title,
      startDate: occurrence.start.toISOString(),
      endDate: occurrence.end.toISOString(),
      allDay: event.allDay,
      location: event.location || null,
      color: event.color || null,
      status: event.status,
      eventType: event.eventType,
      isNonTeachingDay: event.isNonTeachingDay,
      coverImageUrl: event.coverImageUrl || null,
      isRecurring: occurrence.isRecurring,
    }));
  });

  return NextResponse.json({
    success: true,
    data: {
      calendar: {
        id: String(calendar._id),
        name: calendar.name,
        isPublished: calendar.isPublished,
        color: calendar.color || null,
      },
      events: events.map((event) => ({
        id: String(event._id),
        title: event.title,
        description: event.description || null,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        allDay: event.allDay,
        location: event.location || null,
        color: event.color || null,
        coverImageUrl: event.coverImageUrl || null,
        status: event.status,
        eventType: event.eventType,
        isNonTeachingDay: event.isNonTeachingDay,
        audience: {
          scope: event.audience?.scope || "school",
          gradeIds: (event.audience?.gradeIds || []).map((id) => String(id)),
          classGroupIds: (event.audience?.classGroupIds || []).map((id) => String(id)),
          roles: event.audience?.roles && event.audience.roles.length > 0
            ? event.audience.roles
            : [...DEFAULT_AUDIENCE_ROLES],
        },
        recurrence: event.recurrence
          ? {
              ...event.recurrence,
              until: event.recurrence.until
                ? new Date(event.recurrence.until).toISOString()
                : null,
            }
          : null,
        editorScope: event.editorScope,
        editorIds: (event.editorIds || []).map((id) => String(id)),
        reminders: event.reminders || [],
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      })),
      occurrences,
      range: {
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      },
    },
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ calendarId: string }> }
) {
  const context = await requireSchoolMember({ allowedRoles: ["teacher", "bursar"] });
  await connectToDatabase();

  const { calendarId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(calendarId)) {
    return NextResponse.json({ error: "Invalid calendar ID" }, { status: 400 });
  }

  const calendarObjId = new mongoose.Types.ObjectId(calendarId);
  const calendar = await AcademicCalendar.findOne({
    _id: calendarObjId,
    schoolId: context.schoolId,
  }).lean();

  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const canEdit = canEditCalendar({
    userId: context.userId,
    roles: context.roles,
    isAdmin: context.isAdmin,
    calendar,
  });

  if (!canEdit) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be after start date" },
      { status: 400 }
    );
  }

  const isNonTeachingDay = parsed.data.eventType === "non_teaching_day" || parsed.data.isNonTeachingDay;
  const allDay = parsed.data.allDay ?? isNonTeachingDay ?? false;

  const audienceRoles =
    parsed.data.audience?.roles && parsed.data.audience.roles.length > 0
      ? parsed.data.audience.roles
      : [...DEFAULT_AUDIENCE_ROLES];

  const editorScope = context.isAdmin ? parsed.data.editorScope || "calendar" : "calendar";
  const editorIds =
    context.isAdmin && editorScope === "event"
      ? await resolveEditorIds({
          schoolId: context.schoolId as mongoose.Types.ObjectId,
          editorIds: parsed.data.editorIds || [],
        })
      : [];

  const doc = await AcademicCalendarEvent.create({
    schoolId: context.schoolId,
    calendarId: calendarObjId,
    academicPeriodId: calendar.academicPeriodId || null,
    title: parsed.data.title.trim(),
    description: parsed.data.description?.trim() || null,
    startDate,
    endDate,
    allDay,
    location: parsed.data.location?.trim() || null,
    color: parsed.data.color || null,
    coverImageUrl: parsed.data.coverImageUrl || null,
    status: parsed.data.status || "draft",
    eventType: parsed.data.eventType || "academic",
    isNonTeachingDay: Boolean(isNonTeachingDay),
    audience: {
      scope: parsed.data.audience?.scope || "school",
      gradeIds: (parsed.data.audience?.gradeIds || []).map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
      classGroupIds: (parsed.data.audience?.classGroupIds || []).map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
      roles: audienceRoles,
    },
    recurrence: parsed.data.recurrence
      ? {
          ...parsed.data.recurrence,
          until: parsed.data.recurrence.until
            ? new Date(parsed.data.recurrence.until)
            : null,
        }
      : null,
    editorScope,
    editorIds,
    reminders: parsed.data.reminders || [],
    createdBy: context.userId,
    updatedBy: context.userId,
  });

  return NextResponse.json({
    success: true,
    data: { id: String(doc._id) },
  }, { status: 201 });
}
