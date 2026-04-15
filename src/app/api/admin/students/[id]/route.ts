/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { Student } from "@/models/Student";
import { Activity } from "@/models/Activity";
import { Guardian } from "@/models/Guardian";
import { Grade } from "@/models/Grade";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TermResult } from "@/models/TermResult";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { StudentAttendance } from "@/models/StudentAttendance";

function derivePerformanceTier(
  averageScore: number | null | undefined
): "top" | "above_average" | "average" | "at_risk" | undefined {
  if (typeof averageScore !== "number" || Number.isNaN(averageScore)) {
    return undefined;
  }

  if (averageScore >= 85) return "top";
  if (averageScore >= 70) return "above_average";
  if (averageScore >= 50) return "average";
  return "at_risk";
}

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

      gesIndexNumber: student.gesIndexNumber ?? null,
      gesSchoolCode: student.gesSchoolCode ?? null,

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
        isFromPreviousTerm?: boolean;
        previousTermLabel?: string;
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

    // ── Populate academicSummary from TermResult ──
    const studentOid = new mongoose.Types.ObjectId(id);

    // Find the current academic period for this school
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId,
      isCurrent: true,
    }).lean();

    if (currentPeriod) {
      const periodId = currentPeriod._id;
      const termLabel = `${currentPeriod.yearLabel} – ${currentPeriod.term}`;

      // Look for a TermResult for this student in the current period
      const currentResult = (await TermResult.findOne({
        schoolId,
        studentId: studentOid,
        academicPeriodId: periodId,
      }).lean()) as any;

      if (currentResult) {
        // Determine trend by comparing with previous term
        let trend: "up" | "down" | "stable" = "stable";
        const allPeriods = await AcademicPeriod.find({ schoolId })
          .sort({ startDate: -1 })
          .limit(10)
          .lean();
        const currentIdx = allPeriods.findIndex(
          (p) => String(p._id) === String(periodId)
        );
        if (currentIdx >= 0 && currentIdx < allPeriods.length - 1) {
          const prevPeriod = allPeriods[currentIdx + 1];
          const prevResult = (await TermResult.findOne({
            schoolId,
            studentId: studentOid,
            academicPeriodId: prevPeriod._id,
          }).lean()) as any;
          if (prevResult) {
            const diff = currentResult.averageScore - prevResult.averageScore;
            if (diff > 1) trend = "up";
            else if (diff < -1) trend = "down";
          }
        }

        dto.academicSummary = {
          latestTermLabel: termLabel,
          overallAverage: currentResult.averageScore,
          classPosition: currentResult.classPosition ?? undefined,
          totalSubjects: currentResult.totalSubjects,
          performanceTier:
            currentResult.performanceTier ??
            derivePerformanceTier(currentResult.averageScore),
          trend,
        };
      } else {
        // No result for current period — fall back to the latest available result
        const latestResult = (await TermResult.findOne({
          schoolId,
          studentId: studentOid,
        })
          .sort({ calculatedAt: -1 })
          .populate("academicPeriodId", "yearLabel term")
          .lean()) as any;

        if (latestResult) {
          const lp = latestResult.academicPeriodId as any;
          const pastLabel = lp?.yearLabel
            ? `${lp.yearLabel} – ${lp.term}`
            : "Previous term";
          dto.academicSummary = {
            latestTermLabel: termLabel,
            overallAverage: latestResult.averageScore,
            classPosition: latestResult.classPosition ?? undefined,
            totalSubjects: latestResult.totalSubjects,
            performanceTier:
              latestResult.performanceTier ??
              derivePerformanceTier(latestResult.averageScore),
            trend: "stable",
            isFromPreviousTerm: true,
            previousTermLabel: pastLabel,
          };
        } else {
          dto.academicSummary = {
            latestTermLabel: termLabel,
          };
        }
      }
    } else {
      // No current period — find most recent TermResult for this student
      const latestResult = (await TermResult.findOne({
        schoolId,
        studentId: studentOid,
      })
        .sort({ calculatedAt: -1 })
        .populate("academicPeriodId", "yearLabel term")
        .lean()) as any;

      if (latestResult) {
        const lp = latestResult.academicPeriodId as any;
        dto.academicSummary = {
          latestTermLabel: lp?.yearLabel
            ? `${lp.yearLabel} – ${lp.term}`
            : "Previous term",
          overallAverage: latestResult.averageScore,
          classPosition: latestResult.classPosition ?? undefined,
          totalSubjects: latestResult.totalSubjects,
          performanceTier:
            latestResult.performanceTier ??
            derivePerformanceTier(latestResult.averageScore),
          trend: "stable",
        };
      }
    }

    // ── Populate attendanceSummary from StudentAttendance ──
    // Prefer current period when available; otherwise use all attendance records.
    const attendanceMatch: Record<string, unknown> = {
      schoolId,
      studentId: studentOid,
    };
    if (currentPeriod?._id) {
      attendanceMatch.academicPeriodId = currentPeriod._id;
    }

    const attendanceByStatus = (await StudentAttendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ])) as Array<{ _id: string; count: number }>;

    const attendanceCounts = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    for (const row of attendanceByStatus) {
      if (row?._id === "present") attendanceCounts.present = row.count || 0;
      if (row?._id === "absent") attendanceCounts.absent = row.count || 0;
      if (row?._id === "late") attendanceCounts.late = row.count || 0;
      if (row?._id === "excused") attendanceCounts.excused = row.count || 0;
    }

    const attendanceTotal =
      attendanceCounts.present +
      attendanceCounts.absent +
      attendanceCounts.late +
      attendanceCounts.excused;

    if (attendanceTotal > 0) {
      const attendedCount =
        attendanceCounts.present + attendanceCounts.late + attendanceCounts.excused;
      const presentPercent = Number(
        ((attendedCount / attendanceTotal) * 100).toFixed(1)
      );

      dto.attendanceSummary = {
        // Treat excused days as attended in this aggregate summary.
        presentDays: attendanceCounts.present + attendanceCounts.excused,
        absentDays: attendanceCounts.absent,
        lateDays: attendanceCounts.late,
        presentPercent,
      };
    }

    // ── Populate feesSummary from Invoice + Payment ──
    // Use active (issued/paid/overdue) invoices only; exclude draft/cancelled.
    const activeInvoices = (await Invoice.find({
      schoolId,
      studentId: studentOid,
      status: { $in: ["issued", "partially_paid", "paid", "overdue"] },
    })
      .sort({ createdAt: -1 })
      .lean()) as any[];

    if (activeInvoices.length > 0) {
      // Prefer current period figures when available for better dashboard relevance.
      const scopedInvoices =
        currentPeriod?._id
          ? activeInvoices.filter(
              (invoice) =>
                String(invoice.academicPeriodId) === String(currentPeriod._id)
            )
          : [];

      const invoicesForSummary =
        scopedInvoices.length > 0 ? scopedInvoices : activeInvoices;

      const totalBilledMinor = invoicesForSummary.reduce(
        (sum, invoice) => sum + Number(invoice.totalAmountMinor || 0),
        0
      );
      const totalPaidMinor = invoicesForSummary.reduce(
        (sum, invoice) => sum + Number(invoice.totalPaidMinor || 0),
        0
      );
      const totalOutstandingMinor = invoicesForSummary.reduce(
        (sum, invoice) => sum + Number(invoice.totalOutstandingMinor || 0),
        0
      );

      const lastPayment = (await Payment.findOne({
        schoolId,
        studentId: studentOid,
        status: "completed",
      })
        .sort({ paymentDate: -1 })
        .select("paymentDate")
        .lean()) as any;

      let currentTermLabel = "All terms";
      if (scopedInvoices.length > 0 && currentPeriod) {
        currentTermLabel = `${currentPeriod.yearLabel} – ${currentPeriod.term}`;
      } else {
        const latestInvoice = activeInvoices[0];
        if (latestInvoice?.academicPeriodId) {
          const invoicePeriod = (await AcademicPeriod.findById(
            latestInvoice.academicPeriodId
          )
            .select("yearLabel term")
            .lean()) as any;
          if (invoicePeriod?.yearLabel && invoicePeriod?.term) {
            currentTermLabel = `${invoicePeriod.yearLabel} – ${invoicePeriod.term}`;
          }
        }
      }

      const totalBilled = totalBilledMinor / 100;
      const totalPaid = totalPaidMinor / 100;
      const totalOutstanding = totalOutstandingMinor / 100;

      let feesStatus: "clear" | "partial" | "owing" = "owing";
      if (totalOutstandingMinor <= 0) {
        feesStatus = "clear";
      } else if (totalPaidMinor > 0) {
        feesStatus = "partial";
      }

      dto.feesSummary = {
        currentTermLabel,
        totalBilled,
        totalPaid,
        totalOutstanding,
        currency: "GHS",
        status: feesStatus,
        lastPaymentDate: lastPayment?.paymentDate
          ? new Date(lastPayment.paymentDate).toISOString()
          : null,
      };
    }

    return Response.json({ success: true, data: dto }, { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to fetch student detail:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch student detail";
    return new Response(message, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return new Response("Invalid student id", { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.gesIndexNumber === "string" || body.gesIndexNumber === null) {
      updates.gesIndexNumber = body.gesIndexNumber?.trim() || null;
    }
    if (typeof body.gesSchoolCode === "string" || body.gesSchoolCode === null) {
      updates.gesSchoolCode = body.gesSchoolCode?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return new Response("No valid fields to update", { status: 400 });
    }

    const studentObjId = new mongoose.Types.ObjectId(id);
    const academicsStreamKey = `school:${String(schoolId)}:academics`;
    const auditContext = buildSchoolUserAuditContext(req, {
      userId,
      schoolId,
      actorRole: "school_admin",
      idempotencyKey: resolveAuditIdempotencyKey(req, `student.record.updated:${id}`),
    });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const before = await Student.findOne({ _id: studentObjId, schoolId })
          .session(session)
          .select("gesIndexNumber gesSchoolCode")
          .lean();
        if (!before) {
          throw new Error("STUDENT_NOT_FOUND");
        }

        const afterDoc = await Student.findOneAndUpdate(
          { _id: studentObjId, schoolId },
          { $set: updates },
          { new: true, session }
        )
          .select("gesIndexNumber gesSchoolCode")
          .lean();

        if (!afterDoc) {
          throw new Error("STUDENT_NOT_FOUND");
        }

        await writeTransactionalAuditEvent(session, {
          actionCode: "student.record.updated",
          scopeType: "school",
          scopeId: String(schoolId),
          result: "succeeded",
          target: {
            targetEntityType: "Student",
            targetEntityId: studentObjId,
          },
          context: auditContext,
          payload: {
            before: {
              gesIndexNumber: before.gesIndexNumber ?? null,
              gesSchoolCode: before.gesSchoolCode ?? null,
            },
            after: {
              gesIndexNumber: afterDoc.gesIndexNumber ?? null,
              gesSchoolCode: afterDoc.gesSchoolCode ?? null,
            },
            metadata: { fields: Object.keys(updates) },
          },
          streamKey: academicsStreamKey,
        });
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "STUDENT_NOT_FOUND") {
        return new Response("Student not found", { status: 404 });
      }
      throw err;
    } finally {
      await session.endSession();
    }

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to update student:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update student";
    return new Response(message, { status: 500 });
  }
}
