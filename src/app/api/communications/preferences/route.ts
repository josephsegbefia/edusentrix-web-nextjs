import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { resolveSchoolActorContext } from "@/lib/auth/resolveSchoolActorContext";
import { CommunicationPreference } from "@/models/CommunicationPreference";

const PreferenceSchema = z.object({
  allowedChannels: z.array(z.enum(["in_app", "email", "whatsapp", "sms"])).min(1).optional(),
  mutedTypes: z.array(z.enum(["notice", "announcement", "direct_message", "fee_reminder", "attendance_alert", "academic_update", "lesson_update", "exam_notice", "event_notice", "emergency_alert", "video_meeting_invite", "newsletter", "system_alert"])).optional(),
  whatsappConsent: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().trim().max(8).optional().nullable(),
    end: z.string().trim().max(8).optional().nullable(),
  }).optional(),
});

function serializePreference(doc: any) {
  return {
    allowedChannels: doc.allowedChannels ?? ["in_app", "email"],
    mutedTypes: doc.mutedTypes ?? [],
    whatsappConsent: Boolean(doc.whatsappConsent),
    smsConsent: Boolean(doc.smsConsent),
    quietHours: doc.quietHours ?? { enabled: false, start: null, end: null },
  };
}

export async function GET() {
  try {
    const ctx = await resolveSchoolActorContext();
    await connectToDatabase();
    const preference = await CommunicationPreference.findOne({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
    }).lean();
    return Response.json({
      success: true,
      data: preference
        ? serializePreference(preference)
        : {
            allowedChannels: ["in_app", "email"],
            mutedTypes: [],
            whatsappConsent: false,
            smsConsent: false,
            quietHours: { enabled: false, start: null, end: null },
          },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load preferences" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await resolveSchoolActorContext();
    await connectToDatabase();
    const parsed = PreferenceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    const preference = await CommunicationPreference.findOneAndUpdate(
      { schoolId: ctx.schoolId, userId: ctx.userId },
      { $set: parsed.data },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
    return Response.json({ success: true, data: serializePreference(preference) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to update preferences" }, { status: 500 });
  }
}
