import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { School } from "@/models/School";
import { TeacherSettings } from "@/models/TeacherSettings";
import { User } from "@/models/User";
import { evaluateTeacherWhatsAppPolicy } from "@/lib/notifications/teacher-whatsapp-policy";

export async function POST() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const [settingsRaw, userRaw, schoolRaw] = await Promise.all([
      TeacherSettings.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
      }),
      User.findById(context.userId)
        .select("firstName lastName email phone")
        .lean(),
      School.findById(context.schoolId).select("name").lean(),
    ]);

    const settings = Array.isArray(settingsRaw) ? settingsRaw[0] : settingsRaw;
    const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
    const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;

    if (!settings) {
      return Response.json(
        {
          success: false,
          error: "Teacher settings not found. Save your settings first.",
        },
        { status: 404 }
      );
    }

    const policy = await evaluateTeacherWhatsAppPolicy({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      feature: "noticeBroadcasts",
      requireFeatureFlag: false,
      honorQuietHours: false,
    });

    if (!policy.allowed) {
      return Response.json(
        {
          success: false,
          error: policy.message,
          code: policy.reason,
        },
        { status: 400 }
      );
    }

    const teacherName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

    const result = await sendWhatsAppMessage(policy.phoneNumber, "TEACHER_POWERTOOLS_TEST", {
      teacher_name: teacherName || user?.email || "Teacher",
      school_name: school?.name || "School",
      sent_at: new Date().toISOString(),
    });

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error || "Failed to queue test message" },
        { status: 500 }
      );
    }

    if (settings) {
      settings.whatsapp.lastTestMessageAt = new Date();
      await settings.save();
    }

    return Response.json({
      success: true,
      data: {
        sent: true,
        phone: policy.phoneNumber,
        templateId: "TEACHER_POWERTOOLS_TEST",
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to send WhatsApp test message:", e);
    const message = e instanceof Error ? e.message : "Failed to send test message";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
