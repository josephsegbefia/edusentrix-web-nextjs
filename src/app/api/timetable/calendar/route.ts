import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  formatDateYmd,
  parseMonthInput,
  queryPublishedSlots,
  resolvePublishedTimetableContext,
  resolveScopeFilter,
  type TimetableScope,
} from "@/lib/timetable/read-model";
import {
  isTimetableRebootEnabled,
  isTimetableRoleReadViewsEnabled,
} from "@/lib/timetable/feature-flags";

function toObjectIdOrNull(value: string | null): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function isScope(value: string | null): value is TimetableScope {
  return value === "school" || value === "class" || value === "teacher" || value === "student";
}

/**
 * GET /api/timetable/calendar?month=YYYY-MM&scope=school|class|teacher|student
 */
export async function GET(req: NextRequest) {
  try {
    if (!isTimetableRebootEnabled() || !isTimetableRoleReadViewsEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable read views are disabled." },
        { status: 404 }
      );
    }

    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);

    const monthParam = searchParams.get("month");
    const scopeParam = searchParams.get("scope");
    if (!monthParam) {
      return NextResponse.json(
        { success: false, error: "month is required in YYYY-MM format." },
        { status: 400 }
      );
    }
    if (!isScope(scopeParam)) {
      return NextResponse.json(
        { success: false, error: "scope must be one of: school, class, teacher, student." },
        { status: 400 }
      );
    }

    const monthStart = parseMonthInput(monthParam);
    if (!monthStart) {
      return NextResponse.json(
        { success: false, error: "month must be a valid YYYY-MM value." },
        { status: 400 }
      );
    }

    const classGroupId = toObjectIdOrNull(searchParams.get("classGroupId"));
    const teacherId = toObjectIdOrNull(searchParams.get("teacherId"));
    const studentId = toObjectIdOrNull(searchParams.get("studentId"));

    if (searchParams.get("classGroupId") && !classGroupId) {
      return NextResponse.json(
        { success: false, error: "classGroupId must be a valid ObjectId." },
        { status: 400 }
      );
    }
    if (searchParams.get("teacherId") && !teacherId) {
      return NextResponse.json(
        { success: false, error: "teacherId must be a valid ObjectId." },
        { status: 400 }
      );
    }
    if (searchParams.get("studentId") && !studentId) {
      return NextResponse.json(
        { success: false, error: "studentId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const published = await resolvePublishedTimetableContext(schoolIdObj, monthStart);
    const year = monthStart.getFullYear();
    const monthIndex = monthStart.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    if (!published) {
      const days = Array.from({ length: daysInMonth }, (_, idx) => {
        const date = new Date(year, monthIndex, idx + 1);
        return {
          date: formatDateYmd(date),
          dayOfWeek: date.getDay(),
          slotCount: 0,
          hasSlots: false,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          scope: scopeParam,
          month: monthParam,
          days,
        },
        meta: { publishedVersionId: null, publishedAt: null, noPublishedVersion: true },
      });
    }

    const scopeFilter = await resolveScopeFilter({
      schoolId: schoolIdObj,
      scope: scopeParam,
      classGroupId,
      teacherId,
      studentId,
    });
    if (!scopeFilter.ok) {
      return NextResponse.json(
        { success: false, error: scopeFilter.error },
        { status: scopeFilter.status }
      );
    }

    const slots = await queryPublishedSlots({
      schoolId: schoolIdObj,
      versionId: published.versionId,
      scope: scopeParam,
      classGroupId: scopeFilter.classGroupId,
      teacherId: scopeFilter.teacherId,
    });

    const dayCounts = slots.reduce<Record<number, number>>((acc, slot) => {
      acc[slot.dayOfWeek] = (acc[slot.dayOfWeek] || 0) + 1;
      return acc;
    }, {});

    const days = Array.from({ length: daysInMonth }, (_, idx) => {
      const date = new Date(year, monthIndex, idx + 1);
      const dayOfWeek = date.getDay();
      const slotCount = dayCounts[dayOfWeek] || 0;
      return {
        date: formatDateYmd(date),
        dayOfWeek,
        slotCount,
        hasSlots: slotCount > 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        scope: scopeParam,
        month: monthParam,
        days,
      },
      meta: {
        publishedVersionId: String(published.versionId),
        publishedAt: published.publishedAt
          ? published.publishedAt.toISOString()
          : null,
      },
    });
  } catch (e: unknown) {
    console.error("Failed to fetch timetable calendar:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to fetch timetable calendar.",
      },
      { status: 500 }
    );
  }
}
