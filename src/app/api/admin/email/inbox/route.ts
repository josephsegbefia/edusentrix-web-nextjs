import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailThread } from "@/models/EmailThread";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || "open";
    const threadType = searchParams.get("type") || null;
    const mailboxType = searchParams.get("mailbox") || null;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      mailboxScope: "school",
      schoolId: schoolIdObj,
    };

    if (status && status !== "all") {
      filter.status = status;
    }

    if (threadType) {
      filter.threadType = threadType;
    }

    if (mailboxType === "billing") {
      filter.mailboxKey = { $regex: `:billing$` };
    } else if (mailboxType === "general") {
      filter.mailboxKey = { $regex: `:general$` };
    }

    const [threads, total] = await Promise.all([
      EmailThread.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailThread.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: threads.map((t) => ({
        _id: String(t._id),
        subject: t.subject,
        threadType: t.threadType,
        status: t.status,
        participants: t.participants,
        lastMessageAt: t.lastMessageAt?.toISOString(),
        lastInboundAt: t.lastInboundAt?.toISOString() || null,
        lastOutboundAt: t.lastOutboundAt?.toISOString() || null,
        unreadCount: t.unreadCountSchool,
        relatedEntityType: t.relatedEntityType,
        relatedEntityId: t.relatedEntityId,
        mailboxKey: t.mailboxKey,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch inbox";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
