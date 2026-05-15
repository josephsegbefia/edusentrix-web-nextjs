import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { resolveSchoolActorContext } from "@/lib/auth/resolveSchoolActorContext";
import { CommunicationPreference } from "@/models/CommunicationPreference";
import { Teacher } from "@/models/Teacher";
import { TeacherSettings } from "@/models/TeacherSettings";
import { User } from "@/models/User";

const CommunicationTypeSchema = z.enum([
  "notice",
  "announcement",
  "direct_message",
  "fee_reminder",
  "attendance_alert",
  "academic_update",
  "lesson_update",
  "exam_notice",
  "event_notice",
  "emergency_alert",
  "video_meeting_invite",
  "newsletter",
  "system_alert",
]);

const PatchSchema = z.object({
  profile: z
    .object({
      locale: z.string().trim().min(2).max(15).optional(),
      timezone: z.string().trim().min(2).max(64).optional(),
    })
    .optional(),
  communication: z
    .object({
      allowedChannels: z.array(z.enum(["in_app", "email"])).min(1).optional(),
      mutedTypes: z.array(CommunicationTypeSchema).optional(),
    })
    .optional(),
});

function serializePreference(doc: {
  allowedChannels?: string[];
  mutedTypes?: string[];
} | null) {
  return {
    allowedChannels: doc?.allowedChannels?.filter((channel) => channel === "in_app" || channel === "email") ?? [
      "in_app",
      "email",
    ],
    mutedTypes: doc?.mutedTypes ?? [],
    supportedChannels: ["in_app", "email"],
  };
}

export async function GET() {
  try {
    const ctx = await resolveSchoolActorContext();
    await connectToDatabase();

    const [user, preference, teacherSettings] = await Promise.all([
      User.findById(ctx.userId).select("email role name firstName lastName avatarUrl").lean(),
      CommunicationPreference.findOne({ schoolId: ctx.schoolId, userId: ctx.userId })
        .select("allowedChannels mutedTypes")
        .lean(),
      TeacherSettings.findOne({ schoolId: ctx.schoolId, userId: ctx.userId })
        .select("locale timezone")
        .lean(),
    ]);

    const displayName =
      user?.name ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.email ||
      "User";

    return Response.json({
      success: true,
      data: {
        account: {
          id: String(ctx.userId),
          schoolId: String(ctx.schoolId),
          role: user?.role || "staff",
          displayName,
          email: user?.email || "",
          avatarUrl: user?.avatarUrl || null,
        },
        profile: {
          locale: teacherSettings?.locale || "en-GH",
          timezone: teacherSettings?.timezone || "Africa/Accra",
        },
        communication: serializePreference(preference),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await resolveSchoolActorContext();
    await connectToDatabase();

    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    if (parsed.data.profile) {
      const teacher = await Teacher.findOne({ schoolId: ctx.schoolId, userId: ctx.userId })
        .select("_id")
        .lean();
      if (teacher) {
        await TeacherSettings.findOneAndUpdate(
          { schoolId: ctx.schoolId, userId: ctx.userId },
          {
            $set: Object.fromEntries(
              Object.entries({
                locale: parsed.data.profile.locale,
                timezone: parsed.data.profile.timezone,
              }).filter(([, value]) => value !== undefined),
            ),
            $setOnInsert: {
              schoolId: ctx.schoolId,
              teacherId: teacher._id,
              userId: ctx.userId,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }
    }

    if (parsed.data.communication) {
      await CommunicationPreference.findOneAndUpdate(
        { schoolId: ctx.schoolId, userId: ctx.userId },
        {
          $set: {
            ...(parsed.data.communication.allowedChannels
              ? { allowedChannels: parsed.data.communication.allowedChannels }
              : {}),
            ...(parsed.data.communication.mutedTypes
              ? { mutedTypes: parsed.data.communication.mutedTypes }
              : {}),
            whatsappConsent: false,
            smsConsent: false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    return GET();
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 },
    );
  }
}
