import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailThread } from "@/models/EmailThread";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid thread ID" }, { status: 400 });
    }

    const thread = await EmailThread.findOne({
      _id: new mongoose.Types.ObjectId(id),
      mailboxScope: "school",
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
    }).lean();

    if (!thread) {
      return Response.json({ success: false, error: "Thread not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: {
        _id: String(thread._id),
        subject: thread.subject,
        threadType: thread.threadType,
        status: thread.status,
        participants: thread.participants,
        lastMessageAt: thread.lastMessageAt?.toISOString(),
        lastInboundAt: thread.lastInboundAt?.toISOString() || null,
        lastOutboundAt: thread.lastOutboundAt?.toISOString() || null,
        unreadCount: thread.unreadCountSchool,
        relatedEntityType: thread.relatedEntityType,
        relatedEntityId: thread.relatedEntityId,
        mailboxKey: thread.mailboxKey,
        routingToken: thread.routingToken,
        createdAt: thread.createdAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch thread";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid thread ID" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.status && ["open", "closed", "archived"].includes(body.status)) {
      updates.status = body.status;
    }

    if (body.markRead === true) {
      updates.unreadCountSchool = 0;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: "No valid updates" }, { status: 400 });
    }

    const thread = await EmailThread.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        mailboxScope: "school",
        schoolId: new mongoose.Types.ObjectId(String(schoolId)),
      },
      { $set: updates },
      { new: true },
    ).lean();

    if (!thread) {
      return Response.json({ success: false, error: "Thread not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: { _id: String(thread._id), status: thread.status } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to update thread";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
