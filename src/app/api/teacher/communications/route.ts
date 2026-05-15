import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { ClassGroup } from "@/models/ClassGroup";
import { Communication } from "@/models/Communication";
import { serializeCommunication } from "@/lib/communications/api/serialize";

const TeacherCommunicationSchema = z.object({
  title: z.string().trim().min(1).max(220),
  bodyHtml: z.string().min(1),
  bodyText: z.string().trim().min(1),
  type: z.enum(["notice", "announcement", "academic_update", "lesson_update", "exam_notice", "event_notice"]).default("notice"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  channels: z.array(z.enum(["in_app", "email"])).min(1).default(["in_app", "email"]),
  classGroupIds: z.array(z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), "Invalid class group id")).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

async function teacherClassGroups(schoolId: mongoose.Types.ObjectId, teacherId: mongoose.Types.ObjectId) {
  return ClassGroup.find({ schoolId, homeroomTeacherId: teacherId, isActive: true })
    .select("_id name gradeId")
    .lean<Array<{ _id: mongoose.Types.ObjectId; name: string; gradeId: mongoose.Types.ObjectId }>>();
}

function normalizeAudience(doc: any) {
  const audience = doc.audience || {};
  return {
    ...audience,
    classGroupIds: Array.isArray(audience.classGroupIds)
      ? audience.classGroupIds.map((id: unknown) => String(id))
      : undefined,
    gradeIds: Array.isArray(audience.gradeIds)
      ? audience.gradeIds.map((id: unknown) => String(id))
      : undefined,
    userIds: Array.isArray(audience.userIds)
      ? audience.userIds.map((id: unknown) => String(id))
      : undefined,
  };
}

function serializeTeacherCommunication(doc: any) {
  return {
    ...serializeCommunication(doc),
    audience: normalizeAudience(doc),
  };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdminOrTeacherRead();
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 12)));
    const query: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (ctx.teacherId) query.createdByUserId = ctx.userId;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { bodyText: { $regex: search, $options: "i" } },
      ];
    }
    const [items, total] = await Promise.all([
      Communication.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Communication.countDocuments(query),
    ]);
    return Response.json({
      success: true,
      data: {
        items: items.map(serializeTeacherCommunication),
        pagination: {
          total,
          limit,
          page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load communications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdminOrTeacherRead();
    if (!ctx.teacherId) {
      return Response.json({ success: false, error: "Teacher record is required" }, { status: 403 });
    }
    await connectToDatabase();
    const parsed = TeacherCommunicationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const classGroups = await teacherClassGroups(ctx.schoolId, ctx.teacherId);
    const allowedIds = new Set(classGroups.map((group) => String(group._id)));
    const selectedIds = parsed.data.classGroupIds?.length
      ? parsed.data.classGroupIds.filter((id) => allowedIds.has(id))
      : Array.from(allowedIds);

    if (selectedIds.length === 0) {
      return Response.json(
        { success: false, error: "No homeroom class is available for this teacher communication" },
        { status: 400 },
      );
    }

    const communication = await Communication.create({
      schoolId: ctx.schoolId,
      createdByUserId: ctx.userId,
      senderRole: "teacher",
      title: parsed.data.title,
      bodyHtml: parsed.data.bodyHtml,
      bodyText: parsed.data.bodyText,
      type: parsed.data.type,
      priority: parsed.data.priority,
      channels: parsed.data.channels,
      status: parsed.data.scheduledFor ? "scheduled" : "draft",
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
      allowReplies: true,
      audience: {
        type: "class_groups",
        classGroupIds: selectedIds.map((id) => new mongoose.Types.ObjectId(id)),
        targetRoles: ["parent"],
      },
      metadata: {
        scopedBy: "teacher_homeroom",
        teacherId: String(ctx.teacherId),
      },
    });
    return Response.json({ success: true, data: serializeCommunication(communication) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to create teacher communication" }, { status: 500 });
  }
}
