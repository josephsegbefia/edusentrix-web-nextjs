import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Message } from "@/models/Message";
import { MessageThread } from "@/models/MessageThread";
import { User } from "@/models/User";

const MessageCreateSchema = z.object({
  body: z.string().min(1).max(5000),
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

type UserNameLean = {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  name?: string | null;
};

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
    })
      .select("_id")
      .lean();

    if (!thread) {
      return Response.json({ success: false, error: "Thread not found" }, { status: 404 });
    }

    const messages = await Message.find({
      threadId: threadObjId,
      schoolId: context.schoolId,
    })
      .sort({ createdAt: 1 })
      .lean();

    const senderIds = Array.from(new Set(messages.map((msg) => String(msg.senderId)))).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const users = await User.find({ _id: { $in: senderIds } })
      .select("_id firstName lastName email name")
      .lean<UserNameLean[]>();

    const userMap = new Map(
      users.map((user) => [
        String(user._id),
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || user.email,
      ])
    );

    await Message.updateMany(
      {
        threadId: threadObjId,
        schoolId: context.schoolId,
        senderId: { $ne: context.userId },
        readBy: { $not: { $elemMatch: { userId: context.userId } } },
      },
      { $push: { readBy: { userId: context.userId, readAt: new Date() } } }
    );

    return Response.json({
      success: true,
      data: {
        messages: messages.map((msg) => ({
          id: String(msg._id),
          body: msg.body,
          senderId: String(msg.senderId),
          senderName: userMap.get(String(msg.senderId)) || "Unknown",
          createdAt: msg.createdAt ? msg.createdAt.toISOString() : null,
          isMine: String(msg.senderId) === String(context.userId),
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch messages:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch messages";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.messagesSend)) {
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
    })
      .select("_id")
      .lean();

    if (!thread) {
      return Response.json({ success: false, error: "Thread not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = MessageCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const now = new Date();

    const message = await Message.create({
      threadId: threadObjId,
      schoolId: context.schoolId,
      senderId: context.userId,
      body: parsed.data.body,
      attachments: [],
      readBy: [{ userId: context.userId, readAt: now }],
    });

    await MessageThread.updateOne(
      { _id: threadObjId },
      { $set: { lastMessageAt: now, lastMessagePreview: buildPreview(parsed.data.body) } }
    );

    return Response.json({
      success: true,
      data: {
        messageId: String(message._id),
        createdAt: message.createdAt ? message.createdAt.toISOString() : null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to send message:", e);
    const message = e instanceof Error ? e.message : "Failed to send message";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
