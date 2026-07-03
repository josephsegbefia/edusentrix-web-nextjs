import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ReportVerification,
  type IReportVerification,
} from "@/models/ReportVerification";

interface RouteContext {
  params: Promise<{ verificationId: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  await connectToDatabase();

  const { verificationId } = await context.params;
  if (!verificationId || verificationId.length < 8) {
    return NextResponse.json({ error: "Invalid verification ID" }, { status: 400 });
  }

  const report = (await ReportVerification.findOne({
    verificationId: String(verificationId).trim(),
  })
    .select(
      "verificationId reportType status schoolName reportLabel range meta issuedAt revokedAt createdAt"
    )
    .lean()
    .exec()) as IReportVerification | null;

  if (!report) {
    return NextResponse.json(
      { error: "Verification ID not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      verificationId: report.verificationId,
      reportType: report.reportType,
      status: report.status,
      schoolName: report.schoolName,
      reportLabel: report.reportLabel,
      issuedAt: report.issuedAt ? new Date(report.issuedAt).toISOString() : null,
      revokedAt: report.revokedAt ? new Date(report.revokedAt).toISOString() : null,
      range: {
        startDate: report.range?.startDate
          ? new Date(report.range.startDate).toISOString()
          : null,
        endDate: report.range?.endDate
          ? new Date(report.range.endDate).toISOString()
          : null,
        source: report.range?.source || null,
        periodLabel: report.range?.periodLabel || null,
      },
      meta: {
        categories: Array.isArray(report.meta?.categories)
          ? report.meta.categories
          : [],
        version: typeof report.meta?.version === "number" ? report.meta.version : 1,
        rowCount:
          typeof report.meta?.rowCount === "number" ? report.meta.rowCount : null,
        totalOutstandingMinor:
          typeof report.meta?.totalOutstandingMinor === "number"
            ? report.meta.totalOutstandingMinor
            : null,
        overdueInvoiceCount:
          typeof report.meta?.overdueInvoiceCount === "number"
            ? report.meta.overdueInvoiceCount
            : null,
        receiptNumber:
          typeof report.meta?.receiptNumber === "string"
            ? report.meta.receiptNumber
            : null,
        amountPaidMinor:
          typeof report.meta?.amountPaidMinor === "number"
            ? report.meta.amountPaidMinor
            : null,
        balanceMinor:
          typeof report.meta?.balanceMinor === "number"
            ? report.meta.balanceMinor
            : null,
        studentName:
          typeof report.meta?.studentName === "string"
            ? report.meta.studentName
            : null,
        payerName:
          typeof report.meta?.payerName === "string"
            ? report.meta.payerName
            : null,
        paymentReference:
          typeof report.meta?.paymentReference === "string"
            ? report.meta.paymentReference
            : null,
      },
      createdAt: report.createdAt ? new Date(report.createdAt).toISOString() : null,
    },
  });
}
