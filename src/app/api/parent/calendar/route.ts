import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, getParentWardIds } from "@/lib/auth/requireParent";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { Student } from "@/models/Student";
import {
  audienceIncludesRole,
  matchesAudienceScope,
  normalizeAudience,
} from "@/lib/academic-calendar/audience";
import { expandRecurringEvent, clampRange, getRangeDefaults } from "@/lib/academic-calendar/recurrence";

function parseDateParam(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent({ mode: "api" });
    await connectToDatabase();

    const url = new URL(req.url);
    const from = parseDateParam(url.searchParams.get("from"));
    const to = parseDateParam(url.searchParams.get("to"));
    const calendarId = url.searchParams.get("calendarId");

    const defaults = getRangeDefaults();
    const range = clampRange(from || defaults.start, to || defaults.end);

    const wardIds = await getParentWardIds(context.userId);
    if (wardIds.length === 0) {
      return NextResponse.json({ success: true, data: { calendars: [], events: [], occurrences: [], range } });
    }

    const students = await Student.find({ _id: { $in: wardIds } })
      .select("gradeId classGroupId")
      .lean();

    const gradeIds = Array.from(
      new Set(students.map((s) => String((s as any).gradeId)))
    );
    const classGroupIds = Array.from(
      new Set(students.map((s) => String((s as any).classGroupId)))
    );

    const calendarQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      isPublished: true,
    };

    if (calendarId) {
      if (!mongoose.Types.ObjectId.isValid(calendarId)) {
        return NextResponse.json({ error: "Invalid calendar ID" }, { status: 400 });
      }
      calendarQuery._id = new mongoose.Types.ObjectId(calendarId);
    }

    const calendars = await AcademicCalendar.find(calendarQuery)
      .sort({ createdAt: -1 })
      .lean();

    if (calendars.length === 0) {
      return NextResponse.json({ success: true, data: { calendars: [], events: [], occurrences: [], range } });
    }

    const calendarIds = calendars.map((c) => c._id);

    const events = await AcademicCalendarEvent.find({
      calendarId: { $in: calendarIds },
      schoolId: context.schoolId,
      status: "published",
    })
      .sort({ startDate: 1 })
      .lean();

    const filteredEvents = events.filter((event) => {
      const audience = normalizeAudience({
        scope: event.audience?.scope || "school",
        gradeIds: (event.audience?.gradeIds || []).map((id) => String(id)),
        classGroupIds: (event.audience?.classGroupIds || []).map((id) => String(id)),
        roles: event.audience?.roles || [],
      });

      if (!audienceIncludesRole(audience, "parent")) return false;

      return matchesAudienceScope({
        audience,
        gradeIds,
        classGroupIds,
      });
    });

    const occurrences = filteredEvents.flatMap((event) => {
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
        calendars: calendars.map((c) => ({
          id: String(c._id),
          name: c.name,
          color: c.color || null,
        })),
        events: filteredEvents.map((event) => ({
          id: String(event._id),
          calendarId: String(event.calendarId),
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
        })),
        occurrences,
        range: {
          from: range.start.toISOString(),
          to: range.end.toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    if (error instanceof Response) return error;
    console.error("Failed to fetch parent calendar:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch calendar" },
      { status: 500 }
    );
  }
}
