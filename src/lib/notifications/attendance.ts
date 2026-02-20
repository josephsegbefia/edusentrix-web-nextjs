import mongoose from "mongoose";
import { StudentAttendance } from "@/models/StudentAttendance";
import type { AttendanceStatus, AttendanceType } from "@/models/StudentAttendance";
import { SchoolSettings } from "@/models/SchoolSettings";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import {
  evaluateTeacherWhatsAppPolicy,
  normalizePhone,
} from "@/lib/notifications/teacher-whatsapp-policy";

function toObjectIdOrNull(value: string | mongoose.Types.ObjectId) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

export async function queueAttendanceNotification(input: {
  schoolId: mongoose.Types.ObjectId | string;
  teacherId: mongoose.Types.ObjectId | string;
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  type?: AttendanceType;
  periodNumber?: number;
  notificationsEnabled?: boolean;
  whatsappChannelEnabled?: boolean;
}): Promise<boolean> {
  const {
    schoolId,
    teacherId,
    studentId,
    date,
    status,
    type = "homeroom",
    periodNumber,
    notificationsEnabled,
    whatsappChannelEnabled,
  } = input;

  if (status !== "absent" && status !== "late") return false;

  const schoolIdObj = toObjectIdOrNull(schoolId);
  const studentIdObj = toObjectIdOrNull(studentId);
  if (!studentIdObj) return false;

  const schoolWhatsAppEnabled =
    whatsappChannelEnabled ??
    notificationsEnabled ??
    (await (async () => {
      if (!schoolIdObj) return true;
      const settings = await SchoolSettings.findOne({ schoolId: schoolIdObj })
        .select("attendanceNotifications")
        .lean();
      const enabled =
        (settings as { attendanceNotifications?: { enabled?: boolean } } | null)
          ?.attendanceNotifications?.enabled ?? true;
      const whatsappEnabled =
        (settings as {
          attendanceNotifications?: { channels?: { whatsapp?: boolean } };
        } | null)?.attendanceNotifications?.channels?.whatsapp ?? true;
      return enabled && whatsappEnabled;
    })());

  const policy = await evaluateTeacherWhatsAppPolicy({
    schoolId,
    teacherId,
    feature: "attendanceAlerts",
    schoolChannelEnabled: schoolWhatsAppEnabled,
    at: new Date(),
  });
  if (!policy.allowed) {
    console.info("Attendance WhatsApp notification skipped", {
      studentId,
      reason: policy.reason,
    });
    return false;
  }

  const [studentRaw, guardians] = await Promise.all([
    Student.findById(studentIdObj).select("firstName lastName").lean(),
    Guardian.find({ studentId: studentIdObj, phone: { $nin: [null, ""] } })
      .select("phone")
      .lean(),
  ]);

  const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
  const studentName =
    [student?.firstName, student?.lastName].filter(Boolean).join(" ").trim() ||
    "Student";
  const attendanceDate = date.toISOString().split("T")[0];

  const recipientPhones = Array.from(
    new Set(
      guardians
        .map((guardian) => normalizePhone(guardian.phone || null))
        .filter((phone): phone is string => Boolean(phone))
    )
  );

  if (recipientPhones.length === 0) return false;

  const sendResults = await Promise.all(
    recipientPhones.map((phone) =>
      sendWhatsAppMessage(phone, "ATTENDANCE_ALERT", {
        student_name: studentName,
        attendance_status: status,
        attendance_type: type,
        attendance_date: attendanceDate,
      })
    )
  );

  const sentCount = sendResults.filter((result) => result.success).length;
  if (sentCount === 0) return false;

  const filter: Record<string, unknown> = {
    studentId: studentIdObj,
    date,
    type,
    ...(schoolIdObj ? { schoolId: schoolIdObj } : {}),
  };
  if (type === "period" && typeof periodNumber === "number") {
    filter.periodNumber = periodNumber;
  }

  await StudentAttendance.updateOne(filter, {
    $set: { notificationSent: true, notificationSentAt: new Date() },
  });

  return true;
}
