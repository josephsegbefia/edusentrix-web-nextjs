// src/app/api/parent/messages/[threadId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { MessageThread } from "@/models/MessageThread";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { Student } from "@/models/Student";

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
    }).lean();

    if (!thread) {
      return NextResponse.json(
        { success: false, error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await Message.find({ threadId: (thread as any)._id })
      .sort({ createdAt: 1 })
      .lean();

    // Get user details
    const userIds = new Set<string>();
    messages.forEach((m: any) => userIds.add(String(m.senderId)));
    (thread as any).participants.forEach((p: any) => userIds.add(String(p.userId)));

    const users = await User.find({ _id: { $in: Array.from(userIds) } })
      .select("_id firstName lastName photoUrl")
      .lean();
    const userMap = new Map(
      users.map((u: any) => [
        String(u._id),
        { name: `${u.firstName || ""} ${u.lastName || ""}`.trim(), photoUrl: u.photoUrl },
      ])
    );

    // Get student name if applicable
    let studentName = null;
    if ((thread as any).studentId) {
      const student = await Student.findById((thread as any).studentId)
        .select("firstName lastName")
        .lean();
      if (student) {
        studentName = `${(student as any).firstName || ""} ${(student as any).lastName || ""}`.trim();
      }
    }

    // Mark messages as read
    await Message.updateMany(
      {
        threadId: (thread as any)._id,
        senderId: { $ne: context.userId },
        "readBy.userId": { $ne: context.userId },
      },
      {
        $push: { readBy: { userId: context.userId, readAt: new Date() } },
      }
    );

    // Format response
    const formattedThread = {
      id: String((thread as any)._id),
      subject: (thread as any).subject || "No Subject",
      studentId: (thread as any).studentId ? String((thread as any).studentId) : null,
      studentName,
      participants: (thread as any).participants.map((p: any) => ({
        userId: String(p.userId),
        role: p.role,
        ...userMap.get(String(p.userId)),
      })),
      createdAt: (thread as any).createdAt?.toISOString() || "",
    };

    const formattedMessages = messages.map((m: any) => ({
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
    const { message } = body;

    if (!message?.trim()) {
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
    }).lean();

    if (!thread) {
      return NextResponse.json(
        { success: false, error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    // Create message
    const newMessage = await Message.create({
      threadId: (thread as any)._id,
      schoolId: context.schoolId,
      senderId: context.userId,
      body: message.trim(),
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
        id: String(newMessage._id),
        senderId: String(context.userId),
        body: newMessage.body,
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
