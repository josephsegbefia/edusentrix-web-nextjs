import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Message } from "@/models/Message";
import { MessageThread } from "@/models/MessageThread";

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.messagesView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const threads = await MessageThread.find({
      schoolId: context.schoolId,
      "participants.userId": context.userId,
    })
      .select("_id")
      .lean();

    if (threads.length === 0) {
      return Response.json({ success: true, data: { unread: 0 } });
    }

    const threadIds = threads.map((thread) => thread._id);

    const unreadAgg = await Message.aggregate([
      {
        $match: {
          threadId: { $in: threadIds },
          schoolId: context.schoolId,
          senderId: { $ne: context.userId },
          readBy: { $not: { $elemMatch: { userId: context.userId } } },
        },
      },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]);

    return Response.json({
      success: true,
      data: { unread: unreadAgg[0]?.count || 0 },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch unread messages:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch unread messages";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
