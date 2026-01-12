// src/app/api/admin/teachers/attendance/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { Teacher } from "@/models/Teacher";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";
import { z } from "zod";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

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

/**
 * GET /api/admin/teachers/attendance
 * Get attendance records for all teachers for a specific date or date range
 * Query params: date (required), status, department
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const statusFilter = searchParams.get("status") as
      | "present"
      | "absent"
      | "late"
      | "on_leave"
      | "sick"
      | "other"
      | null;
    const departmentFilter = searchParams.get("department");

    // Build date range
    let startDate: Date;
    let endDate: Date;

    if (dateStr) {
      // Single date query
      startDate = startOfDay(new Date(dateStr));
      endDate = endOfDay(new Date(dateStr));
    } else if (startDateStr && endDateStr) {
      startDate = startOfDay(new Date(startDateStr));
      endDate = endOfDay(new Date(endDateStr));
    } else {
      // Default to today
      startDate = startOfDay(new Date());
      endDate = endOfDay(new Date());
    }

    // Get all active teachers for this school
    const teacherQuery: Record<string, unknown> = {
      schoolId: schoolIdObj,
      status: { $in: ["active", "on_leave"] },
    };

    if (departmentFilter) {
      teacherQuery.department = departmentFilter;
    }

    const teachersRaw = await Teacher.find(teacherQuery)
      .select("_id userId department photoUrl status")
      .populate("userId", "firstName lastName email photoUrl")
      .lean();

    // Sort teachers by last name, then first name
    const teachers = (teachersRaw || []).sort((a: any, b: any) => {
      const aUser = a.userId || {};
      const bUser = b.userId || {};
      const aLastName = (aUser.lastName || "").toLowerCase();
      const bLastName = (bUser.lastName || "").toLowerCase();
      const aFirstName = (aUser.firstName || "").toLowerCase();
      const bFirstName = (bUser.firstName || "").toLowerCase();

      if (aLastName !== bLastName) {
        return aLastName.localeCompare(bLastName);
      }
      return aFirstName.localeCompare(bFirstName);
    });

    const teacherIds = teachers.map((t: any) => t._id);

    // Get attendance records for these teachers in the date range
    const attendanceQuery: Record<string, unknown> = {
      schoolId: schoolIdObj,
      teacherId: { $in: teacherIds },
      date: { $gte: startDate, $lte: endDate },
    };

    if (statusFilter) {
      attendanceQuery.status = statusFilter;
    }

    const attendanceRecords = await TeacherAttendance.find(attendanceQuery)
      .populate("recordedBy", "firstName lastName email")
      .lean();

    // Create a map of attendance by teacher and date
    const attendanceMap = new Map<string, any>();
    for (const record of attendanceRecords) {
      const key = `${String(record.teacherId)}_${startOfDay(new Date(record.date)).toISOString()}`;
      attendanceMap.set(key, record);
    }

    // Build response with all teachers and their attendance status
    const dateKey = startOfDay(startDate).toISOString();
    const data = teachers.map((teacher: any) => {
      const key = `${String(teacher._id)}_${dateKey}`;
      const attendance = attendanceMap.get(key);

      // Extract user data from populated userId
      const user = teacher.userId || {};
      const firstName = user.firstName || "";
      const lastName = user.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim() || user.email || "Unknown Teacher";

      return {
        teacherId: String(teacher._id),
        firstName: firstName,
        lastName: lastName,
        fullName: fullName,
        email: user.email || null,
        department: teacher.department || null,
        photoUrl: user.photoUrl || teacher.photoUrl || null,
        teacherStatus: teacher.status,
        attendance: attendance
          ? {
              id: String(attendance._id),
              date: new Date(attendance.date).toISOString(),
              status: attendance.status,
              checkInTime: attendance.checkInTime
                ? new Date(attendance.checkInTime).toISOString()
                : null,
              checkOutTime: attendance.checkOutTime
                ? new Date(attendance.checkOutTime).toISOString()
                : null,
              minutesLate: attendance.minutesLate ?? null,
              leaveType: attendance.leaveType ?? null,
              reason: attendance.reason ?? null,
              notes: attendance.notes ?? null,
              recordedBy: attendance.recordedBy
                ? {
                    id: String(attendance.recordedBy._id),
                    name: `${attendance.recordedBy.firstName || ""} ${attendance.recordedBy.lastName || ""}`.trim(),
                  }
                : null,
            }
          : null,
      };
    });

    // Calculate summary stats
    const summary = {
      total: teachers.length,
      present: data.filter((t) => t.attendance?.status === "present").length,
      absent: data.filter((t) => t.attendance?.status === "absent").length,
      late: data.filter((t) => t.attendance?.status === "late").length,
      onLeave: data.filter(
        (t) =>
          t.attendance?.status === "on_leave" || t.attendance?.status === "sick"
      ).length,
      notRecorded: data.filter((t) => !t.attendance).length,
    };

    return Response.json({
      success: true,
      date: startDate.toISOString().split("T")[0],
      data,
      summary,
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

const BulkRecordAttendanceSchema = z.object({
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  records: z.array(
    z.object({
      teacherId: z.string().min(1),
      status: z.enum(["present", "absent", "late", "on_leave", "sick", "other"]),
      checkInTime: z.string().datetime().optional().nullable(),
      checkOutTime: z.string().datetime().optional().nullable(),
      minutesLate: z.number().min(0).optional().nullable(),
      leaveType: z
        .enum(["sick", "vacation", "personal", "professional", "other"])
        .optional()
        .nullable(),
      reason: z.string().max(500).optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
    })
  ),
});

/**
 * POST /api/admin/teachers/attendance
 * Bulk record attendance for multiple teachers
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Parse and validate body
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = BulkRecordAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { date, records } = parsed.data;
    const attendanceDate = startOfDay(new Date(date));

    // Validate teacher IDs
    const teacherIds = records.map((r) => toObjectIdOrNull(r.teacherId));
    if (teacherIds.some((id) => !id)) {
      return Response.json(
        { error: "One or more invalid teacher IDs" },
        { status: 400 }
      );
    }

    // Process each record - upsert to handle both create and update
    const results: { teacherId: string; action: "created" | "updated" }[] = [];
    const errors: { teacherId: string; error: string }[] = [];

    for (const record of records) {
      const teacherObjId = toObjectIdOrNull(record.teacherId);
      if (!teacherObjId) {
        errors.push({ teacherId: record.teacherId, error: "Invalid teacher ID" });
        continue;
      }

      try {
        const existing = await TeacherAttendance.findOne({
          teacherId: teacherObjId,
          schoolId: schoolIdObj,
          date: attendanceDate,
        });

        if (existing) {
          // Update existing record
          await TeacherAttendance.updateOne(
            { _id: existing._id },
            {
              $set: {
                status: record.status,
                checkInTime: record.checkInTime
                  ? new Date(record.checkInTime)
                  : undefined,
                checkOutTime: record.checkOutTime
                  ? new Date(record.checkOutTime)
                  : undefined,
                minutesLate: record.minutesLate ?? undefined,
                leaveType: record.leaveType ?? undefined,
                reason: record.reason ?? undefined,
                notes: record.notes ?? undefined,
                recordedBy: adminUserId
                  ? new mongoose.Types.ObjectId(String(adminUserId))
                  : undefined,
              },
            }
          );
          results.push({ teacherId: record.teacherId, action: "updated" });
        } else {
          // Create new record
          await TeacherAttendance.create({
            teacherId: teacherObjId,
            schoolId: schoolIdObj,
            date: attendanceDate,
            status: record.status,
            checkInTime: record.checkInTime
              ? new Date(record.checkInTime)
              : undefined,
            checkOutTime: record.checkOutTime
              ? new Date(record.checkOutTime)
              : undefined,
            minutesLate: record.minutesLate ?? undefined,
            leaveType: record.leaveType ?? undefined,
            reason: record.reason ?? undefined,
            notes: record.notes ?? undefined,
            recordedBy: adminUserId
              ? new mongoose.Types.ObjectId(String(adminUserId))
              : undefined,
          });
          results.push({ teacherId: record.teacherId, action: "created" });
        }

        // Log activity for each teacher
        await logTeacherActivity({
          teacherId: record.teacherId,
          schoolId: schoolIdObj,
          type: "attendance_recorded",
          title: "Attendance recorded",
          description: `Recorded ${record.status} for ${attendanceDate.toLocaleDateString()}`,
          metadata: {
            date: attendanceDate.toISOString(),
            status: record.status,
            recordedBy: adminUserId,
            source: "bulk_attendance",
          },
          createdBy: adminUserId,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push({ teacherId: record.teacherId, error: msg });
      }
    }

    return Response.json({
      success: true,
      message: `Processed ${results.length} attendance records`,
      data: {
        date: attendanceDate.toISOString(),
        processed: results.length,
        created: results.filter((r) => r.action === "created").length,
        updated: results.filter((r) => r.action === "updated").length,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to record attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
