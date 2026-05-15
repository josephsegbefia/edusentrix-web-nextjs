import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailThread } from "@/models/EmailThread";

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("email");
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const result = await EmailThread.aggregate<{ unreadCount: number }>([
      {
        $match: {
          mailboxScope: "school",
          schoolId: schoolIdObj,
          status: { $ne: "archived" },
          unreadCountSchool: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          unreadCount: { $sum: "$unreadCountSchool" },
        },
      },
    ]);

    return Response.json({
      success: true,
      data: { unreadCount: result[0]?.unreadCount ?? 0 },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch unread email count";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
