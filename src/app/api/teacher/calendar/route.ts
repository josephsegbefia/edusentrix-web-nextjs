import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import {
  AcademicCalendarEvent,
  type IAcademicCalendarEvent,
} from "@/models/AcademicCalendarEvent";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import {
  audienceIncludesRole,
  matchesAudienceScope,
  normalizeAudience,
} from "@/lib/academic-calendar/audience";
import {
  clampRange,
  expandRecurringEvent,
  getRangeDefaults,
} from "@/lib/academic-calendar/recurrence";

type PeriodLean = {
  _id: mongoose.Types.ObjectId;
  yearLabel: string;
  term: string;
  startDate: Date;
  endDate: Date;
  isCurrent?: boolean;
};

type TeacherAssignmentClassGroupRef = {
  classGroupId?: mongoose.Types.ObjectId | null;
};

type ClassGroupGradeRef = {
  gradeId?: mongoose.Types.ObjectId | null;
};

function parseDateParam(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializePeriod(period: PeriodLean) {
  return {
    id: String(period._id),
    yearLabel: period.yearLabel,
    term: period.term,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
    isCurrent: Boolean(period.isCurrent),
  };
}

async function loadTeacherAudienceContext(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  homeroomClassGroupId?: mongoose.Types.ObjectId | null;
  academicPeriodId: mongoose.Types.ObjectId;
}) {
  const assignments = await TeacherAssignment.find({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    academicPeriodId: input.academicPeriodId,
    status: "active",
  })
    .select("classGroupId")
    .lean<TeacherAssignmentClassGroupRef[]>();

  const classGroupIds = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.classGroupId) {
      classGroupIds.add(String(assignment.classGroupId));
    }
  }
  if (input.homeroomClassGroupId) {
    classGroupIds.add(String(input.homeroomClassGroupId));
  }

  const classGroupIdList = Array.from(classGroupIds);
  if (classGroupIdList.length === 0) {
    return { gradeIds: [], classGroupIds: [] };
  }

  const classGroups = await ClassGroup.find({
    _id: {
      $in: classGroupIdList.map((id) => new mongoose.Types.ObjectId(id)),
    },
  })
    .select("gradeId")
    .lean<ClassGroupGradeRef[]>();

  const gradeIds = Array.from(
    new Set(
      classGroups
        .map((classGroup) =>
          classGroup.gradeId ? String(classGroup.gradeId) : null
        )
        .filter((id): id is string => Boolean(id))
    )
  );

  return { gradeIds, classGroupIds: classGroupIdList };
}

function eventVisibleToTeacher(
  event: Pick<IAcademicCalendarEvent, "audience">,
  input: { gradeIds: string[]; classGroupIds: string[]; userId: string }
) {
  const audience = normalizeAudience({
    scope: event.audience?.scope || "school",
    gradeIds: (event.audience?.gradeIds || []).map((id) => String(id)),
    classGroupIds: (event.audience?.classGroupIds || []).map((id) => String(id)),
    userIds: (event.audience?.userIds || []).map((id) => String(id)),
    roles: event.audience?.roles || [],
  });

  if (!audienceIncludesRole(audience, "teacher")) return false;

  return matchesAudienceScope({
    audience,
    gradeIds: input.gradeIds,
    classGroupIds: input.classGroupIds,
    userId: input.userId,
  });
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireTeacher({ mode: "api" });
    await connectToDatabase();

    const url = new URL(req.url);
    const from = parseDateParam(url.searchParams.get("from"));
    const to = parseDateParam(url.searchParams.get("to"));
    const requestedPeriodId = url.searchParams.get("academicPeriodId");

    const defaults = getRangeDefaults();
    const range = clampRange(from || defaults.start, to || defaults.end);

    const periods = await AcademicPeriod.find({ schoolId: context.schoolId })
      .sort({ startDate: -1 })
      .lean<PeriodLean[]>();

    const currentPeriod = periods.find((period) => period.isCurrent) || null;
    const selectedPeriod =
      requestedPeriodId && mongoose.Types.ObjectId.isValid(requestedPeriodId)
        ? periods.find((period) => String(period._id) === requestedPeriodId) || null
        : currentPeriod;

    const baseMeta = {
      periods: periods.map(serializePeriod),
      currentPeriod: currentPeriod ? serializePeriod(currentPeriod) : null,
      selectedPeriod: selectedPeriod ? serializePeriod(selectedPeriod) : null,
    };

    if (!selectedPeriod) {
      return NextResponse.json({
        success: true,
        data: {
          calendar: null,
          events: [],
          occurrences: [],
          range: { from: range.start.toISOString(), to: range.end.toISOString() },
          meta: baseMeta,
        },
      });
    }

    const periodObjectId = new mongoose.Types.ObjectId(String(selectedPeriod._id));
    const calendar = await AcademicCalendar.findOne({
      schoolId: context.schoolId,
      academicPeriodId: periodObjectId,
      isPublished: true,
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!calendar) {
      return NextResponse.json({
        success: true,
        data: {
          calendar: null,
          events: [],
          occurrences: [],
          range: { from: range.start.toISOString(), to: range.end.toISOString() },
          meta: baseMeta,
        },
      });
    }

    const teacherAudience = await loadTeacherAudienceContext({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      homeroomClassGroupId: context.homeroomClassGroupId,
      academicPeriodId: periodObjectId,
    });

    const eventsRaw = await AcademicCalendarEvent.find({
      schoolId: context.schoolId,
      calendarId: calendar._id,
      status: "published",
    })
      .sort({ startDate: 1 })
      .lean<IAcademicCalendarEvent[]>();

    const events = eventsRaw.filter((event) =>
      eventVisibleToTeacher(event, {
        ...teacherAudience,
        userId: String(context.userId),
      })
    );

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
        academicPeriodId: event.academicPeriodId
          ? String(event.academicPeriodId)
          : null,
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
          description: calendar.description || null,
          academicPeriodId: calendar.academicPeriodId
            ? String(calendar.academicPeriodId)
            : null,
          color: calendar.color || null,
          isPublished: calendar.isPublished,
        },
        events: events.map((event) => ({
          id: String(event._id),
          calendarId: String(event.calendarId),
          academicPeriodId: event.academicPeriodId
            ? String(event.academicPeriodId)
            : null,
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
        range: { from: range.start.toISOString(), to: range.end.toISOString() },
        meta: baseMeta,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch teacher calendar:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch calendar",
      },
      { status: 500 }
    );
  }
}
