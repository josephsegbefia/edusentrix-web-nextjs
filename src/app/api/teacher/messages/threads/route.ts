import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Guardian } from "@/models/Guardian";
import { Message } from "@/models/Message";
import { MessageThread } from "@/models/MessageThread";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";

const ThreadCreateSchema = z.object({
  studentId: z.string().min(1),
  subject: z.string().max(160).optional(),
  message: z.string().min(1).max(5000),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function buildPreview(value: string, limit = 120) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}...`;
}

type StudentNameLean = {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
};

type UserNameLean = {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  name?: string | null;
};

type UnreadAggRow = {
  _id: mongoose.Types.ObjectId;
  count: number;
};

type GuardianParticipantLean = {
  userId?: mongoose.Types.ObjectId | null;
};

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.messagesView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const threads = await MessageThread.find({
      schoolId: context.schoolId,
      "participants.userId": context.userId,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    if (threads.length === 0) {
      return Response.json({ success: true, data: { threads: [] } });
    }

    const threadIds = threads.map((thread) => thread._id);
    const studentIds = threads.map((thread) => thread.studentId).filter(Boolean) as mongoose.Types.ObjectId[];

    const [students, users, unreadAgg] = await Promise.all([
      studentIds.length
        ? Student.find({ _id: { $in: studentIds } })
            .select("_id firstName lastName")
            .lean<StudentNameLean[]>()
        : Promise.resolve([]),
      User.find({
        _id: {
          $in: Array.from(
            new Set(threads.flatMap((thread) => thread.participants.map((p) => String(p.userId))))
          ).map((id) => new mongoose.Types.ObjectId(id)),
        },
      })
        .select("_id firstName lastName email name")
        .lean<UserNameLean[]>(),
      Message.aggregate([
        {
          $match: {
            threadId: { $in: threadIds },
            schoolId: context.schoolId,
            senderId: { $ne: context.userId },
            readBy: { $not: { $elemMatch: { userId: context.userId } } },
          },
        },
        { $group: { _id: "$threadId", count: { $sum: 1 } } },
      ]),
    ]);

    const studentMap = new Map(
      students.map((student) => [
        String(student._id),
        `${student.firstName || ""} ${student.lastName || ""}`.trim(),
      ])
    );

    const userMap = new Map(
      users.map((user) => [
        String(user._id),
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || user.email,
      ])
    );

    const unreadMap = new Map(
      (unreadAgg as UnreadAggRow[]).map((row) => [String(row._id), row.count])
    );

    return Response.json({
      success: true,
      data: {
        threads: threads.map((thread) => ({
          id: String(thread._id),
          subject: thread.subject || undefined,
          student: thread.studentId
            ? { id: String(thread.studentId), name: studentMap.get(String(thread.studentId)) || "" }
            : null,
          participants: thread.participants
            .filter((participant) => String(participant.userId) !== String(context.userId))
            .map((participant) => ({
              id: String(participant.userId),
              role: participant.role,
              name: userMap.get(String(participant.userId)) || participant.role,
            })),
          lastMessageAt: thread.lastMessageAt ? thread.lastMessageAt.toISOString() : null,
          lastMessagePreview: thread.lastMessagePreview || "",
          unreadCount: unreadMap.get(String(thread._id)) || 0,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch message threads:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch message threads";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.messagesSend)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = ThreadCreateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const studentObjId = toObjectIdOrNull(parsed.data.studentId);
    if (!studentObjId) {
      return Response.json({ success: false, error: "Invalid student" }, { status: 400 });
    }

    const student = await Student.findOne({
      _id: studentObjId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId userId")
      .lean();

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    if (!context.isAdmin) {
      const isHomeroom = context.homeroomClassGroupId
        ? String(context.homeroomClassGroupId) === String(student.classGroupId)
        : false;

      if (!isHomeroom) {
        const period = await AcademicPeriod.findOne({
          schoolId: context.schoolId,
          isCurrent: true,
        })
          .select("_id")
          .lean();

        if (!period) {
          return Response.json(
            { success: false, error: "No active academic period" },
            { status: 400 }
          );
        }

        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          classGroupId: student.classGroupId,
          academicPeriodId: period._id,
          status: "active",
        })
          .select("_id")
          .lean();

        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const guardians = await Guardian.find({ studentId: studentObjId })
      .select("userId")
      .lean<GuardianParticipantLean[]>();

    const participantMap = new Map<string, { userId: mongoose.Types.ObjectId; role: "teacher" | "parent" | "student" }>();

    participantMap.set(String(context.userId), { userId: context.userId, role: "teacher" });

    guardians.forEach((guardian) => {
      if (!guardian.userId) return;
      participantMap.set(String(guardian.userId), { userId: guardian.userId, role: "parent" });
    });

    if (student.userId) {
      participantMap.set(String(student.userId), { userId: student.userId, role: "student" });
    }

    if (participantMap.size <= 1) {
      return Response.json(
        { success: false, error: "No recipients found for this student" },
        { status: 400 }
      );
    }

    const now = new Date();

    const thread = await MessageThread.create({
      schoolId: context.schoolId,
      studentId: studentObjId,
      subject: parsed.data.subject?.trim() || undefined,
      participants: Array.from(participantMap.values()),
      lastMessageAt: now,
      lastMessagePreview: buildPreview(parsed.data.message),
      createdBy: context.userId,
    });

    await Message.create({
      threadId: thread._id,
      schoolId: context.schoolId,
      senderId: context.userId,
      body: parsed.data.message,
      attachments: [],
      readBy: [{ userId: context.userId, readAt: now }],
    });

    return Response.json({ success: true, data: { threadId: String(thread._id) } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create message thread:", e);
    const message = e instanceof Error ? e.message : "Failed to create message thread";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
