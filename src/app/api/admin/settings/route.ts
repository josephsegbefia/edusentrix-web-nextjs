// src/app/api/admin/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSettings } from "@/models/SchoolSettings";
import mongoose from "mongoose";
import { z } from "zod";

// Validation schemas
const TimeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

const BreakPeriodSchema = z.object({
  name: z.string().min(1).max(100),
  startTime: z.string().regex(TimeRegex, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(TimeRegex, "Invalid time format (HH:MM)"),
  isLunch: z.boolean().optional(),
});

const DailyScheduleOverrideSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(TimeRegex).optional(),
  endTime: z.string().regex(TimeRegex).optional(),
});

const BreakDailyOverrideSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  breakName: z.string().min(1).max(100),
  startTime: z.string().regex(TimeRegex).optional(),
  endTime: z.string().regex(TimeRegex).optional(),
});

const BreakGradeOverrideSchema = z.object({
  gradeId: z.string().min(1),
  breakName: z.string().min(1).max(100),
  startTime: z.string().regex(TimeRegex).optional(),
  endTime: z.string().regex(TimeRegex).optional(),
});

const GradeScheduleOverrideSchema = z.object({
  gradeId: z.string().min(1),
  periodsPerDay: z.number().min(1).max(15).optional(),
  periodDuration: z.number().min(15).max(120).optional(),
  periodSlots: z
    .array(
      z.object({
        periodNumber: z.number().min(1),
        startTime: z.string().regex(TimeRegex),
        endTime: z.string().regex(TimeRegex),
        label: z.string().optional(),
      })
    )
    .optional(),
});

const AssemblyConfigSchema = z.object({
  days: z.array(z.number().min(0).max(6)),
  startTime: z.string().regex(TimeRegex, "Invalid time format (HH:MM)"),
  duration: z.number().min(1).max(180),
  location: z.string().max(200).optional(),
});

const AssemblyDailyOverrideSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(TimeRegex).optional(),
  duration: z.number().min(1).max(180).optional(),
});

const AssemblyGradeOverrideSchema = z.object({
  gradeId: z.string().min(1),
  startTime: z.string().regex(TimeRegex).optional(),
  duration: z.number().min(1).max(180).optional(),
});

const TeacherStudioSchema = z.object({
  enabled: z.boolean(),
});

const AttendanceNotificationsSchema = z.object({
  enabled: z.boolean(),
  channels: z
    .object({
      whatsapp: z.boolean(),
      sms: z.boolean(),
      email: z.boolean(),
    })
    .optional(),
});

const OfflineModeSchema = z.object({
  enabled: z.boolean(),
});

const UpdateSettingsSchema = z.object({
  schoolStartTime: z.string().regex(TimeRegex).optional(),
  schoolEndTime: z.string().regex(TimeRegex).optional(),
  periodDuration: z.number().min(15).max(120).optional(),
  periodsPerDay: z.number().min(1).max(15).optional(),
  breaks: z.array(BreakPeriodSchema).optional(),
  breakDailyOverrides: z.array(BreakDailyOverrideSchema).optional(),
  breakGradeOverrides: z.array(BreakGradeOverrideSchema).optional(),
  assembly: AssemblyConfigSchema.nullable().optional(),
  assemblyDailyOverrides: z.array(AssemblyDailyOverrideSchema).optional(),
  assemblyGradeOverrides: z.array(AssemblyGradeOverrideSchema).optional(),
  lateArrivalCutoff: z.string().regex(TimeRegex).nullable().optional(),
  minimumAttendancePercent: z.number().min(0).max(100).optional(),
  defaultExamWeekDuration: z.number().min(1).max(21).optional(),
  defaultRevisionWeekDuration: z.number().min(1).max(14).optional(),
  workingDays: z.array(z.number().min(0).max(6)).optional(),
  dailyScheduleOverrides: z.array(DailyScheduleOverrideSchema).optional(),
  gradeScheduleOverrides: z.array(GradeScheduleOverrideSchema).optional(),
  teacherStudio: TeacherStudioSchema.optional(),
  attendanceNotifications: AttendanceNotificationsSchema.optional(),
  offlineMode: OfflineModeSchema.optional(),
});

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * GET /api/admin/settings
 * Fetch school settings (creates default if not exists)
 */
export async function GET() {
  try {
    const authCtx = await requireSchoolAdminOrTeacherRead();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(authCtx.schoolId));

    // Find or create settings
    let settings = await SchoolSettings.findOne({ schoolId: schoolIdObj }).lean() as Record<string, unknown> | null;

    if (!settings) {
      if (!authCtx.canBootstrapSchoolSettings) {
        const data = {
          id: "",
          schoolStartTime: "07:30",
          schoolEndTime: "15:00",
          periodDuration: 40,
          periodsPerDay: 8,
          periodSlots: [],
          dailyScheduleOverrides: [],
          gradeScheduleOverrides: [],
          breaks: [
            { name: "Short Break", startTime: "10:00", endTime: "10:20", isLunch: false },
            { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
          ],
          breakDailyOverrides: [],
          breakGradeOverrides: [],
          assembly: {
            days: [1, 5],
            startTime: "07:30",
            duration: 30,
          },
          assemblyDailyOverrides: [],
          assemblyGradeOverrides: [],
          lateArrivalCutoff: "07:45",
          minimumAttendancePercent: 75,
          defaultExamWeekDuration: 5,
          defaultRevisionWeekDuration: 5,
          workingDays: [1, 2, 3, 4, 5],
          teacherStudio: { enabled: true },
          attendanceNotifications: {
            enabled: true,
            channels: { whatsapp: true, sms: false, email: false },
          },
          offlineMode: { enabled: true },
          updatedAt: null,
        };
        return NextResponse.json({ success: true, data });
      }
      // Create default settings
      const newSettings = await SchoolSettings.create({
        schoolId: schoolIdObj,
        schoolStartTime: "07:30",
        schoolEndTime: "15:00",
        periodDuration: 40,
        periodsPerDay: 8,
        breaks: [
          { name: "Short Break", startTime: "10:00", endTime: "10:20", isLunch: false },
          { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
        ],
        assembly: {
          days: [1, 5], // Monday and Friday
          startTime: "07:30",
          duration: 30,
        },
        lateArrivalCutoff: "07:45",
        minimumAttendancePercent: 75,
        defaultExamWeekDuration: 5,
        defaultRevisionWeekDuration: 5,
        workingDays: [1, 2, 3, 4, 5],
        teacherStudio: { enabled: true },
        attendanceNotifications: {
          enabled: true,
          channels: { whatsapp: true, sms: false, email: false },
        },
        offlineMode: { enabled: true },
      });
      settings = newSettings.toObject() as unknown as Record<string, unknown>;
    }

    const s = settings as Record<string, unknown>;
    const data = {
      id: String(s._id),
      schoolStartTime: s.schoolStartTime,
      schoolEndTime: s.schoolEndTime,
      periodDuration: s.periodDuration,
      periodsPerDay: s.periodsPerDay,
      periodSlots: s.periodSlots || [],
      dailyScheduleOverrides: s.dailyScheduleOverrides || [],
      gradeScheduleOverrides: asArray<{
        gradeId: unknown;
        periodsPerDay?: number;
        periodDuration?: number;
        periodSlots?: unknown[];
      }>(s.gradeScheduleOverrides).map(
        (g: { gradeId: unknown; periodsPerDay?: number; periodDuration?: number; periodSlots?: unknown[] }) => ({
          gradeId: String(g.gradeId),
          periodsPerDay: g.periodsPerDay,
          periodDuration: g.periodDuration,
          periodSlots: g.periodSlots || [],
        })
      ),
      breaks: s.breaks || [],
      breakDailyOverrides: s.breakDailyOverrides || [],
      breakGradeOverrides: asArray<{
        gradeId: unknown;
        breakName: string;
        startTime?: string;
        endTime?: string;
      }>(s.breakGradeOverrides).map(
        (g: { gradeId: unknown; breakName: string; startTime?: string; endTime?: string }) => ({
          gradeId: String(g.gradeId),
          breakName: g.breakName,
          startTime: g.startTime,
          endTime: g.endTime,
        })
      ),
      assembly: s.assembly || null,
      assemblyDailyOverrides: s.assemblyDailyOverrides || [],
      assemblyGradeOverrides: asArray<{
        gradeId: unknown;
        startTime?: string;
        duration?: number;
      }>(s.assemblyGradeOverrides).map(
        (g: { gradeId: unknown; startTime?: string; duration?: number }) => ({
          gradeId: String(g.gradeId),
          startTime: g.startTime,
          duration: g.duration,
        })
      ),
      lateArrivalCutoff: s.lateArrivalCutoff || null,
      minimumAttendancePercent: s.minimumAttendancePercent ?? 75,
      defaultExamWeekDuration: s.defaultExamWeekDuration ?? 5,
      defaultRevisionWeekDuration: s.defaultRevisionWeekDuration ?? 5,
      workingDays: s.workingDays || [1, 2, 3, 4, 5],
      teacherStudio: (s.teacherStudio as { enabled?: boolean } | undefined) || {
        enabled: true,
      },
      attendanceNotifications: (s.attendanceNotifications as {
        enabled?: boolean;
        channels?: { whatsapp?: boolean; sms?: boolean; email?: boolean };
      } | undefined) || {
        enabled: true,
        channels: { whatsapp: true, sms: false, email: false },
      },
      offlineMode: (s.offlineMode as { enabled?: boolean } | undefined) || {
        enabled: true,
      },
      updatedAt: s.updatedAt ? new Date(s.updatedAt as string).toISOString() : null,
    };

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Error fetching school settings:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/settings
 * Update school settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      ...parsed.data,
      updatedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
    };

    // Convert gradeId strings to ObjectId in gradeScheduleOverrides
    if (updateData.gradeScheduleOverrides && Array.isArray(updateData.gradeScheduleOverrides)) {
      updateData.gradeScheduleOverrides = (
        updateData.gradeScheduleOverrides as Array<{ gradeId: string; periodsPerDay?: number; periodDuration?: number; periodSlots?: unknown[] }>
      ).map((g) => ({
        ...g,
        gradeId: new mongoose.Types.ObjectId(g.gradeId),
      }));
    }

    // Convert gradeId strings to ObjectId in breakGradeOverrides
    if (updateData.breakGradeOverrides && Array.isArray(updateData.breakGradeOverrides)) {
      updateData.breakGradeOverrides = (
        updateData.breakGradeOverrides as Array<{ gradeId: string; breakName: string; startTime?: string; endTime?: string }>
      ).map((g) => ({
        ...g,
        gradeId: new mongoose.Types.ObjectId(g.gradeId),
      }));
    }

    // Convert gradeId strings to ObjectId in assemblyGradeOverrides
    if (updateData.assemblyGradeOverrides && Array.isArray(updateData.assemblyGradeOverrides)) {
      updateData.assemblyGradeOverrides = (
        updateData.assemblyGradeOverrides as Array<{ gradeId: string; startTime?: string; duration?: number }>
      ).map((g) => ({
        ...g,
        gradeId: new mongoose.Types.ObjectId(g.gradeId),
      }));
    }

    const scheduleAffectingFields = [
      "schoolStartTime",
      "schoolEndTime",
      "periodDuration",
      "periodsPerDay",
      "breaks",
      "breakDailyOverrides",
      "breakGradeOverrides",
      "assembly",
      "assemblyDailyOverrides",
      "assemblyGradeOverrides",
      "dailyScheduleOverrides",
    ];
    const shouldClearSchoolWidePeriodSlots = scheduleAffectingFields.some(
      (field) => field in parsed.data
    );

    const updateOps: {
      $set: Record<string, unknown>;
      $unset?: Record<string, unknown>;
    } = { $set: updateData };
    if (shouldClearSchoolWidePeriodSlots) {
      updateOps.$unset = { periodSlots: 1 };
    }

    // Upsert settings
    const settings = await SchoolSettings.findOneAndUpdate(
      { schoolId: schoolIdObj },
      updateOps,
      { new: true, upsert: true, runValidators: true }
    ).lean() as Record<string, unknown>;

    const data = {
      id: String(settings._id),
      schoolStartTime: settings.schoolStartTime,
      schoolEndTime: settings.schoolEndTime,
      periodDuration: settings.periodDuration,
      periodsPerDay: settings.periodsPerDay,
      periodSlots: settings.periodSlots || [],
      dailyScheduleOverrides: settings.dailyScheduleOverrides || [],
      gradeScheduleOverrides: (
        (settings.gradeScheduleOverrides as Array<{ gradeId: unknown; periodsPerDay?: number; periodDuration?: number; periodSlots?: unknown[] }>) || []
      ).map((g) => ({
        gradeId: String(g.gradeId),
        periodsPerDay: g.periodsPerDay,
        periodDuration: g.periodDuration,
        periodSlots: g.periodSlots || [],
      })),
      breaks: settings.breaks || [],
      breakDailyOverrides: settings.breakDailyOverrides || [],
      breakGradeOverrides: (
        (settings.breakGradeOverrides as Array<{ gradeId: unknown; breakName: string; startTime?: string; endTime?: string }>) || []
      ).map((g) => ({
        gradeId: String(g.gradeId),
        breakName: g.breakName,
        startTime: g.startTime,
        endTime: g.endTime,
      })),
      assembly: settings.assembly || null,
      assemblyDailyOverrides: settings.assemblyDailyOverrides || [],
      assemblyGradeOverrides: (
        (settings.assemblyGradeOverrides as Array<{ gradeId: unknown; startTime?: string; duration?: number }>) || []
      ).map((g) => ({
        gradeId: String(g.gradeId),
        startTime: g.startTime,
        duration: g.duration,
      })),
      lateArrivalCutoff: settings.lateArrivalCutoff || null,
      minimumAttendancePercent: settings.minimumAttendancePercent ?? 75,
      defaultExamWeekDuration: settings.defaultExamWeekDuration ?? 5,
      defaultRevisionWeekDuration: settings.defaultRevisionWeekDuration ?? 5,
      workingDays: settings.workingDays || [1, 2, 3, 4, 5],
      teacherStudio: (settings.teacherStudio as { enabled?: boolean } | undefined) || {
        enabled: true,
      },
      attendanceNotifications: (settings.attendanceNotifications as {
        enabled?: boolean;
        channels?: { whatsapp?: boolean; sms?: boolean; email?: boolean };
      } | undefined) || {
        enabled: true,
        channels: { whatsapp: true, sms: false, email: false },
      },
      offlineMode: (settings.offlineMode as { enabled?: boolean } | undefined) || {
        enabled: true,
      },
      updatedAt: settings.updatedAt ? new Date(settings.updatedAt as string).toISOString() : null,
    };

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      data,
    });
  } catch (e: unknown) {
    console.error("Error updating school settings:", e);
    const message = e instanceof Error ? e.message : "Failed to update settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
