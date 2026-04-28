import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { recordActivity } from "@/lib/audit/recordActivity";
import { delegationAuditFields } from "@/lib/audit/delegationAuditFields";
import { School } from "@/models/School";
import { ReportVerification } from "@/models/ReportVerification";

const issueSimpleReportSchema = z.object({
  reportLabel: z.string().trim().min(3).max(100).optional(),
  range: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    source: z.string().trim().min(1).max(48),
    periodLabel: z.string().trim().max(120).nullable().optional(),
  }),
});

async function createVerificationId() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const token = crypto.randomBytes(6).toString("hex").toUpperCase();
    const verificationId = `SR-${stamp}-${token}`;

    const existing = await ReportVerification.exists({ verificationId });
    if (!existing) return verificationId;
  }

  throw new Error("Could not allocate verification ID");
}

export async function POST(req: NextRequest) {
  const authCtx = await requireSchoolAdminOrDelegatedAnyPermission([
    "reports.export",
  ]);
  const { userId, schoolId } = authCtx;
  await connectToDatabase();

  if (!schoolId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));
  const userIdObj =
    userId instanceof mongoose.Types.ObjectId
      ? userId
      : new mongoose.Types.ObjectId(String(userId));

  let payload: z.infer<typeof issueSimpleReportSchema>;
  try {
    const body = await req.json();
    payload = issueSimpleReportSchema.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const startDate = new Date(payload.range.startDate);
  const endDate = new Date(payload.range.endDate);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate > endDate
  ) {
    return NextResponse.json(
      { error: "Invalid report date range" },
      { status: 400 }
    );
  }

  const schoolDoc = await School.findById(schoolIdObj).select("name").lean();
  const schoolName =
    schoolDoc && typeof schoolDoc.name === "string" && schoolDoc.name.trim()
      ? schoolDoc.name.trim()
      : "Your School";

  const verificationId = await createVerificationId();

  const verification = await ReportVerification.create({
    verificationId,
    reportType: "simple_snapshot",
    status: "issued",
    schoolId: schoolIdObj,
    schoolName,
    issuedBy: userIdObj,
    reportLabel: payload.reportLabel || "Simple Report Snapshot",
    range: {
      startDate,
      endDate,
      source: payload.range.source,
      periodLabel: payload.range.periodLabel || null,
    },
    meta: {
      categories: ["finance", "people", "learning", "operations"],
      version: 1,
    },
    issuedAt: new Date(),
  });

  await recordActivity({
    schoolId: schoolIdObj,
    userId: userIdObj,
    type: "report.generated",
    entityType: "ReportVerification",
    entityId: verification._id,
    description: "Generated simple report snapshot",
    ...delegationAuditFields({
      isDelegatedActor: !authCtx.isSchoolAdmin,
      activeDelegationId: authCtx.activeDelegationId,
      module: "reports",
      action: "report.generated",
    }),
    metadata: {
      reportType: verification.reportType,
      verificationId,
      range: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        source: payload.range.source,
        periodLabel: payload.range.periodLabel || null,
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      verificationId,
      reportType: verification.reportType,
      reportLabel: verification.reportLabel,
      schoolName,
      status: verification.status,
      issuedAt: verification.issuedAt.toISOString(),
      verificationPath: `/verify/report/${encodeURIComponent(verificationId)}`,
    },
  });
}
