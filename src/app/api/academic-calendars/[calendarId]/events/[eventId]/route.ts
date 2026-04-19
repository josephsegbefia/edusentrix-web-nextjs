import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { canEditCalendar } from "@/lib/academic-calendar/permissions";
import { DEFAULT_AUDIENCE_ROLES } from "@/lib/academic-calendar/types";
import { resolveEditorIds } from "@/lib/academic-calendar/editors";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ calendarId: string; eventId: string }> }
) {
  const context = await requireSchoolMember({ allowedRoles: ["teacher", "bursar"] });
  await connectToDatabase();

  const { calendarId, eventId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(calendarId) || !mongoose.Types.ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: "Invalid calendar or event ID" }, { status: 400 });
  }

  const calendarObjId = new mongoose.Types.ObjectId(calendarId);
  const eventObjId = new mongoose.Types.ObjectId(eventId);

  const calendar = await AcademicCalendar.findOne({
    _id: calendarObjId,
    schoolId: context.schoolId,
  }).lean();

  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const event = await AcademicCalendarEvent.findOne({
    _id: eventObjId,
    calendarId: calendarObjId,
    schoolId: context.schoolId,
  }).lean();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const canEdit = canEditCalendar({
    userId: context.userId,
    roles: context.roles,
    isAdmin: context.isAdmin,
    calendar,
    event: {
      editorScope: event.editorScope,
      editorIds: event.editorIds,
    },
  });

  if (!canEdit) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    updatedBy: context.userId,
  };

  const startDate = parsed.data.startDate
    ? new Date(parsed.data.startDate)
    : event.startDate;
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : event.endDate;

  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be after start date" },
      { status: 400 }
    );
  }

  if (parsed.data.title !== undefined) update.title = parsed.data.title.trim();
  if (parsed.data.description !== undefined) {
    update.description = parsed.data.description?.trim() || null;
  }
  if (parsed.data.startDate !== undefined) update.startDate = startDate;
  if (parsed.data.endDate !== undefined) update.endDate = endDate;
  if (parsed.data.location !== undefined) {
    update.location = parsed.data.location?.trim() || null;
  }
  if (parsed.data.color !== undefined) update.color = parsed.data.color || null;
  if (parsed.data.coverImageUrl !== undefined) {
    update.coverImageUrl = parsed.data.coverImageUrl || null;
  }
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.eventType !== undefined) update.eventType = parsed.data.eventType;

  if (parsed.data.isNonTeachingDay !== undefined) {
    update.isNonTeachingDay = parsed.data.isNonTeachingDay;
  }

  const eventType = (parsed.data.eventType || event.eventType) as string;
  const isNonTeachingDay =
    parsed.data.isNonTeachingDay !== undefined
      ? parsed.data.isNonTeachingDay
      : event.isNonTeachingDay;
  const shouldAllDay =
    parsed.data.allDay !== undefined
      ? parsed.data.allDay
      : eventType === "non_teaching_day" || isNonTeachingDay
      ? true
      : event.allDay;
  update.allDay = shouldAllDay;

  if (parsed.data.audience !== undefined) {
    const audienceRoles =
      parsed.data.audience.roles && parsed.data.audience.roles.length > 0
        ? parsed.data.audience.roles
        : [...DEFAULT_AUDIENCE_ROLES];

    update.audience = {
      scope: parsed.data.audience.scope || event.audience?.scope || "school",
      gradeIds: (parsed.data.audience.gradeIds || event.audience?.gradeIds || []).map(
        (id) => new mongoose.Types.ObjectId(String(id))
      ),
      classGroupIds: (
        parsed.data.audience.classGroupIds || event.audience?.classGroupIds || []
      ).map((id) => new mongoose.Types.ObjectId(String(id))),
      userIds: (
        parsed.data.audience.userIds || event.audience?.userIds || []
      ).map((id) => new mongoose.Types.ObjectId(String(id))),
      roles: audienceRoles,
    };
  }

  if (parsed.data.recurrence !== undefined) {
    update.recurrence = parsed.data.recurrence
      ? {
          ...parsed.data.recurrence,
          until: parsed.data.recurrence.until
            ? new Date(parsed.data.recurrence.until)
            : null,
        }
      : null;
  }

  if (parsed.data.reminders !== undefined) {
    update.reminders = parsed.data.reminders || [];
  }

  if (context.isAdmin) {
    if (parsed.data.editorScope !== undefined) {
      update.editorScope = parsed.data.editorScope;
    }

    if (parsed.data.editorIds !== undefined) {
      update.editorIds = await resolveEditorIds({
        schoolId: context.schoolId as mongoose.Types.ObjectId,
        editorIds: parsed.data.editorIds,
      });
    }
  }

  await AcademicCalendarEvent.updateOne(
    { _id: eventObjId },
    { $set: update }
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ calendarId: string; eventId: string }> }
) {
  const context = await requireSchoolMember({ allowedRoles: ["teacher", "bursar"] });
  await connectToDatabase();

  const { calendarId, eventId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(calendarId) || !mongoose.Types.ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: "Invalid calendar or event ID" }, { status: 400 });
  }

  const calendarObjId = new mongoose.Types.ObjectId(calendarId);
  const eventObjId = new mongoose.Types.ObjectId(eventId);

  const calendar = await AcademicCalendar.findOne({
    _id: calendarObjId,
    schoolId: context.schoolId,
  }).lean();

  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const event = await AcademicCalendarEvent.findOne({
    _id: eventObjId,
    calendarId: calendarObjId,
    schoolId: context.schoolId,
  }).lean();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const canEdit = canEditCalendar({
    userId: context.userId,
    roles: context.roles,
    isAdmin: context.isAdmin,
    calendar,
    event: {
      editorScope: event.editorScope,
      editorIds: event.editorIds,
    },
  });

  if (!canEdit) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await AcademicCalendarEvent.deleteOne({ _id: eventObjId });

  return NextResponse.json({ success: true });
}
