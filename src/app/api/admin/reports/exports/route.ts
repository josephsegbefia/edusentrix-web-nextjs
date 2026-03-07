import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod, type IAcademicPeriod } from "@/models/AcademicPeriod";
import { ReportExport } from "@/models/ReportExport";
import { hasFeature } from "@/lib/billing/entitlements";
import { trackUsage } from "@/lib/billing/trackUsage";
import {
  REPORT_DEFINITIONS,
  type ReportKey,
  type ReportFormat,
} from "@/constants/reports";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXPORT_LIMIT = 5000;

const CreateExportSchema = z.object({
  reportKey: z.string().min(1),
  format: z.enum(["csv", "pdf"]).optional(),
  periodId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  label: z.string().optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

function startOfDay(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(d: Date): Date {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function resolveDateRange(
  schoolId: mongoose.Types.ObjectId,
  periodId?: string,
  startDateInput?: string,
  endDateInput?: string
) {
  if (periodId) {
    if (!mongoose.Types.ObjectId.isValid(periodId)) {
      return { error: "Invalid periodId" } as const;
    }
    const period = (await AcademicPeriod.findOne({
      _id: periodId,
      schoolId,
    })
      .select("yearLabel term startDate endDate")
      .lean()) as unknown as IAcademicPeriod | null;
    if (!period) {
      return { error: "Academic period not found" } as const;
    }
    return {
      startDate: startOfDay(new Date(period.startDate)),
      endDate: endOfDay(new Date(period.endDate)),
      source: "period" as const,
      period: {
        id: String(period._id),
        term: period.term,
        yearLabel: period.yearLabel,
        label: `${period.term} ${period.yearLabel}`,
        startDate: new Date(period.startDate).toISOString(),
        endDate: new Date(period.endDate).toISOString(),
      },
      periodIdObj: new mongoose.Types.ObjectId(String(period._id)),
    } as const;
  }

  const startParam = parseDate(startDateInput);
  const endParam = parseDate(endDateInput);
  if (startParam || endParam) {
    const endDate = endParam ?? new Date();
    const startDate = startParam ?? new Date(endDate.getTime() - 29 * DAY_MS);
    if (startDate > endDate) {
      return { error: "startDate must be before endDate" } as const;
    }
    return {
      startDate: startOfDay(startDate),
      endDate: endOfDay(endDate),
      source: "custom" as const,
      period: null,
      periodIdObj: null,
    } as const;
  }

  const currentPeriod = (await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  })
    .select("yearLabel term startDate endDate")
    .lean()) as unknown as IAcademicPeriod | null;

  if (currentPeriod) {
    return {
      startDate: startOfDay(new Date(currentPeriod.startDate)),
      endDate: endOfDay(new Date(currentPeriod.endDate)),
      source: "current_period" as const,
      period: {
        id: String(currentPeriod._id),
        term: currentPeriod.term,
        yearLabel: currentPeriod.yearLabel,
        label: `${currentPeriod.term} ${currentPeriod.yearLabel}`,
        startDate: new Date(currentPeriod.startDate).toISOString(),
        endDate: new Date(currentPeriod.endDate).toISOString(),
      },
      periodIdObj: new mongoose.Types.ObjectId(String(currentPeriod._id)),
    } as const;
  }

  const endDate = endOfDay(new Date());
  const startDate = startOfDay(new Date(endDate.getTime() - 89 * DAY_MS));
  return {
    startDate,
    endDate,
    source: "default" as const,
    period: null,
    periodIdObj: null,
  } as const;
}

function buildFileName(
  reportKey: ReportKey,
  format: ReportFormat,
  startDate: Date,
  endDate: Date
) {
  const slug = reportKey.replace(/\./g, "-");
  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];
  return `${slug}-${start}-to-${end}.${format}`;
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  if (!schoolId) {
    return NextResponse.json({ error: "School ID not found" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  if (!(await hasFeature(schoolIdObj, "reports"))) {
    return NextResponse.json(
      { error: "Your subscription does not include reports." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || "10"))
  );
  const status = searchParams.get("status");
  const reportKey = searchParams.get("reportKey");

  const filter: Record<string, unknown> = { schoolId: schoolIdObj };
  if (status) {
    filter.status = status;
  }
  if (reportKey) {
    filter.reportKey = reportKey;
  }

  const items = (await ReportExport.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("requestedBy", "firstName lastName email")
    .lean()) as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    reportKey: ReportKey;
    reportLabel?: string | null;
    format: ReportFormat;
    status: string;
    rangeMode: string;
    range: {
      startDate: Date;
      endDate: Date;
      periodId?: mongoose.Types.ObjectId | null;
      periodLabel?: string | null;
      source?: string;
    };
    rowCount?: number | null;
    fileName?: string | null;
    completedAt?: Date | null;
    downloadedAt?: Date | null;
    createdAt: Date;
    requestedBy?: {
      _id: mongoose.Types.ObjectId;
      firstName?: string;
      lastName?: string;
      email?: string;
    } | null;
  }>;

  return NextResponse.json({
    success: true,
    data: items.map((item) => {
      const requestedBy = item.requestedBy;
      const definition = REPORT_DEFINITIONS[item.reportKey];
      return {
        id: String(item._id),
        reportKey: item.reportKey,
        reportLabel: item.reportLabel || definition?.label || item.reportKey,
        format: item.format,
        status: item.status,
        rangeMode: item.rangeMode,
        range: {
          startDate: item.range.startDate.toISOString(),
          endDate: item.range.endDate.toISOString(),
          periodId: item.range.periodId ? String(item.range.periodId) : null,
          periodLabel: item.range.periodLabel || null,
          source: item.range.source || "custom",
        },
        rowCount: item.rowCount ?? null,
        fileName: item.fileName ?? null,
        createdAt: item.createdAt.toISOString(),
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        downloadedAt: item.downloadedAt
          ? item.downloadedAt.toISOString()
          : null,
        requestedBy: requestedBy
          ? {
              id: String(requestedBy._id),
              firstName: requestedBy.firstName || null,
              lastName: requestedBy.lastName || null,
              email: requestedBy.email || null,
            }
          : null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  if (!schoolId) {
    return NextResponse.json({ error: "School ID not found" }, { status: 400 });
  }

  let body: z.infer<typeof CreateExportSchema>;
  try {
    body = CreateExportSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 }
    );
  }

  const reportKey = body.reportKey as ReportKey;
  if (!REPORT_DEFINITIONS[reportKey]) {
    return NextResponse.json({ error: "Unknown report key" }, { status: 400 });
  }

  const definition = REPORT_DEFINITIONS[reportKey];
  const format = (body.format || "csv") as ReportFormat;
  if (!definition.formats.includes(format)) {
    return NextResponse.json(
      { error: "Format not supported for this report" },
      { status: 400 }
    );
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const range = await resolveDateRange(
    schoolIdObj,
    body.periodId,
    body.startDate,
    body.endDate
  );
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const limit =
    body.limit && Number.isFinite(body.limit)
      ? Math.min(body.limit, 10000)
      : DEFAULT_EXPORT_LIMIT;

  const exportDoc = await ReportExport.create({
    schoolId: schoolIdObj,
    requestedBy: userId,
    reportKey,
    reportLabel: body.label || definition.label,
    format,
    status: "queued",
    rangeMode: definition.rangeMode,
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      periodId: range.periodIdObj,
      periodLabel: range.period?.label || null,
      source: range.source,
    },
    filters: body.filters || {},
    limit,
    fileName: buildFileName(
      reportKey,
      format,
      range.startDate,
      range.endDate
    ),
  });

  await trackUsage({
    schoolId: schoolIdObj,
    provider: "internal",
    metricKey: "report_exports_requested",
    quantity: 1,
    unitLabel: "exports",
    unitCostMinor: 0,
    estimatedCostMinor: 0,
    allocationMethod: "direct",
    sourceType: "system_estimate",
    notes: `Report export queued for ${reportKey}.`,
    actorId: userId,
  });

  return NextResponse.json({
    success: true,
    data: {
      id: String(exportDoc._id),
      reportKey,
      reportLabel: exportDoc.reportLabel,
      format,
      status: exportDoc.status,
      rangeMode: exportDoc.rangeMode,
      range: {
        startDate: exportDoc.range.startDate.toISOString(),
        endDate: exportDoc.range.endDate.toISOString(),
        periodId: exportDoc.range.periodId
          ? String(exportDoc.range.periodId)
          : null,
        periodLabel: exportDoc.range.periodLabel || null,
        source: exportDoc.range.source,
      },
      fileName: exportDoc.fileName,
      downloadUrl: `/api/admin/reports/export?exportId=${exportDoc._id}`,
    },
  });
}
