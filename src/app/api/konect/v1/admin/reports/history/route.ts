import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ReportExport } from "@/models/ReportExport";
import { REPORT_DEFINITIONS, type ReportKey } from "@/constants/reports";

const REPORT_STATUSES = new Set(["queued", "processing", "completed", "failed"]);
function boundedInteger(value: string | null, fallback: number, max: number) {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  return Math.min(max, Math.max(1, Number(value)));
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("reports");
  await connectToDatabase();
  const url = new URL(req.url);
  const limit = boundedInteger(url.searchParams.get("limit"), 20, 50);
  const page = boundedInteger(url.searchParams.get("page"), 1, 1000000);
  const filter: Record<string, unknown> = { schoolId };
  const status = url.searchParams.get("status");
  const reportKey = url.searchParams.get("reportKey");
  if (status) {
    if (!REPORT_STATUSES.has(status)) return NextResponse.json({ success: false, error: "Invalid report status." }, { status: 400 });
    filter.status = status;
  }
  if (reportKey) {
    if (!REPORT_DEFINITIONS[reportKey as ReportKey]) return NextResponse.json({ success: false, error: "Invalid report key." }, { status: 400 });
    filter.reportKey = reportKey;
  }
  const [total, rows] = await Promise.all([
    ReportExport.countDocuments(filter),
    ReportExport.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return NextResponse.json({
    success: true,
    data: rows.map((row) => {
      const definition = REPORT_DEFINITIONS[row.reportKey as ReportKey];
      return {
        id: String(row._id), reportKey: row.reportKey,
        reportTitle: row.reportLabel || definition?.label || row.reportKey,
        category: definition?.category || null, format: row.format, status: row.status,
        rangeMode: row.rangeMode,
        range: row.range ? {
          startDate: row.range.startDate?.toISOString?.() || null,
          endDate: row.range.endDate?.toISOString?.() || null,
          periodId: row.range.periodId ? String(row.range.periodId) : null,
          periodLabel: row.range.periodLabel || null,
        } : null,
        rowCount: row.rowCount ?? null, fileName: row.fileName || null,
        createdAt: row.createdAt?.toISOString?.() || null,
        completedAt: row.completedAt?.toISOString?.() || null,
        downloadedAt: row.downloadedAt?.toISOString?.() || null,
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
