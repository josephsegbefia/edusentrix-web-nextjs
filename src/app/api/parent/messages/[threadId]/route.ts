// src/app/api/parent/messages/[threadId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { MessageThread } from "@/models/MessageThread";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { Student } from "@/models/Student";

type ThreadParticipant = {
  userId: mongoose.Types.ObjectId;
  role: string;
};

type MessageThreadRow = {
  _id: mongoose.Types.ObjectId;
  subject?: string;
  studentId?: mongoose.Types.ObjectId | null;
  participants: ThreadParticipant[];
  createdAt?: Date;
};

type MessageRow = {
  _id: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  body: string;
  attachments?: unknown[];
  createdAt?: Date;
};

type UserRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
};

type StudentRow = {
  firstName?: string;
  lastName?: string;
};

type MessageAttachmentInput = {
  name?: unknown;
  url?: unknown;
  type?: unknown;
  size?: unknown;
  key?: unknown;
  customId?: unknown;
};

function buildPreview(value: string, limit = 100) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}...`;
}

function normalizeAttachment(
  value: MessageAttachmentInput
): {
  name: string;
  url: string;
  type: string;
  size?: number;
  key?: string;
  customId?: string | null;
} | null {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const type = typeof value.type === "string" ? value.type.trim() : "";

  if (!name || !url || !type) return null;

  let size: number | undefined;
  if (typeof value.size === "number" && Number.isFinite(value.size) && value.size >= 0) {
    size = value.size;
  } else if (typeof value.size === "string") {
    const parsed = Number(value.size);
    if (Number.isFinite(parsed) && parsed >= 0) {
      size = parsed;
    }
  }

  const key = typeof value.key === "string" && value.key.trim().length > 0 ? value.key.trim() : undefined;
  const customId =
    typeof value.customId === "string"
      ? value.customId.trim() || null
      : value.customId === null
      ? null
      : undefined;

  return {
    name,
    url,
    type,
    ...(typeof size === "number" ? { size } : {}),
    ...(key ? { key } : {}),
    ...(customId !== undefined ? { customId } : {}),
  };
}

function sanitizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  const sanitized = value
    .map((item) => (item && typeof item === "object" ? normalizeAttachment(item as MessageAttachmentInput) : null))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return sanitized.slice(0, 6);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ threadId: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { threadId } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return NextResponse.json(
        { success: false, error: "Invalid thread ID" },
        { status: 400 }
      );
    }

    // Verify user is participant
    const thread = await MessageThread.findOne({
      _id: new mongoose.Types.ObjectId(threadId),
      schoolId: context.schoolId,
      "participants.userId": context.userId,
    }).lean<MessageThreadRow | null>();

    if (!thread) {
      return NextResponse.json(
        { success: false, error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await Message.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .lean<MessageRow[]>();

    // Get user details
    const userIds = new Set<string>();
    messages.forEach((m) => userIds.add(String(m.senderId)));
    thread.participants.forEach((p) => userIds.add(String(p.userId)));

    const users = await User.find({ _id: { $in: Array.from(userIds) } })
      .select("_id firstName lastName photoUrl")
      .lean<UserRow[]>();
    const userMap = new Map(
      users.map((u) => [
        String(u._id),
        {
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
          photoUrl: u.photoUrl || null,
        },
      ])
    );

    // Get student name if applicable
    let studentName = null;
    if (thread.studentId) {
      const student = await Student.findById(thread.studentId)
        .select("firstName lastName")
        .lean<StudentRow | null>();
      if (student) {
        studentName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
      }
    }

    // Mark messages as read
    await Message.updateMany(
      {
        threadId: thread._id,
        senderId: { $ne: context.userId },
        "readBy.userId": { $ne: context.userId },
      },
      {
        $push: { readBy: { userId: context.userId, readAt: new Date() } },
      }
    );

    // Format response
    const formattedThread = {
      id: String(thread._id),
      subject: thread.subject || "No Subject",
      studentId: thread.studentId ? String(thread.studentId) : null,
      studentName,
      participants: thread.participants.map((p) => ({
        userId: String(p.userId),
        role: p.role,
        ...userMap.get(String(p.userId)),
      })),
      createdAt: thread.createdAt?.toISOString() || "",
    };

    const formattedMessages = messages.map((m) => ({
      id: String(m._id),
      senderId: String(m.senderId),
      senderName: userMap.get(String(m.senderId))?.name || "Unknown",
      senderPhotoUrl: userMap.get(String(m.senderId))?.photoUrl || null,
      isOwn: String(m.senderId) === String(context.userId),
      body: m.body,
      attachments: m.attachments || [],
      createdAt: m.createdAt?.toISOString() || "",
    }));

    return NextResponse.json({
      success: true,
      data: {
        thread: formattedThread,
        messages: formattedMessages,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch thread:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch thread" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ threadId: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { threadId } = await ctx.params;
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const attachments = sanitizeAttachments(body?.attachments);

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return NextResponse.json(
        { success: false, error: "Invalid thread ID" },
        { status: 400 }
      );
    }

    // Verify user is participant
    const thread = await MessageThread.findOne({
      _id: new mongoose.Types.ObjectId(threadId),
      schoolId: context.schoolId,
      "participants.userId": context.userId,
    }).lean<MessageThreadRow | null>();

    if (!thread) {
      return NextResponse.json(
        { success: false, error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    // Create message
    const newMessage = await Message.create({
      threadId: thread._id,
      schoolId: context.schoolId,
      senderId: context.userId,
      body: message,
      attachments,
      readBy: [{ userId: context.userId, readAt: new Date() }],
    });

    // Update thread
    await MessageThread.findByIdAndUpdate(thread._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: buildPreview(message),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(newMessage._id),
        senderId: String(context.userId),
        body: newMessage.body,
        attachments: newMessage.attachments || [],
        createdAt: newMessage.createdAt?.toISOString() || "",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
