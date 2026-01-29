import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { MessageThread } from "@/models/MessageThread";
import { Student } from "@/models/Student";
import { User } from "@/models/User";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ threadId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.messagesView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { threadId } = await ctx.params;
    const threadObjId = toObjectIdOrNull(threadId);
    if (!threadObjId) {
      return Response.json({ success: false, error: "Invalid thread id" }, { status: 400 });
    }

    const thread = await MessageThread.findOne({
      _id: threadObjId,
      schoolId: context.schoolId,
      "participants.userId": context.userId,
    }).lean();

    if (!thread) {
      return Response.json({ success: false, error: "Thread not found" }, { status: 404 });
    }

    const student = thread.studentId
      ? await Student.findById(thread.studentId).select("_id firstName lastName").lean()
      : null;

    const userIds = Array.from(new Set(thread.participants.map((p) => String(p.userId)))).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const users = await User.find({ _id: { $in: userIds } })
      .select("_id firstName lastName email name")
      .lean();

    const userMap = new Map(
      users.map((user: any) => [
        String(user._id),
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || user.email,
      ])
    );

    return Response.json({
      success: true,
      data: {
        thread: {
          id: String(thread._id),
          subject: thread.subject || undefined,
          student: student
            ? { id: String(student._id), name: `${student.firstName} ${student.lastName}`.trim() }
            : null,
          participants: thread.participants.map((participant) => ({
            id: String(participant.userId),
            role: participant.role,
            name: userMap.get(String(participant.userId)) || participant.role,
          })),
          lastMessageAt: thread.lastMessageAt ? thread.lastMessageAt.toISOString() : null,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch thread:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch thread";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
