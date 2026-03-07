// src/app/api/parent/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { MessageThread } from "@/models/MessageThread";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { UserMembership } from "@/models/UserMembership";

type ThreadParticipant = {
  userId: mongoose.Types.ObjectId;
  role: string;
};

type MessageThreadRow = {
  _id: mongoose.Types.ObjectId;
  subject?: string;
  studentId?: mongoose.Types.ObjectId | null;
  participants: ThreadParticipant[];
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  createdAt?: Date;
};

type UserRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
};

type StudentRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
};

type UnreadCountRow = {
  _id: mongoose.Types.ObjectId;
  count: number;
};

type CreateMessageBody = {
  recipientId?: string;
  recipientRole?: string;
  studentId?: string;
  subject?: string;
  message?: string;
  attachments?: unknown;
};

type MessageAttachmentInput = {
  name?: unknown;
  url?: unknown;
  type?: unknown;
  size?: unknown;
  key?: unknown;
  customId?: unknown;
};

type RecipientRole = "teacher" | "school_admin" | "bursar" | "staff";

type RecipientMembershipRow = {
  roles?: string[];
};

type RecipientUserRow = {
  _id: mongoose.Types.ObjectId;
  schoolId?: mongoose.Types.ObjectId | null;
  role?: string;
};

const recipientRolePriority: RecipientRole[] = [
  "teacher",
  "school_admin",
  "bursar",
  "staff",
];

function normalizeRecipientRole(value: unknown): RecipientRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "teacher" ||
    normalized === "school_admin" ||
    normalized === "bursar" ||
    normalized === "staff"
  ) {
    return normalized;
  }
  return null;
}

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

function chooseRecipientRole(
  requestedRole: RecipientRole | null,
  membership: RecipientMembershipRow | null,
  user: RecipientUserRow
): RecipientRole | null {
  const roleSet = new Set<string>();
  membership?.roles?.forEach((role) => roleSet.add(role));
  if (typeof user.role === "string") roleSet.add(user.role);

  if (requestedRole && roleSet.has(requestedRole)) {
    return requestedRole;
  }

  for (const role of recipientRolePriority) {
    if (roleSet.has(role)) return role;
  }

  return null;
}

export async function GET() {
  try {
    const context = await requireParent();
    await connectToDatabase();

    // Get threads where user is a participant
    const threads = await MessageThread.find({
      schoolId: context.schoolId,
      "participants.userId": context.userId,
    })
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .lean<MessageThreadRow[]>();

    // Get participant user details
    const userIds = new Set<string>();
    const studentIds = new Set<string>();

    threads.forEach((t) => {
      t.participants.forEach((p) => userIds.add(String(p.userId)));
      if (t.studentId) studentIds.add(String(t.studentId));
    });

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

    const students = await Student.find({ _id: { $in: Array.from(studentIds) } })
      .select("_id firstName lastName")
      .lean<StudentRow[]>();
    const studentMap = new Map(
      students.map((s) => [String(s._id), `${s.firstName || ""} ${s.lastName || ""}`.trim()])
    );

    // Count unread messages per thread
    const unreadCounts = await Message.aggregate<UnreadCountRow>([
      {
        $match: {
          threadId: { $in: threads.map((t) => t._id) },
          "readBy.userId": { $ne: context.userId },
          senderId: { $ne: context.userId },
        },
      },
      {
        $group: {
          _id: "$threadId",
          count: { $sum: 1 },
        },
      },
    ]);
    const unreadMap = new Map(unreadCounts.map((u) => [String(u._id), u.count]));

    // Format threads
    const formattedThreads = threads.map((t) => {
      const otherParticipants = t.participants
        .filter((p) => String(p.userId) !== String(context.userId))
        .map((p) => ({
          userId: String(p.userId),
          role: p.role,
          ...userMap.get(String(p.userId)),
        }));

      return {
        id: String(t._id),
        subject: t.subject || "No Subject",
        studentId: t.studentId ? String(t.studentId) : null,
        studentName: t.studentId ? studentMap.get(String(t.studentId)) : null,
        participants: otherParticipants,
        lastMessageAt: t.lastMessageAt?.toISOString() || null,
        lastMessagePreview: t.lastMessagePreview || null,
        unreadCount: unreadMap.get(String(t._id)) || 0,
        createdAt: t.createdAt?.toISOString() || "",
      };
    });

    // Get total unread count
    const totalUnread = await Message.countDocuments({
      threadId: { $in: threads.map((t) => t._id) },
      "readBy.userId": { $ne: context.userId },
      senderId: { $ne: context.userId },
    });

    return NextResponse.json({
      success: true,
      data: {
        threads: formattedThreads,
        totalUnread,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent messages:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const body = (await req.json()) as CreateMessageBody;
    const { recipientId, recipientRole, studentId, subject, message } = body;
    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    const normalizedRecipientRole = normalizeRecipientRole(recipientRole);
    const attachments = sanitizeAttachments(body.attachments);

    if (!recipientId || !trimmedMessage) {
      return NextResponse.json(
        { success: false, error: "Recipient and message are required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return NextResponse.json(
        { success: false, error: "Invalid recipient ID" },
        { status: 400 }
      );
    }

    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);
    const recipientUser = await User.findOne({
      _id: recipientObjectId,
      schoolId: context.schoolId,
    })
      .select("_id schoolId role")
      .lean<RecipientUserRow | null>();

    if (!recipientUser) {
      return NextResponse.json(
        { success: false, error: "Recipient not found in your school" },
        { status: 404 }
      );
    }

    const recipientMembership = await UserMembership.findOne({
      userId: recipientObjectId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("roles")
      .lean<RecipientMembershipRow | null>();

    const finalRecipientRole = chooseRecipientRole(
      normalizedRecipientRole,
      recipientMembership,
      recipientUser
    );

    if (!finalRecipientRole) {
      return NextResponse.json(
        {
          success: false,
          error: "Recipient must be a teacher, school admin, bursar, or staff member",
        },
        { status: 400 }
      );
    }

    // Verify the parent has access to the student if specified
    let studentObjectId: mongoose.Types.ObjectId | undefined;
    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return NextResponse.json(
          { success: false, error: "Invalid student ID" },
          { status: 400 }
        );
      }

      studentObjectId = new mongoose.Types.ObjectId(studentId);

      const guardian = await Guardian.findOne({
        userId: context.userId,
        studentId: studentObjectId,
      })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId } | null>();

      if (!guardian) {
        return NextResponse.json(
          { success: false, error: "You don't have access to this student" },
          { status: 403 }
        );
      }
    }

    // Check for existing thread with same participants
    const threadQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      "participants.userId": { $all: [context.userId, recipientObjectId] },
    };
    if (studentObjectId) {
      threadQuery.studentId = studentObjectId;
    } else {
      threadQuery.$or = [{ studentId: { $exists: false } }, { studentId: null }];
    }

    const thread = await MessageThread.findOne({
      ...threadQuery,
    }).lean<MessageThreadRow | null>();

    let threadId: mongoose.Types.ObjectId;

    if (!thread) {
      // Create new thread
      const newThread = await MessageThread.create({
        schoolId: context.schoolId,
        studentId: studentObjectId,
        subject: typeof subject === "string" && subject.trim().length > 0 ? subject.trim() : "New Conversation",
        participants: [
          { userId: context.userId, role: "parent" },
          { userId: recipientObjectId, role: finalRecipientRole },
        ],
        createdBy: context.userId,
        lastMessageAt: new Date(),
        lastMessagePreview: buildPreview(trimmedMessage),
      });
      threadId = newThread._id;
    } else {
      threadId = thread._id;
    }

    // Create message
    const newMessage = await Message.create({
      threadId,
      schoolId: context.schoolId,
      senderId: context.userId,
      body: trimmedMessage,
      attachments,
      readBy: [{ userId: context.userId, readAt: new Date() }],
    });

    // Update thread
    await MessageThread.findByIdAndUpdate(threadId, {
      lastMessageAt: new Date(),
      lastMessagePreview: buildPreview(trimmedMessage),
    });

    return NextResponse.json({
      success: true,
      data: {
        threadId: String(threadId),
        messageId: String(newMessage._id),
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
