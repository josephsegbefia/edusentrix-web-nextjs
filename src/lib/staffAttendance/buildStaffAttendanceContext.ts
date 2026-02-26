// src/lib/staffAttendance/buildStaffAttendanceContext.ts
/**
 * Builds a compact string summary of staff attendance for a date for LLM prompts.
 */
import mongoose from "mongoose";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { Teacher } from "@/models/Teacher";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function buildStaffAttendanceContext(
  schoolId: string | mongoose.Types.ObjectId,
  dateStr: string
): Promise<string> {
  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const startDate = startOfDay(new Date(dateStr));
  const endDate = endOfDay(new Date(dateStr));

  const teachersRaw = await Teacher.find({
    schoolId: schoolIdObj,
    status: { $in: ["active", "on_leave"] },
  })
    .select("_id userId department status")
    .lean();

  const teacherIds = teachersRaw.map((t: { _id: mongoose.Types.ObjectId }) => t._id);

  const attendanceRecords = await TeacherAttendance.find({
    schoolId: schoolIdObj,
    teacherId: { $in: teacherIds },
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  const attendanceMap = new Map<string, { status: string }>();
  for (const record of attendanceRecords) {
    const key = `${String(record.teacherId)}_${startOfDay(new Date(record.date)).toISOString()}`;
    attendanceMap.set(key, { status: record.status });
  }

  const dateKey = startOfDay(startDate).toISOString();
  let present = 0;
  let absent = 0;
  let late = 0;
  let onLeave = 0;
  let other = 0;
  let notRecorded = 0;

  for (const teacher of teachersRaw) {
    const key = `${String(teacher._id)}_${dateKey}`;
    const att = attendanceMap.get(key);
    if (!att) {
      notRecorded++;
    } else if (att.status === "present") {
      present++;
    } else if (att.status === "absent") {
      absent++;
    } else if (att.status === "late") {
      late++;
    } else if (att.status === "on_leave" || att.status === "sick") {
      onLeave++;
    } else {
      other++;
    }
  }

  const total = teachersRaw.length;
  const parts: string[] = [
    `[Staff Attendance] Date: ${dateStr}`,
    `Total: ${total} | Present: ${present} | Absent: ${absent} | Late: ${late} | On Leave: ${onLeave} | Other: ${other} | Not Recorded: ${notRecorded}`,
  ];

  const pctRecorded = total > 0 ? Math.round(((total - notRecorded) / total) * 100) : 0;
  parts.push(`Recording coverage: ${pctRecorded}%`);

  if (notRecorded > 0) {
    parts.push(`Action needed: ${notRecorded} teacher(s) without attendance recorded`);
  }
  if (absent > 0) {
    parts.push(`Absences: ${absent}`);
  }
  if (late > 0) {
    parts.push(`Late arrivals: ${late}`);
  }

  return parts.join("\n");
}
