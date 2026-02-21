import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import {
  audienceIncludesRole,
  matchesAudienceScope,
  normalizeAudience,
} from "@/lib/academic-calendar/audience";
import { expandRecurringEvent, clampRange, getRangeDefaults } from "@/lib/academic-calendar/recurrence";

type TeacherAssignmentClassGroupRef = {
  classGroupId?: mongoose.Types.ObjectId | null;
};

type ClassGroupGradeRef = {
  gradeId?: mongoose.Types.ObjectId | null;
};

function parseDateParam(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireTeacher({ mode: "api" });
    await connectToDatabase();

    const url = new URL(req.url);
    const from = parseDateParam(url.searchParams.get("from"));
    const to = parseDateParam(url.searchParams.get("to"));
    const calendarId = url.searchParams.get("calendarId");

    const defaults = getRangeDefaults();
    const range = clampRange(from || defaults.start, to || defaults.end);

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

    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    const periodId = currentPeriod?._id
      ? new mongoose.Types.ObjectId(String(currentPeriod._id))
      : null;

    const assignments = await TeacherAssignment.find({
      teacherId: context.teacherId,
      schoolId: context.schoolId,
      ...(periodId ? { academicPeriodId: periodId } : {}),
      status: "active",
    })
      .select("classGroupId")
      .lean<TeacherAssignmentClassGroupRef[]>();

    const classGroupIds = new Set<string>();
    assignments.forEach((assignment) => {
      if (assignment.classGroupId) {
        classGroupIds.add(String(assignment.classGroupId));
      }
    });
    if (context.homeroomClassGroupId) {
      classGroupIds.add(String(context.homeroomClassGroupId));
    }

    const classGroupIdList = Array.from(classGroupIds);

    let gradeIds: string[] = [];
    if (classGroupIdList.length > 0) {
      const classGroups = await ClassGroup.find({
        _id: { $in: classGroupIdList.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("gradeId")
        .lean<ClassGroupGradeRef[]>();
      gradeIds = Array.from(
        new Set(
          classGroups
            .map((classGroup) =>
              classGroup.gradeId ? String(classGroup.gradeId) : null
            )
            .filter((id): id is string => Boolean(id))
        )
      );
    }

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
        roles: (event.audience?.roles || []) as (
          | "teacher"
          | "parent"
          | "student"
          | "staff"
          | "bursar"
        )[],
      });

      if (!audienceIncludesRole(audience, "teacher")) return false;

      return matchesAudienceScope({
        audience,
        gradeIds,
        classGroupIds: classGroupIdList,
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
    console.error("Failed to fetch teacher calendar:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch calendar" },
      { status: 500 }
    );
  }
}
