import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { User } from "@/models/User";
import {
  audienceIncludesRole,
  matchesAudienceScope,
  normalizeAudience,
} from "@/lib/academic-calendar/audience";
import {
  expandRecurringEvent,
  clampRange,
  getRangeDefaults,
} from "@/lib/academic-calendar/recurrence";
import {
  DEFAULT_AUDIENCE_ROLES,
  type CalendarAudienceRole,
  type CalendarRecurrence,
} from "@/lib/academic-calendar/types";

function parseDateParam(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function uniqueStringIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          Boolean(value && value !== "undefined" && value !== "null")
      )
    )
  );
}

type StudentAudienceRow = {
  _id: mongoose.Types.ObjectId;
  gradeId?: mongoose.Types.ObjectId | null;
  classGroupId?: mongoose.Types.ObjectId | null;
};

type CalendarEventAudience = {
  scope?: "school" | "grades" | "classes";
  gradeIds?: Array<mongoose.Types.ObjectId | string>;
  classGroupIds?: Array<mongoose.Types.ObjectId | string>;
  roles?: CalendarAudienceRole[];
};

type CalendarEventRow = {
  _id: mongoose.Types.ObjectId;
  calendarId: mongoose.Types.ObjectId;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  coverImageUrl?: string | null;
  status: string;
  eventType: string;
  isNonTeachingDay: boolean;
  audience?: CalendarEventAudience | null;
  recurrence?: CalendarRecurrence | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type ClassGroupLookupRow = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
  gradeId?: mongoose.Types.ObjectId | null;
};

type GradeLookupRow = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
};

type CreatorLookupRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id gradeId classGroupId")
      .lean()) as StudentAudienceRow | null;

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const from = parseDateParam(url.searchParams.get("from"));
    const to = parseDateParam(url.searchParams.get("to"));
    const calendarId = url.searchParams.get("calendarId");

    const defaults = getRangeDefaults();
    const range = clampRange(from || defaults.start, to || defaults.end);

    const gradeIds = uniqueStringIds([
      student.gradeId ? String(student.gradeId) : null,
    ]);
    const classGroupIds = uniqueStringIds([
      student.classGroupId ? String(student.classGroupId) : null,
    ]);

    let selectedCalendarId: mongoose.Types.ObjectId | null = null;
    if (calendarId) {
      if (!mongoose.Types.ObjectId.isValid(calendarId)) {
        return NextResponse.json(
          { success: false, error: "Invalid calendar ID" },
          { status: 400 }
        );
      }
      selectedCalendarId = new mongoose.Types.ObjectId(calendarId);
    }

    const calendars = await AcademicCalendar.find({
      schoolId: context.schoolId,
      isPublished: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (calendars.length === 0) {
      return NextResponse.json({
        success: true,
        data: { calendars: [], events: [], occurrences: [], range },
      });
    }

    const calendarSummaries = calendars.map((calendar) => ({
      id: String(calendar._id),
      name: calendar.name,
      color: calendar.color || null,
    }));

    if (
      selectedCalendarId &&
      !calendars.some(
        (calendar) => String(calendar._id) === String(selectedCalendarId)
      )
    ) {
      return NextResponse.json({
        success: true,
        data: {
          calendars: calendarSummaries,
          events: [],
          occurrences: [],
          range,
        },
      });
    }

    const calendarIds = calendars.map((calendar) => calendar._id);

    const eventQuery: Record<string, unknown> = {
      calendarId: selectedCalendarId || { $in: calendarIds },
      schoolId: context.schoolId,
      status: "published",
    };

    const events = (await AcademicCalendarEvent.find(eventQuery)
      .sort({ startDate: 1 })
      .lean()) as unknown as CalendarEventRow[];

    const filteredEvents = events.filter((event) => {
      const audience = normalizeAudience({
        scope: event.audience?.scope || "school",
        gradeIds: (event.audience?.gradeIds || []).map((id) => String(id)),
        classGroupIds: (event.audience?.classGroupIds || []).map((id) =>
          String(id)
        ),
        roles: event.audience?.roles || [],
      });

      if (!audienceIncludesRole(audience, "student")) return false;

      return matchesAudienceScope({
        audience,
        gradeIds,
        classGroupIds,
      });
    });

    const calendarMap = new Map(
      calendars.map((calendar) => [
        String(calendar._id),
        {
          name: calendar.name,
          color: calendar.color || null,
        },
      ])
    );

    const eventGradeIds = uniqueStringIds(
      filteredEvents.flatMap((event) =>
        (event.audience?.gradeIds || []).map((id) => String(id))
      )
    );
    const eventClassGroupIds = uniqueStringIds(
      filteredEvents.flatMap((event) =>
        (event.audience?.classGroupIds || []).map((id) => String(id))
      )
    );
    const creatorIds = uniqueStringIds(
      filteredEvents.map((event) =>
        event.createdBy ? String(event.createdBy) : null
      )
    );

    const classGroups: ClassGroupLookupRow[] = eventClassGroupIds.length
      ? ((await ClassGroup.find({
          schoolId: context.schoolId,
          _id: {
            $in: eventClassGroupIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("_id name gradeId")
          .lean()) as ClassGroupLookupRow[])
      : [];

    const classGroupGradeIds = uniqueStringIds(
      classGroups.map((classGroup) =>
        classGroup.gradeId ? String(classGroup.gradeId) : null
      )
    );

    const lookupGradeIds = uniqueStringIds([
      ...eventGradeIds,
      ...classGroupGradeIds,
    ]);

    const grades: GradeLookupRow[] = lookupGradeIds.length
      ? ((await Grade.find({
          schoolId: context.schoolId,
          _id: {
            $in: lookupGradeIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("_id name")
          .lean()) as GradeLookupRow[])
      : [];

    const creators: CreatorLookupRow[] = creatorIds.length
      ? ((await User.find({
          _id: { $in: creatorIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("_id firstName lastName name email")
          .lean()) as CreatorLookupRow[])
      : [];

    const gradeNameById = new Map(
      grades.map((grade) => [String(grade._id), grade.name || ""])
    );
    const classGroupLabelById = new Map(
      classGroups.map((classGroup) => {
        const gradeName =
          gradeNameById.get(String(classGroup.gradeId || "")) || "";
        const className = classGroup.name || "";
        return [String(classGroup._id), `${gradeName} ${className}`.trim()];
      })
    );
    const creatorById = new Map(
      creators.map((creator) => {
        const firstName = creator.firstName || "";
        const lastName = creator.lastName || "";
        const fullName =
          `${firstName} ${lastName}`.trim() ||
          creator.name ||
          creator.email ||
          "School staff";
        return [
          String(creator._id),
          {
            id: String(creator._id),
            name: fullName,
            email: creator.email || null,
          },
        ];
      })
    );

    const occurrences = filteredEvents.flatMap((event) => {
      const recurrence = event.recurrence
        ? {
            ...event.recurrence,
            until: event.recurrence.until
              ? new Date(event.recurrence.until).toISOString()
              : undefined,
          }
        : null;

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
          recurrence,
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
        calendars: calendarSummaries,
        events: filteredEvents.map((event) => ({
          id: String(event._id),
          calendarId: String(event.calendarId),
          calendarName: calendarMap.get(String(event.calendarId))?.name || null,
          calendarColor:
            calendarMap.get(String(event.calendarId))?.color || null,
          title: event.title,
          description: event.description || null,
          startDate: new Date(event.startDate).toISOString(),
          endDate: new Date(event.endDate).toISOString(),
          allDay: event.allDay,
          location: event.location || null,
          color: event.color || null,
          coverImageUrl: event.coverImageUrl || null,
          status: event.status,
          eventType: event.eventType,
          isNonTeachingDay: event.isNonTeachingDay,
          audience: (() => {
            const audience = normalizeAudience({
              scope: event.audience?.scope || "school",
              gradeIds: (event.audience?.gradeIds || []).map((id) => String(id)),
              classGroupIds: (event.audience?.classGroupIds || []).map((id) =>
                String(id)
              ),
              roles: event.audience?.roles || [],
            });

            return {
              scope: audience.scope,
              gradeIds: audience.gradeIds || [],
              classGroupIds: audience.classGroupIds || [],
              gradeNames: (audience.gradeIds || [])
                .map((id) => gradeNameById.get(id))
                .filter((name): name is string => Boolean(name)),
              classGroupNames: (audience.classGroupIds || [])
                .map((id) => classGroupLabelById.get(id))
                .filter((name): name is string => Boolean(name)),
              roles:
                audience.roles && audience.roles.length > 0
                  ? audience.roles
                  : [...DEFAULT_AUDIENCE_ROLES],
            };
          })(),
          recurrence: event.recurrence
            ? {
                ...event.recurrence,
                until: event.recurrence.until
                  ? new Date(event.recurrence.until).toISOString()
                  : null,
              }
            : null,
          createdBy: event.createdBy
            ? creatorById.get(String(event.createdBy)) || {
                id: String(event.createdBy),
                name: "School staff",
                email: null,
              }
            : null,
          createdAt: event.createdAt
            ? new Date(event.createdAt).toISOString()
            : null,
          updatedAt: event.updatedAt
            ? new Date(event.updatedAt).toISOString()
            : null,
        })),
        occurrences,
        range: {
          from: range.start.toISOString(),
          to: range.end.toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch student calendar:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch calendar",
      },
      { status: 500 }
    );
  }
}
