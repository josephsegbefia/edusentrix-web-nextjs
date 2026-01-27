/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Activity } from "@/models/Activity";
import { Guardian } from "@/models/Guardian";
import { Grade } from "@/models/Grade";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    if (!schoolId) {
      return new Response("School ID not found", { status: 400 });
    }
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return new Response("Invalid student id", { status: 400 });
    }

    const studentDoc = await Student.findOne({
      _id: id,
      schoolId,
    })
      .populate({ path: "gradeId", model: Grade })
      .populate("classGroupId")
      .lean();

    if (!studentDoc) {
      return new Response("Student not found", { status: 404 });
    }

    const student = studentDoc as any;

    const grade = student.gradeId as any | undefined;
    const classGroup = student.classGroupId as any | undefined;

    const fullName = [student.firstName, student.middleName, student.lastName]
      .filter(Boolean)
      .join(" ");

    const dob = student.dateOfBirth ? new Date(student.dateOfBirth) : null;
    const enrolledAt = student.enrolledAt ? new Date(student.enrolledAt) : null;

    let ageYears: number | null = null;
    if (dob) {
      const now = new Date();
      let years = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
        years--;
      }
      ageYears = years;
    }

    // Recent activity for this student – using entityType "student"
    const recentActivitiesRaw = await Activity.find({
      schoolId: schoolId,
      entityType: "student",
      entityId: new mongoose.Types.ObjectId(id),
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "firstName lastName email")
      .lean();

    const recentActivity = recentActivitiesRaw.map((item: any) => ({
      id: item._id.toString(),
      type: item.type as string,
      description: item.description as string,
      createdAt: item.createdAt?.toISOString?.() ?? new Date().toISOString(),
      user: item.userId
        ? {
            id: item.userId._id.toString(),
            firstName: item.userId.firstName ?? null,
            lastName: item.userId.lastName ?? null,
            email: item.userId.email ?? null,
          }
        : null,
    }));

    const dto = {
      id: student._id.toString(),
      schoolId: student.schoolId.toString(),
      admissionNo: student.admissionNo ?? null,
      firstName: student.firstName,
      middleName: student.middleName ?? null,
      lastName: student.lastName,
      fullName,
      sex: student.sex ?? null,
      dateOfBirth: dob ? dob.toISOString() : null,
      ageYears,
      photoUrl: student.photoUrl ?? null,
      status: student.status ?? "active",
      enrolledAt: enrolledAt ? enrolledAt.toISOString() : null,

      grade: grade
        ? {
            id: grade._id.toString(),
            name: grade.name as string,
            code: grade.code ?? null,
            label: grade.name as string,
          }
        : null,

      classGroup: classGroup
        ? {
            id: classGroup._id.toString(),
            name: classGroup.name as string,
            label: classGroup.fullLabel
              ? (classGroup.fullLabel as string)
              : grade
              ? `${grade.name} ${classGroup.name}`
              : (classGroup.name as string),
          }
        : null,

      // Fetch guardians
      guardians: (
        await Guardian.find({
          studentId: new mongoose.Types.ObjectId(id),
        })
          .populate("userId", "firstName lastName email avatarUrl")
          .sort({ isPrimary: -1, createdAt: 1 })
          .lean()
      ).map((g: any) => {
        const user = g.userId as any;
        return {
          id: String(g._id),
          fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          relationship: g.relationship as string,
          phone: g.phone || "",
          email: g.email || user.email || null,
          isPrimary: g.isPrimary,
        };
      }),

      // Fees, academics, attendance, behaviour are stubbed for now
      feesSummary: null as {
        currentTermLabel: string;
        totalBilled: number;
        totalPaid: number;
        totalOutstanding: number;
        currency: string;
        status: "clear" | "partial" | "owing";
        lastPaymentDate?: string | null;
      } | null,

      academicSummary: null as {
        latestTermLabel?: string;
        overallAverage?: number;
        classPosition?: number;
        totalSubjects?: number;
        performanceTier?: "top" | "above_average" | "average" | "at_risk";
        trend?: "up" | "down" | "stable";
      } | null,

      attendanceSummary: null as {
        presentPercent?: number;
        presentDays?: number;
        absentDays?: number;
        lateDays?: number;
      } | null,

      behaviourSummary: null as {
        incidentsCount?: number;
        lastIncidentDate?: string | null;
        positiveNotesCount?: number;
      } | null,

      recentActivity,

      academicRecords: null as {
        terms: {
          id: string;
          label: string;
          average?: number;
          position?: number;
          totalSubjects?: number;
        }[];
        subjectsByTerm: {
          termId: string;
          subjects: {
            id: string;
            name: string;
            shortCode?: string;
            teacherName?: string;
            caScore?: number | null;
            examScore?: number | null;
            total?: number | null;
            gradeLetter?: string | null;
          }[];
        }[];
      } | null,

      feeTimeline: [] as {
        id: string;
        type: "invoice" | "payment";
        label: string;
        termLabel?: string;
        amount: number;
        date: string;
        status?: "pending" | "paid" | "overdue" | "reversed";
        method?: string;
      }[],

      attendanceEvents: [] as {
        id: string;
        date: string;
        status: "present" | "absent" | "late";
      }[],
      incidents: [] as {
        id: string;
        date: string;
        type: string;
        severity: "low" | "medium" | "high";
        summary: string;
        recordedBy?: string;
      }[],
      documents: [] as {
        id: string;
        name: string;
        type: string;
        uploadedAt: string;
      }[],
    };

    return Response.json({ success: true, data: dto }, { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to fetch student detail:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch student detail";
    return new Response(message, { status: 500 });
  }
}
