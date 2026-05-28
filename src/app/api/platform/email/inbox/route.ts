import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailThread } from "@/models/EmailThread";

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const mailbox = searchParams.get("mailbox") || "support";
    const status = searchParams.get("status") || "open";
    const threadType = searchParams.get("type") || null;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      mailboxScope: "platform",
    };

    if (mailbox === "billing") {
      filter.mailboxKey = "platform_billing";
    } else if (mailbox === "support") {
      filter.mailboxKey = "platform_support";
    } else {
      filter.mailboxKey = "platform_hello";
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    if (threadType) {
      filter.threadType = threadType;
    }

    const [threads, total] = await Promise.all([
      EmailThread.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailThread.countDocuments(filter),
    ]);

    return NextResponse.json({
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
        unreadCount: t.unreadCountPlatform,
        schoolId: t.schoolId ? String(t.schoolId) : null,
        relatedEntityType: t.relatedEntityType,
        relatedEntityId: t.relatedEntityId,
        mailboxKey: t.mailboxKey,
        createdAt: t.createdAt?.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch platform inbox";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
