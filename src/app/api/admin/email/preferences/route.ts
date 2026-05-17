import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailPreference } from "@/models/EmailPreference";
import { CommunicationPreference } from "@/models/CommunicationPreference";
import type { CommunicationChannel, CommunicationType } from "@/lib/communications/types";

const EMAIL_CATEGORY_TYPES: Record<string, CommunicationType[]> = {
  attendance: ["attendance_alert"],
  academics: ["academic_update", "lesson_update", "exam_notice"],
  announcements: ["notice", "announcement", "event_notice", "newsletter"],
  billingReminders: ["fee_reminder"],
  manualMessages: ["direct_message"],
  lessonNoteReview: ["lesson_update", "system_alert"],
};

const UpdatePreferenceSchema = z.object({
  channels: z
    .object({
      email: z.boolean().optional(),
      inApp: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      sms: z.boolean().optional(),
    })
    .optional(),
  email: z
    .object({
      immediate: z
        .object({
          attendance: z.boolean().optional(),
          academics: z.boolean().optional(),
          announcements: z.boolean().optional(),
          billingReminders: z.boolean().optional(),
          manualMessages: z.boolean().optional(),
          lessonNoteReview: z.boolean().optional(),
        })
        .optional(),
      digest: z
        .object({
          daily: z.boolean().optional(),
          weekly: z.boolean().optional(),
        })
        .optional(),
      urgentOnly: z.boolean().optional(),
      quietHours: z
        .object({
          enabled: z.boolean().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
        })
        .optional(),
      optOutCategories: z.array(z.string()).optional(),
    })
    .optional(),
});

function buildCommunicationPreferencePatch(input: {
  channels?: {
    email?: boolean;
    inApp?: boolean;
  };
  immediate?: Record<string, boolean | undefined>;
  urgentOnly?: boolean;
  quietHours?: {
    enabled?: boolean;
    startTime?: string;
    endTime?: string;
  };
}) {
  const set: Record<string, unknown> = {
    whatsappConsent: false,
    smsConsent: false,
  };

  if (input.channels) {
    const allowedChannels: CommunicationChannel[] = [];
    if (input.channels.inApp !== false) allowedChannels.push("in_app");
    if (input.channels.email !== false) allowedChannels.push("email");
    set.allowedChannels = allowedChannels;
  }

  if (input.immediate) {
    const emailMutedTypes = Object.entries(input.immediate).flatMap(([key, enabled]) => {
      if (enabled !== false) return [];
      return EMAIL_CATEGORY_TYPES[key] ?? [];
    });
    set.mutedTypes = [];
    set.channelMutedTypes = {
      in_app: [],
      email: Array.from(new Set(emailMutedTypes)),
    };
  }

  if (typeof input.urgentOnly !== "undefined") {
    set.emailUrgentOnly = input.urgentOnly;
  }

  if (input.quietHours) {
    set.quietHours = {
      enabled: Boolean(input.quietHours.enabled),
      start: input.quietHours.startTime ?? null,
      end: input.quietHours.endTime ?? null,
    };
  }

  return set;
}

export async function GET(_req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const preference = await EmailPreference.findOne({
      userId: String(userId),
      schoolId: String(schoolId),
    }).lean();

    if (!preference) {
      return Response.json({
        success: true,
        data: null,
      });
    }

    return Response.json({
      success: true,
      data: {
        _id: String(preference._id),
        channels: preference.channels,
        email: preference.email,
        updatedAt: preference.updatedAt?.toISOString(),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch preferences";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const parsed = UpdatePreferenceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    const updates: Record<string, unknown> = {};

    if (parsed.data.channels) {
      for (const [key, val] of Object.entries(parsed.data.channels)) {
        if (val !== undefined) updates[`channels.${key}`] = val;
      }
    }

    if (parsed.data.email?.immediate) {
      for (const [key, val] of Object.entries(parsed.data.email.immediate)) {
        if (val !== undefined) updates[`email.immediate.${key}`] = val;
      }
    }

    if (parsed.data.email?.digest) {
      for (const [key, val] of Object.entries(parsed.data.email.digest)) {
        if (val !== undefined) updates[`email.digest.${key}`] = val;
      }
    }

    if (parsed.data.email?.urgentOnly !== undefined) {
      updates["email.urgentOnly"] = parsed.data.email.urgentOnly;
    }

    if (parsed.data.email?.quietHours) {
      for (const [key, val] of Object.entries(parsed.data.email.quietHours)) {
        if (val !== undefined) updates[`email.quietHours.${key}`] = val;
      }
    }

    if (parsed.data.email?.optOutCategories) {
      updates["email.optOutCategories"] = parsed.data.email.optOutCategories;
    }

    const communicationPatch = buildCommunicationPreferencePatch({
      channels: parsed.data.channels,
      immediate: parsed.data.email?.immediate,
      urgentOnly: parsed.data.email?.urgentOnly,
      quietHours: parsed.data.email?.quietHours,
    });
    if (
      Array.isArray(communicationPatch.allowedChannels) &&
      communicationPatch.allowedChannels.length === 0
    ) {
      return Response.json(
        { success: false, error: "Keep at least one delivery channel enabled." },
        { status: 400 },
      );
    }

    const preference = await EmailPreference.findOneAndUpdate(
      { userId: String(userId), schoolId: schoolIdObj },
      {
        $set: updates,
        $setOnInsert: {
          userId: String(userId),
          schoolId: schoolIdObj,
          role: "school_admin",
        },
      },
      { new: true, upsert: true },
    ).lean();

    await CommunicationPreference.findOneAndUpdate(
      { userId: userIdObj, schoolId: schoolIdObj },
      { $set: communicationPatch },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return Response.json({
      success: true,
      data: {
        _id: String(preference._id),
        channels: preference.channels,
        email: preference.email,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to update preferences";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
