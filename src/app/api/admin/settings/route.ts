import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { DEFAULT_SCHOOL_LEO_SETTINGS } from "@/lib/leo/defaults";
import { SchoolSettings } from "@/models/SchoolSettings";

const TimeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

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

const PromotionsAutomationSchema = z.object({
  autoPreviewEnabled: z.boolean(),
  autoPreviewLeadDays: z.number().min(0).max(60),
});

const UpdateSettingsSchema = z
  .object({
    assembly: AssemblyConfigSchema.nullable().optional(),
    assemblyDailyOverrides: z.array(AssemblyDailyOverrideSchema).optional(),
    assemblyGradeOverrides: z.array(AssemblyGradeOverrideSchema).optional(),
    lateArrivalCutoff: z.string().regex(TimeRegex).nullable().optional(),
    minimumAttendancePercent: z.number().min(0).max(100).optional(),
    defaultExamWeekDuration: z.number().min(1).max(21).optional(),
    defaultRevisionWeekDuration: z.number().min(1).max(14).optional(),
    teacherStudio: TeacherStudioSchema.optional(),
    attendanceNotifications: AttendanceNotificationsSchema.optional(),
    offlineMode: OfflineModeSchema.optional(),
    promotions: PromotionsAutomationSchema.optional(),
  });

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function serializeSettings(settings: Record<string, unknown>) {
  return {
    id: String(settings._id),
    schoolStartTime: null,
    schoolEndTime: null,
    periodDuration: null,
    periodsPerDay: null,
    periodSlots: [] as unknown[],
    dailyScheduleOverrides: [] as unknown[],
    gradeScheduleOverrides: [] as unknown[],
    breaks: [] as unknown[],
    breakDailyOverrides: [] as unknown[],
    breakGradeOverrides: [] as unknown[],
    assembly: settings.assembly || null,
    assemblyDailyOverrides: settings.assemblyDailyOverrides || [],
    assemblyGradeOverrides: asArray<{
      gradeId: unknown;
      startTime?: string;
      duration?: number;
    }>(settings.assemblyGradeOverrides).map((entry) => ({
      gradeId: String(entry.gradeId),
      startTime: entry.startTime,
      duration: entry.duration,
    })),
    lateArrivalCutoff: (settings.lateArrivalCutoff as string | null | undefined) || null,
    minimumAttendancePercent: (settings.minimumAttendancePercent as number | undefined) ?? 75,
    defaultExamWeekDuration: (settings.defaultExamWeekDuration as number | undefined) ?? 5,
    defaultRevisionWeekDuration: (settings.defaultRevisionWeekDuration as number | undefined) ?? 5,
    teacherStudio: (settings.teacherStudio as { enabled?: boolean } | undefined) || {
      enabled: true,
    },
    attendanceNotifications:
      (settings.attendanceNotifications as
        | {
            enabled?: boolean;
            channels?: { whatsapp?: boolean; sms?: boolean; email?: boolean };
          }
        | undefined) || {
        enabled: true,
        channels: { whatsapp: true, sms: false, email: false },
      },
    offlineMode: (settings.offlineMode as { enabled?: boolean } | undefined) || {
      enabled: true,
    },
    promotions:
      (settings.promotions as
        | {
            autoPreviewEnabled?: boolean;
            autoPreviewLeadDays?: number;
          }
        | undefined) || {
        autoPreviewEnabled: false,
        autoPreviewLeadDays: 7,
      },
    updatedAt: settings.updatedAt ? new Date(settings.updatedAt as string).toISOString() : null,
  };
}

function buildDefaultSettingsDoc(schoolId: mongoose.Types.ObjectId) {
  return {
    schoolId,
    scheduleModelVersion: 2,
    daySchedules: [],
    gradeDayScheduleProfiles: [],
    schoolStartTime: "07:30",
    schoolEndTime: "15:00",
    periodDuration: 40,
    periodsPerDay: 8,
    breaks: [],
    assembly: {
      days: [1, 5],
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
    promotions: {
      autoPreviewEnabled: false,
      autoPreviewLeadDays: 7,
    },
    leo: { ...DEFAULT_SCHOOL_LEO_SETTINGS },
  };
}

function buildInsertOnlyDefaults(
  schoolId: mongoose.Types.ObjectId,
  setData: Record<string, unknown>
) {
  const defaults = buildDefaultSettingsDoc(schoolId) as Record<string, unknown>;
  for (const key of Object.keys(setData)) {
    delete defaults[key];
  }
  return defaults;
}

export async function GET() {
  try {
    const authCtx = await requireSchoolAdminOrTeacherRead();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(authCtx.schoolId));

    let settings = (await SchoolSettings.findOne({ schoolId: schoolIdObj }).lean()) as
      | Record<string, unknown>
      | null;

    if (!settings) {
      if (!authCtx.canBootstrapSchoolSettings) {
        return NextResponse.json({
          success: true,
          data: serializeSettings({
            _id: "",
            ...buildDefaultSettingsDoc(schoolIdObj),
            updatedAt: null,
          }),
        });
      }

      const created = await SchoolSettings.create(buildDefaultSettingsDoc(schoolIdObj));
      settings = created.toObject() as unknown as Record<string, unknown>;
    }

    return NextResponse.json({
      success: true,
      data: serializeSettings(settings),
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Error fetching school settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch settings",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();
    const parsed = UpdateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updateData = Object.fromEntries(
      Object.entries({
        ...parsed.data,
        updatedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
      }).filter(([, value]) => value !== undefined)
    ) as Record<string, unknown>;

    if (updateData.assemblyGradeOverrides && Array.isArray(updateData.assemblyGradeOverrides)) {
      updateData.assemblyGradeOverrides = (
        updateData.assemblyGradeOverrides as Array<{
          gradeId: string;
          startTime?: string;
          duration?: number;
        }>
      ).map((entry) => ({
        ...entry,
        gradeId: new mongoose.Types.ObjectId(entry.gradeId),
      }));
    }

    const setData: Record<string, unknown> = { ...updateData };

    const updateOps: {
      $set: Record<string, unknown>;
      $setOnInsert?: Record<string, unknown>;
    } = {
      $set: setData,
      $setOnInsert: buildInsertOnlyDefaults(schoolIdObj, setData),
    };

    const settings = (await SchoolSettings.findOneAndUpdate(
      { schoolId: schoolIdObj },
      updateOps,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean()) as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      data: serializeSettings(settings),
    });
  } catch (error: unknown) {
    console.error("Error updating school settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 }
    );
  }
}
