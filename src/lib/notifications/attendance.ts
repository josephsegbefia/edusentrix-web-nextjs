import mongoose from "mongoose";
import { StudentAttendance } from "@/models/StudentAttendance";
import type { AttendanceStatus, AttendanceType } from "@/models/StudentAttendance";
import { SchoolSettings } from "@/models/SchoolSettings";

export async function queueAttendanceNotification(input: {
  schoolId: mongoose.Types.ObjectId | string;
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  type?: AttendanceType;
  notificationsEnabled?: boolean;
}): Promise<boolean> {
  const { schoolId, studentId, date, status, type = "homeroom", notificationsEnabled } = input;

  if (status !== "absent" && status !== "late") return false;

  let schoolIdObj: mongoose.Types.ObjectId | null = null;
  try {
    schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
  } catch {
    schoolIdObj = null;
  }

  const settingsEnabled =
    notificationsEnabled ??
    (await (async () => {
      if (!schoolIdObj) return true;
      const settings = await SchoolSettings.findOne({ schoolId: schoolIdObj })
        .select("attendanceNotifications")
        .lean();
      const enabled =
        (settings as { attendanceNotifications?: { enabled?: boolean } } | null)
          ?.attendanceNotifications?.enabled ?? true;
      const channels =
        (settings as {
          attendanceNotifications?: { channels?: { whatsapp?: boolean; sms?: boolean; email?: boolean } };
        } | null)?.attendanceNotifications?.channels;
      const hasChannel = channels ? Object.values(channels).some(Boolean) : true;
      return enabled && hasChannel;
    })());

  if (!settingsEnabled) return false;

  // Phase 5 will implement actual sending
  console.log(`[NOTIFICATION STUB] ${status} notification for ${studentId}`);

  await StudentAttendance.updateOne(
    { studentId, date, type, ...(schoolIdObj ? { schoolId: schoolIdObj } : {}) },
    { $set: { notificationSent: true, notificationSentAt: new Date() } }
  );

  return true;
}
