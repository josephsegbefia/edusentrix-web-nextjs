import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Guardian } from "@/models/Guardian";
import { Notice } from "@/models/Notice";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.noticesPublish)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const noticeId = toObjectIdOrNull(id);
    if (!noticeId) {
      return Response.json({ success: false, error: "Invalid notice id" }, { status: 400 });
    }

    const query: Record<string, unknown> = { _id: noticeId, schoolId: context.schoolId };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const notice = await Notice.findOne(query).lean();
    if (!notice) {
      return Response.json({ success: false, error: "Notice not found" }, { status: 404 });
    }

    const now = new Date();
    await Notice.updateOne(
      { _id: noticeId },
      { $set: { status: "published", publishedAt: now, scheduledFor: null } }
    );

    if (notice.audience === "custom" && notice.targetStudentIds?.length) {
      const guardians = await Guardian.find({
        studentId: { $in: notice.targetStudentIds },
        phone: { $ne: null },
      })
        .select("phone")
        .lean();

      const phoneSet = new Set(
        guardians.map((g: any) => (g.phone ? String(g.phone) : null)).filter(Boolean)
      );

      await Promise.all(
        Array.from(phoneSet).map((phone) =>
          sendWhatsAppMessage(
            phone,
            "NOTICE_BROADCAST",
            {
              notice_title: notice.title,
              notice_body: notice.message,
              notice_id: String(notice._id),
            }
          ).catch(() => null)
        )
      );
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to publish notice:", e);
    const message = e instanceof Error ? e.message : "Failed to publish notice";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
