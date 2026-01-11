// src/app/api/admin/teachers/bulk-export/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/teachers/bulk-export
 * Export teachers as CSV
 * Body: { teacherIds?: string[], filters?: {...} } (optional - if teacherIds provided, only export those; otherwise use filters)
 */
export async function POST(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Parse body (optional)
  let body: { teacherIds?: string[]; filters?: Record<string, unknown> } = {};
  try {
    const bodyText = await req.text();
    if (bodyText) {
      body = JSON.parse(bodyText);
    }
  } catch {
    // Body is optional
  }

  const { teacherIds, filters } = body;

  // Build query
  const query: Record<string, unknown> = {
    schoolId: schoolIdObj,
  };

  if (teacherIds && Array.isArray(teacherIds) && teacherIds.length > 0) {
    const teacherObjIds = teacherIds
      .map((id) => toObjectIdOrNull(id))
      .filter((id): id is mongoose.Types.ObjectId => id !== null);
    if (teacherObjIds.length > 0) {
      query._id = { $in: teacherObjIds };
    }
  } else if (filters) {
    // Apply filters if provided
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.search) {
      query.$or = [
        { firstName: { $regex: String(filters.search), $options: "i" } },
        { lastName: { $regex: String(filters.search), $options: "i" } },
        { email: { $regex: String(filters.search), $options: "i" } },
        { employeeId: { $regex: String(filters.search), $options: "i" } },
      ];
    }
  }

  // Fetch teachers with populated data
  const teachers = await Teacher.find(query)
    .populate("userId", "email")
    .populate("subjectIds", "name code")
    .populate("homeroomClassGroupId", "name")
    .sort({ lastName: 1, firstName: 1 })
    .lean();

  // Generate CSV
  const headers = [
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Employee ID",
    "Status",
    "Department",
    "Hire Date",
    "Termination Date",
    "Subjects",
    "Homeroom",
    "Max Classes",
    "Max Students",
  ];

  const rows = teachers.map((teacher: any) => {
    const user = teacher.userId;
    const subjects = Array.isArray(teacher.subjectIds)
      ? teacher.subjectIds.map((s: any) => s.name || "").join("; ")
      : "";
    const homeroom = teacher.homeroomClassGroupId
      ? String(teacher.homeroomClassGroupId.name || "")
      : "";

    return [
      String(teacher.firstName || ""),
      String(teacher.lastName || ""),
      user?.email || "",
      String(teacher.phone || ""),
      String(teacher.employeeId || ""),
      String(teacher.status || ""),
      String(teacher.department || ""),
      teacher.hireDate ? new Date(teacher.hireDate).toLocaleDateString() : "",
      teacher.terminationDate
        ? new Date(teacher.terminationDate).toLocaleDateString()
        : "",
      subjects,
      homeroom,
      String(teacher.maxClasses || ""),
      String(teacher.maxStudents || ""),
    ];
  });

  // Escape CSV values
  const escapeCsv = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Build CSV content
  const csvLines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ];
  const csvContent = csvLines.join("\n");

  // Return CSV file
  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="teachers-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
