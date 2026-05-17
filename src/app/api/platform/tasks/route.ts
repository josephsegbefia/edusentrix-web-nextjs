import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PLATFORM_TASK_CATEGORIES, PLATFORM_TASK_STATUSES } from "@/lib/platform/tasks/constants";
import { PlatformTask } from "@/models/PlatformTask";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import { School } from "@/models/School";

const CreateTaskSchema = z.object({
  schoolId: z.string().trim().optional().nullable().default(null),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional().nullable().default(null),
  category: z.enum(PLATFORM_TASK_CATEGORIES),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.enum(PLATFORM_TASK_STATUSES).default("todo"),
  assignedToUserId: z.string().trim().optional().nullable().default(null),
  dueAt: z.string().trim().optional().nullable().default(null),
});

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.implementation.read");
    if (!gate.ok) return gate.res;

    await connectToDatabase();
    const tasks = await PlatformTask.find({})
      .sort({ status: 1, priority: -1, dueAt: 1, createdAt: -1 })
      .limit(200)
      .lean();

    const schoolIds = Array.from(new Set(tasks.map((task) => (task.schoolId ? String(task.schoolId) : "")).filter(Boolean)));
    const userIds = Array.from(new Set(tasks.map((task) => (task.assignedToUserId ? String(task.assignedToUserId) : "")).filter(Boolean)));

    const [schools, staffProfiles] = await Promise.all([
      schoolIds.length
        ? School.find({ _id: { $in: schoolIds } }).select("name").lean<Array<{ _id: unknown; name?: string }>>()
        : [],
      userIds.length
        ? PlatformStaffProfile.find({ userId: { $in: userIds } }).select("userId fullName email").lean<Array<{ userId: unknown; fullName: string; email: string }>>()
        : [],
    ]);

    const schoolMap = new Map(schools.map((school) => [String(school._id), school.name || "Unnamed School"]));
    const staffMap = new Map(staffProfiles.map((profile) => [String(profile.userId), profile]));

    return NextResponse.json({
      success: true,
      data: {
        tasks: tasks.map((task) => {
          const assignee = task.assignedToUserId ? staffMap.get(String(task.assignedToUserId)) : null;
          return {
            id: String(task._id),
            schoolId: task.schoolId ? String(task.schoolId) : null,
            schoolName: task.schoolId ? schoolMap.get(String(task.schoolId)) || "Unnamed School" : null,
            title: task.title,
            description: task.description || null,
            category: task.category,
            priority: task.priority,
            status: task.status,
            assignedToUserId: task.assignedToUserId ? String(task.assignedToUserId) : null,
            assignedToName: assignee?.fullName || null,
            dueAt: task.dueAt?.toISOString() || null,
            checklistCount: task.checklist?.length || 0,
            createdAt: task.createdAt.toISOString(),
          };
        }),
      },
    });
  } catch (error) {
    console.error("[platform/tasks:GET]", error);
    return NextResponse.json({ success: false, error: "Failed to load platform tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.implementation.assignTasks");
    if (!gate.ok) return gate.res;

    const parsed = CreateTaskSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid task payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const schoolId =
      input.schoolId && mongoose.Types.ObjectId.isValid(input.schoolId)
        ? new mongoose.Types.ObjectId(input.schoolId)
        : null;
    const assignedToUserId =
      input.assignedToUserId && mongoose.Types.ObjectId.isValid(input.assignedToUserId)
        ? new mongoose.Types.ObjectId(input.assignedToUserId)
        : null;

    await connectToDatabase();
    const task = await PlatformTask.create({
      schoolId,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: input.status,
      assignedToUserId,
      assignedByUserId: gate.actor.userId,
      dueAt: parseOptionalDate(input.dueAt),
    });

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      schoolId,
      action: "platform.task.created",
      entityType: "PlatformTask",
      entityId: task._id,
      metadata: {
        title: task.title,
        category: task.category,
        priority: task.priority,
        assignedToUserId: assignedToUserId ? String(assignedToUserId) : null,
      },
    });

    return NextResponse.json({ success: true, data: { id: String(task._id) } });
  } catch (error) {
    console.error("[platform/tasks:POST]", error);
    return NextResponse.json({ success: false, error: "Failed to create platform task" }, { status: 500 });
  }
}
