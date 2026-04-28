import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailThread } from "@/models/EmailThread";
import { EmailMessage } from "@/models/EmailMessage";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("email");
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid thread ID" }, { status: 400 });
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const thread = await EmailThread.findOne({
      _id: new mongoose.Types.ObjectId(id),
      mailboxScope: "school",
      schoolId: schoolIdObj,
    })
      .select("_id")
      .lean();

    if (!thread) {
      return Response.json({ success: false, error: "Thread not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      EmailMessage.find({ threadId: thread._id })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id direction from fromName to subject htmlBody textBody status sentAt receivedAt createdAt templateKey messageClass providerMessageId failureReason attachments",
        )
        .lean(),
      EmailMessage.countDocuments({ threadId: thread._id }),
    ]);

    await EmailThread.findByIdAndUpdate(thread._id, {
      $set: { unreadCountSchool: 0 },
    });

    return Response.json({
      success: true,
      data: messages.map((m) => ({
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
        templateKey: m.templateKey,
        messageClass: m.messageClass,
        attachments: m.attachments || [],
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch messages";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
