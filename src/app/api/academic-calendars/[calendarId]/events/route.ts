import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { canEditCalendar } from "@/lib/academic-calendar/permissions";
import { expandRecurringEvent, clampRange, getRangeDefaults } from "@/lib/academic-calendar/recurrence";
import { DEFAULT_AUDIENCE_ROLES } from "@/lib/academic-calendar/types";
import { resolveEditorIds } from "@/lib/academic-calendar/editors";

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  academicPeriodId: z.string().optional().nullable(),
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
      scope: z.enum(["school", "grades", "classes", "specific_users"]).optional(),
      gradeIds: z.array(z.string()).optional(),
      classGroupIds: z.array(z.string()).optional(),
      userIds: z.array(z.string()).optional(),
      roles: z.array(z.string()).optional(),
    })
    .optional(),
  recurrence: z
    .object({
      frequency: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
      // Mongo/JSON round-trip sends null for unused numeric/array recurrence fields
      interval: z.number().min(1).max(365).nullish(),
      byWeekday: z.array(z.number().min(0).max(6)).nullish(),
      byMonthDay: z.array(z.number().min(1).max(31)).nullish(),
      until: z.coerce.date().nullish(),
      count: z.number().min(1).max(500).nullish(),
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

function normalizeAcademicPeriodId(value: string | null | undefined) {
  if (!value || value === "none") return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

async function resolveEventAcademicPeriodId({
  schoolId,
  requestedPeriodId,
  fallbackPeriodId,
}: {
  schoolId: mongoose.Types.ObjectId | string;
  requestedPeriodId?: string | null;
  fallbackPeriodId?: mongoose.Types.ObjectId | string | null;
}) {
  const requested = normalizeAcademicPeriodId(requestedPeriodId);
  if (requested) {
    const period = await AcademicPeriod.findOne({ _id: requested, schoolId }).lean();
    return period ? requested : null;
  }

  if (fallbackPeriodId && mongoose.Types.ObjectId.isValid(String(fallbackPeriodId))) {
    return new mongoose.Types.ObjectId(String(fallbackPeriodId));
  }

  const currentPeriod = await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  }).lean();

  return currentPeriod ? currentPeriod._id : null;
}

async function clipRecurrenceToPeriod({
  recurrence,
  schoolId,
  academicPeriodId,
}: {
  recurrence: z.infer<typeof eventSchema>["recurrence"];
  schoolId: mongoose.Types.ObjectId | string;
  academicPeriodId: mongoose.Types.ObjectId | null;
}) {
  if (!recurrence || recurrence.frequency === "none" || !academicPeriodId) {
    return recurrence;
  }

  const period = await AcademicPeriod.findOne({
    _id: academicPeriodId,
    schoolId,
  }).lean();

  if (!period) return recurrence;

  const periodEnd = new Date(period.endDate);
  const requestedUntil = recurrence.until ? new Date(recurrence.until) : null;

  if (!requestedUntil || requestedUntil > periodEnd) {
    return {
      ...recurrence,
      until: periodEnd,
    };
  }

  return recurrence;
}

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
  const academicPeriodId = normalizeAcademicPeriodId(
    url.searchParams.get("academicPeriodId")
  );

  const eventQuery: Record<string, unknown> = {
    schoolId: context.schoolId,
    calendarId: calendarObjId,
  };

  if (academicPeriodId) {
    eventQuery.academicPeriodId = academicPeriodId;
  }

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
        academicPeriodId: event.academicPeriodId ? String(event.academicPeriodId) : null,
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
        recurrence: event.recurrence
          ? {
              ...event.recurrence,
              until: event.recurrence.until
                ? new Date(event.recurrence.until).toISOString()
                : undefined,
            }
          : null,
      },
      range.start,
      range.end
    );

    return expanded.map((occurrence) => ({
      id: `${event._id}:${occurrence.start.toISOString()}`,
      eventId: String(event._id),
      calendarId: String(event.calendarId),
      academicPeriodId: event.academicPeriodId ? String(event.academicPeriodId) : null,
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
          userIds: (event.audience?.userIds || []).map((id) => String(id)),
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
  const academicPeriodId = await resolveEventAcademicPeriodId({
    schoolId: context.schoolId,
    requestedPeriodId: parsed.data.academicPeriodId,
    fallbackPeriodId: calendar.academicPeriodId,
  });
  const recurrence = await clipRecurrenceToPeriod({
    recurrence: parsed.data.recurrence,
    schoolId: context.schoolId,
    academicPeriodId,
  });

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
    academicPeriodId,
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
      userIds: (parsed.data.audience?.userIds || []).map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
      roles: audienceRoles,
    },
    recurrence: recurrence
      ? {
          ...recurrence,
          until: recurrence.until
            ? new Date(recurrence.until)
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
