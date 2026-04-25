import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailThread } from "@/models/EmailThread";
import { EmailMessage } from "@/models/EmailMessage";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid thread ID" }, { status: 400 });
    }

    const thread = await EmailThread.findOne({
      _id: new mongoose.Types.ObjectId(id),
      mailboxScope: "platform",
    }).lean();

    if (!thread) {
      return NextResponse.json({ success: false, error: "Thread not found" }, { status: 404 });
    }

    const messages = await EmailMessage.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .select(
        "_id direction from fromName to subject htmlBody textBody status sentAt receivedAt createdAt templateKey messageClass attachments",
      )
      .lean();

    await EmailThread.findByIdAndUpdate(thread._id, {
      $set: { unreadCountPlatform: 0 },
    });

    return NextResponse.json({
      success: true,
      data: {
        thread: {
          _id: String(thread._id),
          subject: thread.subject,
          threadType: thread.threadType,
          status: thread.status,
          participants: thread.participants,
          lastMessageAt: thread.lastMessageAt?.toISOString(),
          schoolId: thread.schoolId ? String(thread.schoolId) : null,
          mailboxKey: thread.mailboxKey,
          routingToken: thread.routingToken,
          createdAt: thread.createdAt.toISOString(),
        },
        messages: messages.map((m) => ({
          _id: String(m._id),
          direction: m.direction,
          from: m.from,
          fromName: m.fromName || null,
          to: m.to,
          subject: m.subject,
          htmlBody: m.htmlBody,
          textBody: m.textBody,
          status: m.status,
          sentAt: m.sentAt?.toISOString() || null,
          receivedAt: m.receivedAt?.toISOString() || null,
          createdAt: m.createdAt.toISOString(),
          attachments: m.attachments || [],
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch thread";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid thread ID" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.status && ["open", "closed", "archived"].includes(body.status)) {
      updates.status = body.status;
    }

    if (body.markRead === true) {
      updates.unreadCountPlatform = 0;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "No valid updates" }, { status: 400 });
    }

    const thread = await EmailThread.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        mailboxScope: "platform",
      },
      { $set: updates },
      { new: true },
    ).lean();

    if (!thread) {
      return NextResponse.json({ success: false, error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { _id: String(thread._id), status: thread.status },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to update thread";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
