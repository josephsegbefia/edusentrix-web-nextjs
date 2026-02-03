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
import { Teacher } from "@/models/Teacher";

export async function GET(req: NextRequest) {
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
      .lean();

    // Get participant user details
    const userIds = new Set<string>();
    const studentIds = new Set<string>();

    threads.forEach((t: any) => {
      t.participants.forEach((p: any) => userIds.add(String(p.userId)));
      if (t.studentId) studentIds.add(String(t.studentId));
    });

    const users = await User.find({ _id: { $in: Array.from(userIds) } })
      .select("_id firstName lastName photoUrl")
      .lean();
    const userMap = new Map(
      users.map((u: any) => [String(u._id), { name: `${u.firstName || ""} ${u.lastName || ""}`.trim(), photoUrl: u.photoUrl }])
    );

    const students = await Student.find({ _id: { $in: Array.from(studentIds) } })
      .select("_id firstName lastName")
      .lean();
    const studentMap = new Map(
      students.map((s: any) => [String(s._id), `${s.firstName || ""} ${s.lastName || ""}`.trim()])
    );

    // Count unread messages per thread
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          threadId: { $in: threads.map((t: any) => t._id) },
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
    const formattedThreads = threads.map((t: any) => {
      const otherParticipants = t.participants
        .filter((p: any) => String(p.userId) !== String(context.userId))
        .map((p: any) => ({
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
      threadId: { $in: threads.map((t: any) => t._id) },
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

    const body = await req.json();
    const { recipientId, recipientRole, studentId, subject, message } = body;

    if (!recipientId || !message) {
      return NextResponse.json(
        { success: false, error: "Recipient and message are required" },
        { status: 400 }
      );
    }

    // Verify the parent has access to the student if specified
    if (studentId) {
      const guardian = await Guardian.findOne({
        userId: context.userId,
        studentId: new mongoose.Types.ObjectId(studentId),
      }).lean();

      if (!guardian) {
        return NextResponse.json(
          { success: false, error: "You don't have access to this student" },
          { status: 403 }
        );
      }
    }

    // Check for existing thread with same participants
    let thread = await MessageThread.findOne({
      schoolId: context.schoolId,
      "participants.userId": { $all: [context.userId, new mongoose.Types.ObjectId(recipientId)] },
      studentId: studentId ? new mongoose.Types.ObjectId(studentId) : { $exists: false },
    }).lean();

    if (!thread) {
      // Create new thread
      const newThread = await MessageThread.create({
        schoolId: context.schoolId,
        studentId: studentId ? new mongoose.Types.ObjectId(studentId) : undefined,
        subject: subject || "New Conversation",
        participants: [
          { userId: context.userId, role: "parent" },
          { userId: new mongoose.Types.ObjectId(recipientId), role: recipientRole || "teacher" },
        ],
        createdBy: context.userId,
        lastMessageAt: new Date(),
        lastMessagePreview: message.substring(0, 100),
      });
      thread = newThread.toObject();
    }

    // Create message
    const newMessage = await Message.create({
      threadId: (thread as any)._id,
      schoolId: context.schoolId,
      senderId: context.userId,
      body: message,
      readBy: [{ userId: context.userId, readAt: new Date() }],
    });

    // Update thread
    await MessageThread.findByIdAndUpdate((thread as any)._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: message.substring(0, 100),
    });

    return NextResponse.json({
      success: true,
      data: {
        threadId: String((thread as any)._id),
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
