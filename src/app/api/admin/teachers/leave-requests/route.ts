// src/app/api/admin/teachers/leave-requests/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { Teacher } from "@/models/Teacher";
import mongoose from "mongoose";

/**
 * GET /api/admin/teachers/leave-requests
 * Get all leave requests across all teachers
 * Query params: status (pending, approved, rejected), page, limit
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
    const statusFilter = searchParams.get("status"); // pending, approved, rejected
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );

    // Build query - leave requests are attendance records with status "on_leave"
    const query: Record<string, unknown> = {
      schoolId: schoolIdObj,
      status: "on_leave",
    };

    // Filter by approval status based on notes field
    if (statusFilter === "pending") {
      query.notes = { $not: { $regex: /^(APPROVED|REJECTED):/ } };
    } else if (statusFilter === "approved") {
      query.notes = { $regex: /^APPROVED:/ };
    } else if (statusFilter === "rejected") {
      query.notes = { $regex: /^REJECTED:/ };
    }

    // Get total count
    const total = await TeacherAttendance.countDocuments(query);

    // Get records with teacher info
    const records = await TeacherAttendance.find(query)
      .populate("teacherId", "firstName lastName email department photoUrl")
      .populate("recordedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const data = records.map((r: any) => {
      const notes = r.notes || "";
      const isApproved = notes.startsWith("APPROVED:");
      const isRejected = notes.startsWith("REJECTED:");
      const approvalStatus = isApproved
        ? "approved"
        : isRejected
          ? "rejected"
          : "pending";
      const actualNotes = notes.replace(/^(APPROVED|REJECTED):\s*/, "");

      return {
        id: String(r._id),
        teacherId: String(r.teacherId?._id || r.teacherId),
        teacher: r.teacherId
          ? {
              id: String(r.teacherId._id),
              firstName: r.teacherId.firstName || "",
              lastName: r.teacherId.lastName || "",
              fullName:
                `${r.teacherId.firstName || ""} ${r.teacherId.lastName || ""}`.trim(),
              email: r.teacherId.email || null,
              department: r.teacherId.department || null,
              photoUrl: r.teacherId.photoUrl || null,
            }
          : null,
        date: new Date(r.date).toISOString(),
        leaveType: r.leaveType,
        reason: r.reason,
        notes: actualNotes || null,
        approvalStatus,
        recordedBy: r.recordedBy
          ? {
              id: String(r.recordedBy._id),
              name:
                `${r.recordedBy.firstName || ""} ${r.recordedBy.lastName || ""}`.trim(),
              email: r.recordedBy.email || null,
            }
          : null,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };
    });

    // Get counts by status for the summary
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      TeacherAttendance.countDocuments({
        schoolId: schoolIdObj,
        status: "on_leave",
        notes: { $not: { $regex: /^(APPROVED|REJECTED):/ } },
      }),
      TeacherAttendance.countDocuments({
        schoolId: schoolIdObj,
        status: "on_leave",
        notes: { $regex: /^APPROVED:/ },
      }),
      TeacherAttendance.countDocuments({
        schoolId: schoolIdObj,
        status: "on_leave",
        notes: { $regex: /^REJECTED:/ },
      }),
    ]);

    return Response.json({
      success: true,
      data,
      summary: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch leave requests";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
