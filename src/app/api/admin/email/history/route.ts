import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailMessage } from "@/models/EmailMessage";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);

    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const recipientEmail = searchParams.get("email");
    const direction = searchParams.get("direction") as "inbound" | "outbound" | null;
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      schoolId: schoolIdObj,
    };

    if (entityType && entityId) {
      filter.relatedEntityType = entityType;
      filter.relatedEntityId = entityId;
    }

    if (recipientEmail) {
      filter.$or = [
        { to: recipientEmail.toLowerCase().trim() },
        { from: recipientEmail.toLowerCase().trim() },
      ];
    }

    if (direction) {
      filter.direction = direction;
    }

    if (status) {
      filter.status = status;
    }

    const [messages, total] = await Promise.all([
      EmailMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id direction from fromName to subject status sentAt receivedAt createdAt templateKey messageClass trafficClass failureReason skipReason",
        )
        .lean(),
      EmailMessage.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: messages.map((m) => ({
        _id: String(m._id),
        direction: m.direction,
        from: m.from,
        fromName: m.fromName || null,
        to: m.to,
        subject: m.subject,
        status: m.status,
        sentAt: m.sentAt?.toISOString() || null,
        receivedAt: m.receivedAt?.toISOString() || null,
        createdAt: m.createdAt.toISOString(),
        templateKey: m.templateKey,
        messageClass: m.messageClass,
        trafficClass: m.trafficClass,
        failureReason: m.failureReason || null,
        skipReason: m.skipReason || null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch email history";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
