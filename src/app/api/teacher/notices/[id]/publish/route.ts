import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Guardian } from "@/models/Guardian";
import { Notice } from "@/models/Notice";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { evaluateTeacherWhatsAppPolicy } from "@/lib/notifications/teacher-whatsapp-policy";

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

    let whatsappSent = 0;
    let whatsappSkippedReason: string | null = null;

    if (notice.audience === "custom" && notice.targetStudentIds?.length) {
      const policy = await evaluateTeacherWhatsAppPolicy({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        feature: "noticeBroadcasts",
      });

      if (!policy.allowed) {
        whatsappSkippedReason = policy.message;
      }

      if (policy.allowed) {
        const guardians = await Guardian.find({
          studentId: { $in: notice.targetStudentIds },
          phone: { $ne: null },
        })
          .select("phone")
          .lean();

        const phoneSet = new Set(
          guardians
            .map((guardian) => (guardian.phone ? String(guardian.phone) : null))
            .filter((phone): phone is string => Boolean(phone))
        );

        if (phoneSet.size === 0) {
          whatsappSkippedReason = "No guardian WhatsApp numbers available.";
        }

        const deliveryResults = await Promise.all(
          Array.from(phoneSet).map((phone) =>
            sendWhatsAppMessage(phone, "NOTICE_BROADCAST", {
              notice_title: notice.title,
              notice_body: notice.message,
              notice_id: String(notice._id),
            }).catch(() => ({ success: false, mode: "stub" as const }))
          )
        );
        whatsappSent = deliveryResults.filter((result) => result.success).length;
        if (deliveryResults.length > 0 && whatsappSent === 0 && !whatsappSkippedReason) {
          whatsappSkippedReason = "WhatsApp delivery failed for all recipients.";
        }
      }
    }

    return Response.json({
      success: true,
      data: {
        whatsappSent,
        whatsappSkippedReason,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to publish notice:", e);
    const message = e instanceof Error ? e.message : "Failed to publish notice";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
