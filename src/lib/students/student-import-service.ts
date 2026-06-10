/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import {
  parseStudentImportDate,
  STUDENT_IMPORT_MAX_ROWS,
  type StudentImportRow,
} from "@/lib/students/student-import-parse";
import {
  buildStudentImportClassIndex,
} from "@/lib/students/student-import-class-resolution";
import {
  normalizeImportSex,
  normalizeImportStatus,
} from "@/lib/students/student-import-field-normalize";
import { resolveStudentImportPlacement } from "@/lib/students/student-import-placement";

export type StudentImportResult = {
  success: boolean;
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
};

type FixedClassTarget = {
  classGroupId: string;
  gradeId: string;
};

export async function importStudentsFromRows(input: {
  schoolId: mongoose.Types.ObjectId;
  rows: StudentImportRow[];
  fixedClass?: FixedClassTarget | null;
}): Promise<StudentImportResult> {
  const { schoolId, rows, fixedClass = null } = input;

  if (rows.length === 0) {
    return {
      success: false,
      created: 0,
      failed: 0,
      errors: [{ row: 0, message: "File is empty or has no data rows" }],
    };
  }

  if (rows.length > STUDENT_IMPORT_MAX_ROWS) {
    return {
      success: false,
      created: 0,
      failed: 0,
      errors: [
        {
          row: 0,
          message: `Maximum ${STUDENT_IMPORT_MAX_ROWS} students per import. Please split your file.`,
        },
      ],
    };
  }

  const grades = await Grade.find({ schoolId, isActive: true })
    .select("name")
    .lean();

  const classGroups = await ClassGroup.find({
    schoolId,
    isActive: true,
  })
    .select("name gradeId")
    .lean();

  const classIndex = buildStudentImportClassIndex({
    grades: grades.map((g: any) => ({
      id: String(g._id),
      name: g.name as string,
    })),
    classGroups: classGroups.map((c: any) => ({
      id: String(c._id),
      gradeId: String(c.gradeId),
      name: c.name as string,
    })),
  });

  const result: StudentImportResult = {
    success: true,
    created: 0,
    failed: 0,
    errors: [],
  };

  const studentsToInsert: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

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

    let gradeId: string | undefined;
    let classInfo: { id: string; gradeId: string } | undefined;

    if (fixedClass) {
      gradeId = fixedClass.gradeId;
      classInfo = {
        id: fixedClass.classGroupId,
        gradeId: fixedClass.gradeId,
      };
    } else {
      const placement = resolveStudentImportPlacement({
        gradeInput: row.gradeName,
        classInput: row.className,
        index: classIndex,
      });

      if (!placement.ok) {
        result.errors.push({ row: rowNum, message: placement.message });
        result.failed++;
        continue;
      }

      gradeId = placement.gradeId;
      classInfo = {
        id: placement.classGroup.id,
        gradeId: placement.classGroup.gradeId,
      };
    }

    const sex = normalizeImportSex(row.sex);

    let status = normalizeImportStatus(row.status);

    const dateOfBirth = parseStudentImportDate(row.dateOfBirth);
    const enrolledAt = parseStudentImportDate(row.enrolledAt);

    studentsToInsert.push({
      schoolId,
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
  return result;
}

export async function resolveFixedClassTarget(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: string;
}): Promise<FixedClassTarget | null> {
  if (!mongoose.Types.ObjectId.isValid(input.classGroupId)) {
    return null;
  }

  const classGroup = await ClassGroup.findOne({
    _id: new mongoose.Types.ObjectId(input.classGroupId),
    schoolId: input.schoolId,
    isActive: true,
  })
    .select("_id gradeId")
    .lean();

  if (!classGroup) return null;

  return {
    classGroupId: String((classGroup as any)._id),
    gradeId: String((classGroup as any).gradeId),
  };
}
