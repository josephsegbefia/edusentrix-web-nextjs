// src/app/api/admin/admissions/applications/export/route.ts
// POST — return a CSV download of selected applications.
// Body: { ids?: string[], cycleId?: string, status?: string }
// Either explicit ids OR a cycleId/status filter must be supplied.

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { Grade } from "@/models/Grade";
import { recordAdmissionsManagerActivity } from "@/lib/admissions/recordAdmissionsManagerActivity";
import { auditClientMetaFromRequest } from "@/lib/audit/auditClientMetaFromRequest";

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const BodySchema = z.object({
  ids: z.array(objectIdString).max(2000).optional(),
  cycleId: objectIdString.optional(),
  status: z.string().optional(),
});

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const str = typeof value === "string" ? value : String(value);
  const needsQuote = /[",\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function isoOrEmpty(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  try {
    const d = new Date(value as string | number);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.export");
    await connectToDatabase();

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid export request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const filter: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (parsed.data.ids && parsed.data.ids.length > 0) {
      filter._id = {
        $in: parsed.data.ids.map((id) => new mongoose.Types.ObjectId(id)),
      };
    } else if (parsed.data.cycleId) {
      filter.cycleId = new mongoose.Types.ObjectId(parsed.data.cycleId);
      if (parsed.data.status) {
        const list = parsed.data.status.split(",").map((s) => s.trim()).filter(Boolean);
        if (list.length === 1) filter.status = list[0];
        else if (list.length > 1) filter.status = { $in: list };
      }
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Provide ids[] or cycleId for export",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apps = await AdmissionApplication.find(filter)
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const gradeIds = Array.from(
      new Set(
        apps
          .map((a) => a.applicant?.intendedGradeId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    );
    const grades = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds } })
          .select({ _id: 1, name: 1 })
          .lean()
      : [];
    const gradeNameById = new Map<string, string>(
      grades.map((g) => [String(g._id), String(g.name)])
    );

    const headers = [
      "reference_code",
      "status",
      "channel",
      "fee_status",
      "submitted_at",
      "applicant_first_name",
      "applicant_last_name",
      "applicant_sex",
      "applicant_date_of_birth",
      "intended_grade",
      "guardian_first_name",
      "guardian_last_name",
      "guardian_relationship",
      "guardian_email",
      "guardian_phone",
      "documents_count",
      "decision_outcome",
      "provisioned",
    ];

    const lines: string[] = [headers.join(",")];
    for (const app of apps) {
      const gradeName = app.applicant?.intendedGradeId
        ? gradeNameById.get(String(app.applicant.intendedGradeId)) ?? ""
        : "";
      const row = [
        app.referenceCode ?? "",
        app.status ?? "",
        app.channel ?? "",
        app.feeStatus ?? "",
        isoOrEmpty(app.submittedAt),
        app.applicant?.firstName ?? "",
        app.applicant?.lastName ?? "",
        app.applicant?.sex ?? "",
        isoOrEmpty(app.applicant?.dateOfBirth),
        gradeName,
        app.guardian?.firstName ?? "",
        app.guardian?.lastName ?? "",
        app.guardian?.relationship ?? "",
        app.guardian?.email ?? "",
        app.guardian?.phone ?? "",
        Array.isArray(app.documents) ? app.documents.length : 0,
        app.decision?.outcome ?? "",
        app.provisioned ? "yes" : "no",
      ];
      lines.push(row.map(escapeCsv).join(","));
    }

    const csv = lines.join("\n");
    const filename = `admissions-${Date.now()}.csv`;

    const client = auditClientMetaFromRequest(req);
    const filterMeta =
      parsed.data.ids && parsed.data.ids.length > 0
        ? { filter: "ids" as const, idCount: parsed.data.ids.length }
        : {
            filter: "cycle" as const,
            cycleId: parsed.data.cycleId,
            ...(parsed.data.status
              ? { statusFilter: parsed.data.status }
              : {}),
          };
    await recordAdmissionsManagerActivity({
      ctx,
      type: "admissions.application.exported",
      description: `Exported ${apps.length} admissions application(s) to CSV`,
      delegationAction: "admissions.application.exported",
      metadata: { rowCount: apps.length, ...filterMeta },
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions export POST error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Export failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
