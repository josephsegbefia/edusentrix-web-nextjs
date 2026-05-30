import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import {
  buildParentAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { buildSnapshotReportCardPdf } from "@/lib/academics/reporting/build-snapshot-report-card-pdf";
import { resolveStudentReportCardViewData } from "@/lib/academics/reporting/resolve-student-report-card-view";
import { Student } from "@/models/Student";

function sanitizeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Parent secure report download — released official report card snapshots only.
 * Legacy DTO PDF generation has been removed (Slice 21 follow-up).
 */
export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const wardId = searchParams.get("wardId");
    const periodId = searchParams.get("periodId");
    const reportType = searchParams.get("type") || "report_card";
    const studentReportCardId = searchParams.get("studentReportCardId");

    if (!wardId || !mongoose.Types.ObjectId.isValid(wardId)) {
      return NextResponse.json(
        { success: false, error: "Valid wardId is required" },
        { status: 400 }
      );
    }

    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json(
        { success: false, error: "Invalid periodId" },
        { status: 400 }
      );
    }

    await verifyGuardianAccess(context.userId, wardId);

    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(wardId),
      schoolId: context.schoolId,
    })
      .select("_id")
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const periodObjectId =
      periodId && mongoose.Types.ObjectId.isValid(periodId)
        ? new mongoose.Types.ObjectId(periodId)
        : null;
    const snapshotCardId =
      studentReportCardId && mongoose.Types.ObjectId.isValid(studentReportCardId)
        ? new mongoose.Types.ObjectId(studentReportCardId)
        : null;

    const snapshotView = await resolveStudentReportCardViewData({
      schoolId: context.schoolId,
      studentId: student._id,
      academicPeriodId: periodObjectId,
      statuses: ["released"],
      studentReportCardId: snapshotCardId,
    });

    if (!snapshotView || snapshotView.source !== "snapshot") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only released official report cards can be downloaded. Check Reports after your school publishes results for this period.",
          deprecatedLegacyPdf: true,
        },
        { status: 404 }
      );
    }

    const pdfBytes = await buildSnapshotReportCardPdf(snapshotView);
    const fileStudent = sanitizeFilePart(snapshotView.student.name || "student-report");
    const fileTerm = sanitizeFilePart(
      `${snapshotView.period.term}-${snapshotView.period.yearLabel}` || "current-term"
    );
    const fileName = `${fileStudent}-${fileTerm}-report-card.pdf`;

    try {
      await writeRetryableAuditEvent({
        actionCode: "report.downloaded.secure",
        scopeType: "school",
        scopeId: String(context.schoolId),
        result: "succeeded",
        target: {
          targetEntityType: "Student",
          targetEntityId: student._id,
        },
        context: buildParentAuditContext(req, {
          userId: context.userId,
          schoolId: context.schoolId,
          idempotencyKey: resolveAuditIdempotencyKey(
            req,
            `report.snapshot:${wardId}:${snapshotView.studentReportCardId ?? periodId}:${reportType}`
          ),
        }),
        payload: {
          metadata: {
            reportType: "report_card",
            periodId: periodId || null,
            wardId,
            studentReportCardId: snapshotView.studentReportCardId ?? null,
            source: "snapshot",
          },
        },
        streamKey: `school:${String(context.schoolId)}:academics`,
      });
    } catch (auditErr) {
      console.error("report.downloaded.secure audit failed:", auditErr);
    }

    const pdfArrayBuffer = new ArrayBuffer(pdfBytes.length);
    new Uint8Array(pdfArrayBuffer).set(pdfBytes);

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("Failed to download parent report:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to download report",
      },
      { status: 500 }
    );
  }
}
