/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
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
import { ClassGroup } from "@/models/ClassGroup";
import { PatchStudentProfileSchema } from "@/schemas/student";
import type { IStudent } from "@/models/Student";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TermResult } from "@/models/TermResult";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { StudentAttendance } from "@/models/StudentAttendance";
import { deleteUploadedFile } from "@/lib/uploads/delete";

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
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
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
      metadata: (item.metadata ?? {}) as Record<string, unknown>,
      user: item.userId
        ? {
            id: item.userId._id.toString(),
            firstName: item.userId.firstName ?? null,
            lastName: item.userId.lastName ?? null,
            email: item.userId.email ?? null,
          }
        : null,
    }));

    const enrollmentRaw = (student.enrollmentDocuments ?? []) as Array<{
      requirementId: string;
      label: string;
      fileUrl: string;
      fileName?: string | null;
      mimeType?: string | null;
      uploadedAt?: Date | string | null;
    }>;

    const documentsFromEnrollment = enrollmentRaw.map((d, i) => {
      const uploaded =
        d.uploadedAt instanceof Date
          ? d.uploadedAt
          : d.uploadedAt
            ? new Date(d.uploadedAt)
            : null;
      const mime = d.mimeType ?? "";
      const typeLabel =
        mime && mime.includes("/")
          ? mime.split("/")[1] || "file"
          : mime || "file";
      const fallbackAt = enrolledAt ?? new Date();

      return {
        id: `admission:${d.requirementId}:${i}`,
        name: (d.fileName && String(d.fileName).trim()) || d.label,
        type: typeLabel,
        uploadedAt: (uploaded ?? fallbackAt).toISOString(),
        url: d.fileUrl,
        source: "admissions" as const,
      };
    });

    const STUDENT_RECORD_DOC_LABELS: Record<string, string> = {
      report_card: "Report card",
      medical: "Medical",
      consent: "Consent / permission",
      identification: "Identification",
      disciplinary: "Disciplinary",
      other: "Other",
      parent_request: "Parent upload (requested)",
    };

    function labelStudentRecordDocType(slug: string): string {
      return (
        STUDENT_RECORD_DOC_LABELS[slug] ??
        slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      );
    }

    const recordsRaw = (student.recordDocuments ?? []) as Array<{
      _id: mongoose.Types.ObjectId;
      name: string;
      type: string;
      fileUrl: string;
      uploadedAt?: Date | string | null;
    }>;

    const documentsFromRecords = recordsRaw.map((d) => {
      const uploaded =
        d.uploadedAt instanceof Date
          ? d.uploadedAt
          : d.uploadedAt
            ? new Date(d.uploadedAt)
            : new Date();
      const isParentRequest = d.type === "parent_request";
      return {
        id: `record:${String(d._id)}`,
        name: d.name,
        type: labelStudentRecordDocType(d.type),
        uploadedAt: uploaded.toISOString(),
        url: d.fileUrl,
        source: "school" as const,
        recordOrigin: isParentRequest
          ? ("parent_request" as const)
          : ("staff" as const),
      };
    });

    const documentsMerged = [
      ...documentsFromEnrollment,
      ...documentsFromRecords,
    ].sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    const parentDocumentRequestsRaw = (student.parentDocumentRequests ??
      []) as Array<{
      _id: mongoose.Types.ObjectId;
      label: string;
      message?: string | null;
      fulfilledAt?: Date | null;
      requestedAt?: Date | null;
    }>;

    const parentDocumentRequestsDto = [...parentDocumentRequestsRaw]
      .sort(
        (a, b) =>
          new Date(b.requestedAt ?? 0).getTime() -
          new Date(a.requestedAt ?? 0).getTime()
      )
      .map((r) => ({
        id: String(r._id),
        label: r.label,
        message: r.message ?? null,
        fulfilledAt: r.fulfilledAt
          ? new Date(r.fulfilledAt).toISOString()
          : null,
        requestedAt: r.requestedAt
          ? new Date(r.requestedAt).toISOString()
          : new Date().toISOString(),
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
          .populate("userId", "firstName lastName email avatarUrl clerkUserId")
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
          hasPlatformAccount: Boolean(user.clerkUserId),
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
      documents: documentsMerged,
      parentDocumentRequests: parentDocumentRequestsDto,
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

    // ── Populate feesSummary from bills + payments ──
    // Admin summaries should show assigned fee data even before a bill is issued.
    const activeInvoices = (await Invoice.find({
      schoolId,
      studentId: studentOid,
      status: { $in: ["draft", "issued", "partially_paid", "paid", "overdue"] },
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

function pickStudentAuditSnapshot(doc: {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  admissionNo?: string | null;
  sex?: string | null;
  dateOfBirth?: Date | null;
  photoUrl?: string | null;
  status?: string;
  enrolledAt?: Date | null;
  gradeId?: unknown;
  classGroupId?: unknown;
  gesIndexNumber?: string | null;
  gesSchoolCode?: string | null;
}) {
  return {
    firstName: doc.firstName,
    middleName: doc.middleName ?? null,
    lastName: doc.lastName,
    admissionNo: doc.admissionNo ?? null,
    sex: doc.sex ?? null,
    dateOfBirth: doc.dateOfBirth
      ? new Date(doc.dateOfBirth).toISOString().slice(0, 10)
      : null,
    photoUrl: doc.photoUrl ?? null,
    status: doc.status,
    enrolledAt: doc.enrolledAt
      ? new Date(doc.enrolledAt).toISOString().slice(0, 10)
      : null,
    gradeId: doc.gradeId ? String(doc.gradeId) : null,
    classGroupId: doc.classGroupId ? String(doc.classGroupId) : null,
    gesIndexNumber: doc.gesIndexNumber ?? null,
    gesSchoolCode: doc.gesSchoolCode ?? null,
  };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return new Response("Invalid student id", { status: 400 });
    }

    const rawBody = await req.json();
    const parsed = PatchStudentProfileSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const studentObjId = new mongoose.Types.ObjectId(id);
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    if (data.gradeId && data.classGroupId) {
      const grade = await Grade.findOne({
        _id: data.gradeId,
        schoolId: schoolIdObj,
        isActive: true,
      }).lean();
      if (!grade) {
        return new Response("Grade not found or not active", { status: 400 });
      }
      const classGroup = await ClassGroup.findOne({
        _id: data.classGroupId,
        schoolId: schoolIdObj,
        gradeId: data.gradeId,
        isActive: true,
      }).lean();
      if (!classGroup) {
        return new Response(
          "Class group not found, not active, or does not match grade",
          { status: 400 }
        );
      }
    }

    if (data.admissionNo !== undefined && data.admissionNo) {
      const trimmed = data.admissionNo.trim();
      const dup = await Student.findOne({
        schoolId: schoolIdObj,
        admissionNo: trimmed,
        _id: { $ne: studentObjId },
      })
        .select("_id")
        .lean();
      if (dup) {
        return new Response("Admission number already in use", { status: 400 });
      }
    }

    const academicsStreamKey = `school:${String(schoolId)}:academics`;
    const auditContext = buildSchoolUserAuditContext(req, {
      userId,
      schoolId,
      actorRole: "school_admin",
      idempotencyKey: resolveAuditIdempotencyKey(req, `student.record.updated:${id}`),
    });

    let previousPhotoUrl: string | null = null;
    if (data.photoUrl !== undefined) {
      const existingPhoto = await Student.findOne({
        _id: studentObjId,
        schoolId: schoolIdObj,
      })
        .select("photoUrl")
        .lean<{ photoUrl?: string | null }>();
      previousPhotoUrl = existingPhoto?.photoUrl ?? null;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const beforeLean = await Student.findOne({
          _id: studentObjId,
          schoolId: schoolIdObj,
        })
          .session(session)
          .lean();
        if (!beforeLean) {
          throw new Error("STUDENT_NOT_FOUND");
        }

        const before = pickStudentAuditSnapshot(beforeLean as IStudent);

        const student = await Student.findOne({
          _id: studentObjId,
          schoolId: schoolIdObj,
        }).session(session);
        if (!student) {
          throw new Error("STUDENT_NOT_FOUND");
        }

        if (data.firstName !== undefined) student.firstName = data.firstName;
        if (data.middleName !== undefined) {
          student.middleName = data.middleName?.trim() || null;
        }
        if (data.lastName !== undefined) student.lastName = data.lastName;
        if (data.admissionNo !== undefined) {
          student.admissionNo = data.admissionNo?.trim() || null;
        }
        if (data.sex !== undefined) {
          student.sex = data.sex ?? "male";
        }
        if (data.dateOfBirth !== undefined) {
          student.dateOfBirth = data.dateOfBirth
            ? new Date(data.dateOfBirth)
            : null;
        }
        if (data.photoUrl !== undefined) {
          const p = data.photoUrl;
          student.photoUrl = !p || p === "" ? null : p;
        }
        if (data.status !== undefined) student.status = data.status;
        if (data.enrolledAt !== undefined) {
          student.enrolledAt = data.enrolledAt
            ? new Date(data.enrolledAt)
            : null;
        }
        if (data.gradeId !== undefined && data.classGroupId !== undefined) {
          student.gradeId = new mongoose.Types.ObjectId(data.gradeId);
          student.classGroupId = new mongoose.Types.ObjectId(data.classGroupId);
        }
        if (data.gesIndexNumber !== undefined) {
          student.gesIndexNumber = data.gesIndexNumber?.trim() || null;
        }
        if (data.gesSchoolCode !== undefined) {
          student.gesSchoolCode = data.gesSchoolCode?.trim() || null;
        }

        await student.save({ session });

        const after = pickStudentAuditSnapshot(student.toObject() as IStudent);

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
            before,
            after,
            metadata: { fields: Object.keys(data) },
          },
          streamKey: academicsStreamKey,
        });
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "STUDENT_NOT_FOUND") {
        return new Response("Student not found", { status: 404 });
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("admissionNo") ||
        msg.includes("duplicate") ||
        msg.includes("E11000")
      ) {
        return new Response("Admission number already in use", { status: 400 });
      }
      if (
        msg.includes("ClassGroup") ||
        msg.includes("Grade") ||
        msg.includes("schoolId")
      ) {
        return new Response(msg, { status: 400 });
      }
      throw err;
    } finally {
      await session.endSession();
    }

    if (data.photoUrl !== undefined && previousPhotoUrl) {
      const nextPhotoUrl =
        !data.photoUrl || data.photoUrl === "" ? null : data.photoUrl;
      if (previousPhotoUrl !== nextPhotoUrl) {
        await deleteUploadedFile(previousPhotoUrl);
      }
    }

    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Failed to update student:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update student";
    return new Response(message, { status: 500 });
  }
}
