// src/app/api/parent/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, getParentWardIds } from "@/lib/auth/requireParent";
import { StudentAttendance } from "@/models/StudentAttendance";
import { Payment } from "@/models/Payment";
import { SubjectGrade } from "@/models/SubjectGrade";
import { Student } from "@/models/Student";
// Note: Announcement model may not exist yet
// import { Announcement } from "@/models/Announcement";

type ActivityType = "grade" | "fee" | "attendance" | "announcement" | "message" | "event";

interface ParentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  ward: {
    id: string;
    studentId: string;
    name: string;
  } | null;
  createdAt: string;
  timeAgo: string;
  metadata: Record<string, unknown>;
  actionUrl?: string;
}

type StudentNameRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
};

type PaymentActivityRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  receiptNumber?: string;
};

type AttendanceActivityRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  date: Date;
  status: "absent" | "late";
  reason?: string;
};

type GradeActivityRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  subjectId?: { _id: mongoose.Types.ObjectId; name?: string } | mongoose.Types.ObjectId | null;
  totalScore: number;
  gradeLetter: string;
  createdAt: Date;
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const wardId = url.searchParams.get("wardId");
    const typeFilter = url.searchParams.get("type") as ActivityType | null;

    // Get all ward IDs for this parent
    const allWardIds = await getParentWardIds(context.userId);
    let studentIds: mongoose.Types.ObjectId[];
    if (wardId) {
      if (!mongoose.Types.ObjectId.isValid(wardId)) {
        return NextResponse.json(
          { success: false, error: "Invalid wardId" },
          { status: 400 }
        );
      }

      const requestedWardId = new mongoose.Types.ObjectId(wardId);
      const hasAccess = allWardIds.some((id) => id.equals(requestedWardId));
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: "You do not have access to this ward" },
          { status: 403 }
        );
      }

      studentIds = [requestedWardId];
    } else {
      studentIds = allWardIds;
    }

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          activities: [],
          pagination: { total: 0, limit, offset, hasMore: false },
        },
      });
    }

    // Get student names map
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName")
      .lean<StudentNameRow[]>();
    
    const studentMap = new Map(
      students.map((s) => [
        String(s._id),
        { id: String(s._id), name: `${s.firstName} ${s.lastName}`.trim() },
      ])
    );

    const activities: ParentActivity[] = [];

    // --- FETCH FEE/PAYMENT ACTIVITIES ---
    if (!typeFilter || typeFilter === "fee") {
      const payments = await Payment.find({
        studentId: { $in: studentIds },
        schoolId: context.schoolId,
        status: "completed",
      })
        .sort({ paymentDate: -1 })
        .limit(20)
        .lean<PaymentActivityRow[]>();

      payments.forEach((payment) => {
        const student = studentMap.get(String(payment.studentId));
        activities.push({
          id: `payment-${payment._id}`,
          type: "fee",
          title: "Payment Received",
          description: `Payment of GH₵ ${payment.amount.toLocaleString()} received`,
          ward: student ? { id: student.id, studentId: student.id, name: student.name } : null,
          createdAt: payment.paymentDate.toISOString(),
          timeAgo: getTimeAgo(payment.paymentDate),
          metadata: {
            amount: payment.amount,
            paymentId: String(payment._id),
            reference: payment.receiptNumber,
          },
          actionUrl: `/parent/wards/${payment.studentId}?tab=fees`,
        });
      });
    }

    // --- FETCH ATTENDANCE ACTIVITIES (last 7 days) ---
    if (!typeFilter || typeFilter === "attendance") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const attendanceRecords = await StudentAttendance.find({
        studentId: { $in: studentIds },
        schoolId: context.schoolId,
        date: { $gte: sevenDaysAgo },
        status: { $in: ["absent", "late"] }, // Only show notable attendance
      })
        .sort({ date: -1 })
        .limit(20)
        .lean<AttendanceActivityRow[]>();

      attendanceRecords.forEach((record) => {
        const student = studentMap.get(String(record.studentId));
        const statusLabel = record.status === "absent" ? "Absent" : "Late";
        activities.push({
          id: `attendance-${record._id}`,
          type: "attendance",
          title: `Marked ${statusLabel}`,
          description: record.reason || `Student was ${statusLabel.toLowerCase()} on ${new Date(record.date).toLocaleDateString()}`,
          ward: student ? { id: student.id, studentId: student.id, name: student.name } : null,
          createdAt: record.date.toISOString(),
          timeAgo: getTimeAgo(record.date),
          metadata: {
            date: record.date.toISOString(),
            status: record.status,
          },
          actionUrl: `/parent/wards/${record.studentId}?tab=attendance`,
        });
      });
    }

    // --- FETCH GRADE ACTIVITIES (recent grades) ---
    if (!typeFilter || typeFilter === "grade") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const grades = await SubjectGrade.find({
        studentId: { $in: studentIds },
        schoolId: context.schoolId,
        createdAt: { $gte: thirtyDaysAgo },
      })
        .populate("subjectId", "name")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean<GradeActivityRow[]>();

      grades.forEach((grade) => {
        const student = studentMap.get(String(grade.studentId));
        const subjectName =
          grade.subjectId &&
          typeof grade.subjectId === "object" &&
          "name" in grade.subjectId
            ? grade.subjectId.name || "Subject"
            : "Subject";
        activities.push({
          id: `grade-${grade._id}`,
          type: "grade",
          title: "New Grade Posted",
          description: `${subjectName}: ${grade.totalScore?.toFixed(1) || "-"}% (${grade.gradeLetter || "-"})`,
          ward: student ? { id: student.id, studentId: student.id, name: student.name } : null,
          createdAt: grade.createdAt.toISOString(),
          timeAgo: getTimeAgo(grade.createdAt),
          metadata: {
            gradeId: String(grade._id),
            subject: subjectName,
            score: grade.totalScore,
            grade: grade.gradeLetter,
          },
          actionUrl: `/parent/wards/${grade.studentId}?tab=academics`,
        });
      });
    }

    // --- FETCH ANNOUNCEMENTS ---
    // Note: Announcements feature may be implemented later
    // For now, we skip this section as the Announcement model doesn't exist yet
    // if (!typeFilter || typeFilter === "announcement") { ... }

    // Sort all activities by date (newest first)
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const total = activities.length;
    const paginatedActivities = activities.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return NextResponse.json({
      success: true,
      data: {
        activities: paginatedActivities,
        pagination: {
          total,
          limit,
          offset,
          hasMore,
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent activity:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch activity",
      },
      { status: 500 }
    );
  }
}
