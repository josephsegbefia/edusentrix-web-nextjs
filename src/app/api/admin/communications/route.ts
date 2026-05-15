import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Communication } from "@/models/Communication";
import { serializeCommunication } from "@/lib/communications/api/serialize";

const objectIdString = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid id",
});

const ChannelSchema = z.enum(["in_app", "email"]);
const AudienceSchema = z.object({
  type: z.enum([
    "entire_school",
    "parents",
    "students",
    "teachers",
    "staff",
    "grades",
    "class_groups",
    "custom_users",
    "custom_contacts",
  ]),
  gradeIds: z.array(objectIdString).optional(),
  classGroupIds: z.array(objectIdString).optional(),
  userIds: z.array(objectIdString).optional(),
  targetRoles: z.array(z.enum(["parent", "student", "teacher", "staff", "school_admin", "bursar", "external"])).optional(),
  externalContacts: z.array(z.object({
    name: z.string().trim().max(160).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().max(40).optional(),
    whatsappPhone: z.string().trim().max(40).optional(),
    role: z.enum(["parent", "student", "teacher", "staff", "school_admin", "bursar", "external"]).optional(),
  })).optional(),
});

const CreateCommunicationSchema = z.object({
  type: z.enum([
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
  ]).default("notice"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  title: z.string().trim().min(1).max(220),
  bodyHtml: z.string().min(1),
  bodyText: z.string().trim().min(1),
  channels: z.array(ChannelSchema).min(1).default(["in_app"]),
  audience: AudienceSchema,
  scheduledFor: z.string().datetime().optional().nullable(),
  allowReplies: z.boolean().default(false),
  actionUrl: z.string().trim().max(500).optional().nullable(),
  templateId: objectIdString.optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function objectIdArray(values?: string[]) {
  return values?.map((value) => new mongoose.Types.ObjectId(value));
}

function normalizeAudience(audience: z.infer<typeof AudienceSchema>) {
  return {
    ...audience,
    gradeIds: objectIdArray(audience.gradeIds),
    classGroupIds: objectIdArray(audience.classGroupIds),
    userIds: objectIdArray(audience.userIds),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("communications");
    await connectToDatabase();

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));

    const query: Record<string, unknown> = { schoolId };
    if (status && status !== "all") query.status = status;
    if (q) query.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const [items, total] = await Promise.all([
      Communication.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Communication.countDocuments(query),
    ]);

    return Response.json({
      success: true,
      data: {
        items: items.map(serializeCommunication),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load communications" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "communications.create",
    ]);
    await connectToDatabase();

    const parsed = CreateCommunicationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const communication = await Communication.create({
      schoolId,
      ...parsed.data,
      audience: normalizeAudience(parsed.data.audience),
      templateId: parsed.data.templateId ? new mongoose.Types.ObjectId(parsed.data.templateId) : null,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
      createdByUserId: userId,
      status: parsed.data.scheduledFor ? "scheduled" : "draft",
    });

    return Response.json({ success: true, data: serializeCommunication(communication) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create communication" },
      { status: 500 },
    );
  }
}
