/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import {
  buildFinanceStaffAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import mongoose from "mongoose";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId, userId, roles } = await requireFinanceStaff();
    await connectToDatabase();

    if (!mongoose.models.Grade) {
      const _ = Grade.modelName;
      void _;
    }
    if (!mongoose.models.ClassGroup) {
      const _ = ClassGroup.modelName;
      void _;
    }

    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const tab = searchParams.get("tab") || "all";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrderParam = searchParams.get("sortOrder") || "asc";
    const sortOrder: 1 | -1 = sortOrderParam === "desc" ? -1 : 1;
    const selectedIdsStr = searchParams.get("selectedIds");
    const gradeId = searchParams.get("gradeId") || null;
    const classGroupId = searchParams.get("classGroupId") || null;
    const status = searchParams.get("status") || null;
    const gender = searchParams.get("gender") || null;

    const query: Record<string, unknown> = { schoolId };

    if (selectedIdsStr) {
      const ids = selectedIdsStr
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        query._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
      }
    }

    if (gradeId) query.gradeId = gradeId;
    if (classGroupId) query.classGroupId = classGroupId;
    if (status && status !== "all") query.status = status;
    if (gender === "male" || gender === "female") query.sex = gender;

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { firstName: regex },
        { middleName: regex },
        { lastName: regex },
        { admissionNo: regex },
      ];
    }

    if (tab === "recent") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.createdAt = { $gte: thirtyDaysAgo };
    }

    const sort: Record<string, 1 | -1> = {};
    switch (sortBy) {
      case "class":
        sort.gradeId = sortOrder;
        sort.classGroupId = sortOrder;
        sort.lastName = sortOrder;
        break;
      case "enrollmentDate":
        sort.enrolledAt = sortOrder;
        break;
      case "createdAt":
        sort.createdAt = sortOrder;
        break;
      case "name":
      default:
        sort.lastName = sortOrder;
        sort.firstName = sortOrder;
        break;
    }

    const items = await Student.find(query)
      .sort(sort)
      .limit(5000)
      .populate("gradeId", "name")
      .populate("classGroupId", "name")
      .lean();

    const csvHeaders = [
      "First Name",
      "Middle Name",
      "Last Name",
      "Admission No",
      "Grade",
      "Class",
      "Sex",
      "Date of Birth",
      "Status",
      "Enrolled At",
      "Created At",
    ];

    const csvRows = items.map((s: any) => {
      const grade = s.gradeId as any;
      const classGroup = s.classGroupId as any;

      const dob = s.dateOfBirth
        ? new Date(s.dateOfBirth).toISOString().split("T")[0]
        : "";
      const enrolledAt = s.enrolledAt
        ? new Date(s.enrolledAt).toISOString().split("T")[0]
        : "";
      const createdAt = s.createdAt
        ? new Date(s.createdAt).toISOString().split("T")[0]
        : "";

      return [
        escapeCsvField(s.firstName || ""),
        escapeCsvField(s.middleName || ""),
        escapeCsvField(s.lastName || ""),
        escapeCsvField(s.admissionNo || ""),
        escapeCsvField(grade?.name || ""),
        escapeCsvField(classGroup?.name || ""),
        escapeCsvField(s.sex || ""),
        dob,
        escapeCsvField(s.status || ""),
        enrolledAt,
        createdAt,
      ].join(",");
    });

    const csv =
      csvHeaders.map(escapeCsvField).join(",") + "\n" + csvRows.join("\n");

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `students-export-${timestamp}.csv`;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    try {
      await writeRetryableAuditEvent({
        actionCode: "export.generated",
        scopeType: "school",
        scopeId: String(schoolIdObj),
        result: "succeeded",
        target: {
          targetEntityType: "School",
          targetEntityId: schoolIdObj,
        },
        context: buildFinanceStaffAuditContext(req, {
          userId: userIdObj,
          schoolId: schoolIdObj,
          roles,
          idempotencyKey: resolveAuditIdempotencyKey(
            req,
            `export.students:${req.nextUrl.searchParams.toString()}`
          ),
        }),
        payload: {
          metadata: {
            exportKind: "students_csv",
            rowCount: items.length,
            filename,
          },
        },
        streamKey: `school:${String(schoolIdObj)}:exports`,
      });
    } catch (auditErr) {
      console.error("export.generated audit failed:", auditErr);
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("Student export error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to export students";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
