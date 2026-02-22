/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import mongoose from "mongoose";

type CsvRow = {
  firstName: string;
  middleName?: string;
  lastName: string;
  gradeName: string;
  className: string;
  admissionNo?: string;
  sex?: string;
  dateOfBirth?: string;
  status?: string;
  enrolledAt?: string;
};

type ImportResult = {
  success: boolean;
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = parseCsvLine(headerLine);

  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const normalized = h
      .replace(/[^a-z0-9]/g, "")
      .replace(/firstname/g, "firstname")
      .replace(/middlename/g, "middlename")
      .replace(/lastname/g, "lastname")
      .replace(/gradename|grade/g, "gradename")
      .replace(/classname|class$/g, "classname")
      .replace(/admissionno|admissionnumber|admno/g, "admissionno")
      .replace(/dateofbirth|dob/g, "dateofbirth")
      .replace(/enrolledat|enrollmentdate|enrolldate/g, "enrolledat")
      .replace(/gender/g, "sex");

    headerMap[normalized] = i;
  });

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);

    const get = (key: string) => {
      const idx = headerMap[key];
      if (idx === undefined) return undefined;
      const val = values[idx]?.trim();
      return val || undefined;
    };

    rows.push({
      firstName: get("firstname") || "",
      middleName: get("middlename"),
      lastName: get("lastname") || "",
      gradeName: get("gradename") || "",
      className: get("classname") || "",
      admissionNo: get("admissionno"),
      sex: get("sex"),
      dateOfBirth: get("dateofbirth"),
      status: get("status"),
      enrolledAt: get("enrolledat"),
    });
  }

  return rows;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const parts = value.split(/[/\-.]/).map(Number);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a > 31) return new Date(a, b - 1, c);
      if (c > 31) return new Date(c, a - 1, b);
      return new Date(c + 2000, a - 1, b);
    }
    return null;
  }
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "CSV file is empty or has no data rows" },
        { status: 400 }
      );
    }

    if (rows.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum 500 students per import. Please split your file.",
        },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const grades = await Grade.find({ schoolId: schoolIdObj, isActive: true })
      .select("name")
      .lean();
    const gradeMap = new Map<string, string>();
    for (const g of grades) {
      gradeMap.set((g as any).name.toLowerCase().trim(), String((g as any)._id));
    }

    const classGroups = await ClassGroup.find({
      schoolId: schoolIdObj,
      isActive: true,
    })
      .select("name gradeId")
      .lean();
    const classMap = new Map<string, { id: string; gradeId: string }>();
    for (const c of classGroups) {
      const key = `${String((c as any).gradeId)}_${(c as any).name.toLowerCase().trim()}`;
      classMap.set(key, {
        id: String((c as any)._id),
        gradeId: String((c as any).gradeId),
      });
    }

    const result: ImportResult = {
      success: true,
      created: 0,
      failed: 0,
      errors: [],
    };

    const studentsToInsert: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header

      if (!row.firstName) {
        result.errors.push({ row: rowNum, message: "First name is required" });
        result.failed++;
        continue;
      }
      if (!row.lastName) {
        result.errors.push({ row: rowNum, message: "Last name is required" });
        result.failed++;
        continue;
      }
      if (!row.gradeName) {
        result.errors.push({ row: rowNum, message: "Grade is required" });
        result.failed++;
        continue;
      }
      if (!row.className) {
        result.errors.push({ row: rowNum, message: "Class name is required" });
        result.failed++;
        continue;
      }

      const gradeId = gradeMap.get(row.gradeName.toLowerCase().trim());
      if (!gradeId) {
        result.errors.push({
          row: rowNum,
          message: `Grade "${row.gradeName}" not found. Available grades: ${[...gradeMap.keys()].join(", ")}`,
        });
        result.failed++;
        continue;
      }

      const classKey = `${gradeId}_${row.className.toLowerCase().trim()}`;
      const classInfo = classMap.get(classKey);
      if (!classInfo) {
        result.errors.push({
          row: rowNum,
          message: `Class "${row.className}" not found under grade "${row.gradeName}"`,
        });
        result.failed++;
        continue;
      }

      let sex: "male" | "female" | undefined;
      if (row.sex) {
        const normalized = row.sex.toLowerCase().trim();
        if (normalized === "m" || normalized === "male") sex = "male";
        else if (normalized === "f" || normalized === "female") sex = "female";
        else {
          result.errors.push({
            row: rowNum,
            message: `Invalid sex "${row.sex}". Use "male", "female", "m", or "f"`,
          });
          result.failed++;
          continue;
        }
      }

      let status: "active" | "inactive" | "withdrawn" = "active";
      if (row.status) {
        const s = row.status.toLowerCase().trim();
        if (s === "active" || s === "inactive" || s === "withdrawn") {
          status = s;
        }
      }

      const dateOfBirth = parseDate(row.dateOfBirth);
      const enrolledAt = parseDate(row.enrolledAt);

      studentsToInsert.push({
        schoolId: schoolIdObj,
        firstName: row.firstName.trim(),
        middleName: row.middleName?.trim() || null,
        lastName: row.lastName.trim(),
        gradeId: new mongoose.Types.ObjectId(gradeId),
        classGroupId: new mongoose.Types.ObjectId(classInfo.id),
        admissionNo: row.admissionNo?.trim() || null,
        sex: sex || undefined,
        dateOfBirth,
        status,
        enrolledAt: enrolledAt || new Date(),
      });
    }

    if (studentsToInsert.length > 0) {
      try {
        const inserted = await Student.insertMany(studentsToInsert, {
          ordered: false,
        });
        result.created = inserted.length;
      } catch (bulkError: any) {
        if (bulkError.insertedDocs) {
          result.created = bulkError.insertedDocs.length;
        }

        if (bulkError.writeErrors) {
          for (const we of bulkError.writeErrors) {
            const idx = we.index;
            const s = studentsToInsert[idx];
            const name = `${s?.firstName} ${s?.lastName}`;
            let msg = we.errmsg || "Unknown error";
            if (msg.includes("duplicate")) {
              msg = `Duplicate admission number for ${name}`;
            }
            result.errors.push({ row: idx + 2, message: msg });
            result.failed++;
          }
        }
      }
    }

    result.success = result.created > 0;

    return NextResponse.json(result, { status: result.created > 0 ? 201 : 400 });
  } catch (e: unknown) {
    console.error("Student import error:", e);
    const message =
      e instanceof Error ? e.message : "Failed to import students";
    return NextResponse.json(
      { success: false, error: message, created: 0, failed: 0, errors: [] },
      { status: 500 }
    );
  }
}
