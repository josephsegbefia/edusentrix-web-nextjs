import { StudentAttendance } from "@/models/StudentAttendance";
import type { AttendanceStatus, AttendanceType } from "@/models/StudentAttendance";

export async function queueAttendanceNotification(input: {
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  type?: AttendanceType;
}) {
  const { studentId, date, status, type = "homeroom" } = input;

  if (status !== "absent" && status !== "late") return;

  // Phase 5 will implement actual sending
  console.log(`[NOTIFICATION STUB] ${status} notification for ${studentId}`);

  await StudentAttendance.updateOne(
    { studentId, date, type },
    { $set: { notificationSent: true, notificationSentAt: new Date() } }
  );
}
