import mongoose from "mongoose";
import { Teacher } from "@/models/Teacher";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { School } from "@/models/School";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import { ensureCanonicalUserForEmail, ensureMembershipForUser } from "@/lib/auth/canonical-user";
import { parseTeacherImportFile, type TeacherImportRow } from "@/lib/teachers/parse-teacher-import";

function toObjectIdOrNull(id: string): mongoose.Types.ObjectId | null {
  if (!id || !id.trim()) return null;
  try {
    return new mongoose.Types.ObjectId(String(id.trim()));
  } catch {
    return null;
  }
}

function normalizeLookupValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function uniqueObjectIds(ids: mongoose.Types.ObjectId[]) {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitMultiValue(value: string) {
  return value
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function subjectOfferingAliases(offering: {
  displayName?: string | null;
  shortName?: string | null;
  code?: string | null;
  subjectFamily?: string | null;
}) {
  const raw = [
    offering.displayName,
    offering.shortName,
    offering.code,
    offering.subjectFamily,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => [
      value,
      value.replace(/\s*-\s*(jhs|shs|primary|upper primary|lower primary)\s*$/i, ""),
    ]);

  return Array.from(new Set(raw.map(normalizeLookupValue).filter(Boolean)));
}

export type TeacherBulkImportResult = {
  totalRows: number;
  successful: number;
  failed: number;
  results: Array<{
    row: number;
    success: boolean;
    teacherId?: string;
    email?: string;
    error?: string;
  }>;
};

export async function importTeachersFromBuffer(input: {
  schoolId: mongoose.Types.ObjectId;
  adminUserId: mongoose.Types.ObjectId;
  fileName: string;
  fileBytes: Buffer;
}): Promise<TeacherBulkImportResult> {
  const normalizedRows = parseTeacherImportFile(input.fileBytes, input.fileName);
  if (normalizedRows.length === 0) {
    throw new Error("Import file contains no data rows");
  }

  const requiredColumns = ["firstName", "lastName", "email"] as const;
  const firstRow = normalizedRows[0];
  const missingColumns = requiredColumns.filter(
    (col) =>
      !(col in firstRow) && !Object.keys(firstRow).some((k) => k.toLowerCase() === col.toLowerCase())
  );
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  const school = await School.findById(input.schoolId).select("name").lean();
  const schoolName = school ? (school as { name?: string }).name : "your school";

  const allSubjectOfferings = await SubjectOffering.find({
    schoolId: input.schoolId,
    isActive: true,
  })
    .select("_id subjectId displayName shortName code subjectFamily")
    .lean();

  const subjectOfferingMap = new Map<string, (typeof allSubjectOfferings)[number]>();
  for (const offering of allSubjectOfferings) {
    for (const alias of subjectOfferingAliases(offering)) {
      if (!subjectOfferingMap.has(alias)) {
        subjectOfferingMap.set(alias, offering);
      }
    }
  }

  const allClassGroups = await ClassGroup.find({
    schoolId: input.schoolId,
    isActive: true,
  })
    .select("_id name gradeId homeroomTeacherId")
    .lean();

  const allGrades = await Grade.find({
    schoolId: input.schoolId,
    isActive: true,
  })
    .select("_id name")
    .lean();

  const gradeNameById = new Map(allGrades.map((grade) => [String(grade._id), grade.name]));
  const classGroupMap = new Map<string, (typeof allClassGroups)[number][]>();
  for (const classGroup of allClassGroups) {
    const gradeName = gradeNameById.get(String(classGroup.gradeId)) ?? "";
    const aliases = [
      classGroup.name,
      `${gradeName} ${classGroup.name}`,
      classGroup.name.replace(/^(.+?)([A-Z])$/i, "$1 $2"),
    ].filter(Boolean);
    for (const alias of aliases) {
      const key = normalizeLookupValue(alias);
      if (!key) continue;
      const existing = classGroupMap.get(key) ?? [];
      existing.push(classGroup);
      classGroupMap.set(key, existing);
    }
  }

  const results: TeacherBulkImportResult["results"] = [];

  for (let i = 0; i < normalizedRows.length; i++) {
    const row = normalizedRows[i];
    const rowNumber = i + 2;
    try {
      await importOneTeacherRow({
        row,
        rowNumber,
        schoolId: input.schoolId,
        adminUserId: input.adminUserId,
        schoolName: schoolName || "your school",
        subjectOfferingMap,
        allSubjectOfferings,
        classGroupMap,
        gradeNameById,
        results,
      });
    } catch (error) {
      results.push({
        row: rowNumber,
        success: false,
        email: row.email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    totalRows: normalizedRows.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

async function importOneTeacherRow(input: {
  row: TeacherImportRow;
  rowNumber: number;
  schoolId: mongoose.Types.ObjectId;
  adminUserId: mongoose.Types.ObjectId;
  schoolName: string;
  subjectOfferingMap: Map<string, { _id: unknown; subjectId: unknown }>;
  allSubjectOfferings: Array<{ displayName?: string | null; shortName?: string | null; code?: string | null }>;
  classGroupMap: Map<string, Array<{ _id: unknown; name: string; gradeId: unknown; homeroomTeacherId?: unknown }>>;
  gradeNameById: Map<string, string>;
  results: TeacherBulkImportResult["results"];
}) {
  const { row, rowNumber, schoolId, adminUserId, schoolName } = input;

  if (!row.firstName?.trim() || !row.lastName?.trim()) {
    input.results.push({
      row: rowNumber,
      success: false,
      email: row.email,
      error: "Missing required fields: firstName or lastName",
    });
    return;
  }
  if (!row.email?.trim()) {
    input.results.push({
      row: rowNumber,
      success: false,
      email: row.email,
      error: "Missing required field: email",
    });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedEmail = row.email.toLowerCase().trim();
  if (!emailRegex.test(normalizedEmail)) {
    input.results.push({
      row: rowNumber,
      success: false,
      email: row.email,
      error: "Invalid email format",
    });
    return;
  }

  let subjectIds: mongoose.Types.ObjectId[] = [];
  let subjectOfferingIds: mongoose.Types.ObjectId[] = [];
  const subjectInput = (row.subjects || row.subjectOfferingIds || row.subjectIds || "").trim();
  if (subjectInput) {
    const parts = splitMultiValue(subjectInput);
    if (parts.length > 0) {
      const looksLikeId = /^[a-f0-9]{24}$/i.test(parts[0]);
      if (looksLikeId) {
        const validSubjectOfferingIds = parts
          .map((id) => toObjectIdOrNull(id))
          .filter((id): id is mongoose.Types.ObjectId => id !== null);
        const offerings = await SubjectOffering.find({
          _id: { $in: validSubjectOfferingIds },
          schoolId,
          isActive: true,
        }).lean();
        if (offerings.length !== validSubjectOfferingIds.length) {
          input.results.push({
            row: rowNumber,
            success: false,
            email: normalizedEmail,
            error: "One or more subject offering IDs are invalid or not found",
          });
          return;
        }
        subjectOfferingIds = offerings.map((offering) =>
          offering._id instanceof mongoose.Types.ObjectId
            ? offering._id
            : new mongoose.Types.ObjectId(String(offering._id))
        );
        subjectIds = offerings.map((offering) =>
          offering.subjectId instanceof mongoose.Types.ObjectId
            ? offering.subjectId
            : new mongoose.Types.ObjectId(String(offering.subjectId))
        );
      } else {
        for (const name of parts) {
          const offering = input.subjectOfferingMap.get(normalizeLookupValue(name));
          if (!offering) {
            const available = input.allSubjectOfferings
              .map((item) => item.displayName || item.shortName || item.code)
              .filter(Boolean)
              .slice(0, 12)
              .join("; ");
            input.results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: `Subject "${name}" was not found. Use subject offering names such as: ${available}${input.allSubjectOfferings.length > 12 ? "..." : ""}`,
            });
            return;
          }
          subjectOfferingIds.push(
            offering._id instanceof mongoose.Types.ObjectId
              ? offering._id
              : new mongoose.Types.ObjectId(String(offering._id))
          );
          subjectIds.push(
            offering.subjectId instanceof mongoose.Types.ObjectId
              ? offering.subjectId
              : new mongoose.Types.ObjectId(String(offering.subjectId))
          );
        }
      }
    }
  }
  subjectIds = uniqueObjectIds(subjectIds);
  subjectOfferingIds = uniqueObjectIds(subjectOfferingIds);

  let homeroomClassGroupId: mongoose.Types.ObjectId | null = null;
  const hasHomeroomByName =
    row.homeroom?.trim() ||
    (row.homeroomGrade?.trim() && row.homeroomClass?.trim()) ||
    row.homeroomClass?.trim();
  const hasHomeroomById = row.homeroomClassGroupId?.trim();

  if (hasHomeroomByName) {
    const homeroomInput = row.homeroom?.trim()
      ? row.homeroom.trim()
      : row.homeroomGrade?.trim() && row.homeroomClass?.trim()
        ? `${row.homeroomGrade.trim()} ${row.homeroomClass.trim()}`
        : row.homeroomClass!.trim();
    const matches = input.classGroupMap.get(normalizeLookupValue(homeroomInput)) ?? [];
    if (matches.length === 0) {
      input.results.push({
        row: rowNumber,
        success: false,
        email: normalizedEmail,
        error: `Homeroom class "${homeroomInput}" was not found. Use the class name as shown in Class Groups, for example "JHS 1 A".`,
      });
      return;
    }
    if (matches.length > 1) {
      const candidates = matches
        .map((match) => `${input.gradeNameById.get(String(match.gradeId)) ?? "Grade"} / ${match.name}`)
        .join(", ");
      input.results.push({
        row: rowNumber,
        success: false,
        email: normalizedEmail,
        error: `Homeroom class "${homeroomInput}" matches multiple classes: ${candidates}. Use a fuller name such as "JHS 1 A".`,
      });
      return;
    }
    homeroomClassGroupId =
      matches[0]._id instanceof mongoose.Types.ObjectId
        ? matches[0]._id
        : new mongoose.Types.ObjectId(String(matches[0]._id));
  } else if (hasHomeroomById) {
    const classGroupObjId = toObjectIdOrNull(row.homeroomClassGroupId!);
    if (!classGroupObjId) {
      input.results.push({
        row: rowNumber,
        success: false,
        email: normalizedEmail,
        error: "Invalid homeroom class group ID format",
      });
      return;
    }
    const classGroup = await ClassGroup.findOne({
      _id: classGroupObjId,
      schoolId,
      isActive: true,
    }).lean();
    if (!classGroup) {
      input.results.push({
        row: rowNumber,
        success: false,
        email: normalizedEmail,
        error: "Homeroom class group not found or not active",
      });
      return;
    }
    homeroomClassGroupId = classGroupObjId;
  }

  const status = row.status?.trim().toLowerCase() || "active";
  if (!["active", "inactive", "on_leave", "terminated"].includes(status)) {
    input.results.push({
      row: rowNumber,
      success: false,
      email: normalizedEmail,
      error: `Invalid status: ${status}. Must be one of: active, inactive, on_leave, terminated`,
    });
    return;
  }

  const teacherUser = await ensureCanonicalUserForEmail({
    email: normalizedEmail,
    firstName: row.firstName.trim(),
    lastName: row.lastName.trim(),
    phone: row.phone?.trim() || undefined,
    role: "teacher",
    schoolId,
    pendingOnboarding: false,
  });
  const teacherIdObj =
    teacherUser._id instanceof mongoose.Types.ObjectId
      ? teacherUser._id
      : new mongoose.Types.ObjectId(String(teacherUser._id));

  await ensureMembershipForUser({
    userId: teacherIdObj,
    schoolId,
    role: "teacher",
    status: "active",
  });

  const existingTeacher = await Teacher.findOne({
    schoolId,
    userId: teacherIdObj,
  }).select("_id");

  let teacherRecord = existingTeacher;
  if (!teacherRecord) {
    teacherRecord = new Teacher({
      schoolId,
      userId: teacherIdObj,
      subjectIds,
      subjectOfferingIds,
      homeroomClassGroupId,
      status: status as "active" | "inactive" | "on_leave" | "terminated",
      employeeId: row.employeeId?.trim() || undefined,
    });
    await teacherRecord.save();
    if (homeroomClassGroupId) {
      await ClassGroup.updateOne(
        { _id: homeroomClassGroupId, schoolId, homeroomTeacherId: { $in: [null, undefined] } },
        { $set: { homeroomTeacherId: teacherRecord._id } }
      );
    }
    await logTeacherActivity({
      teacherId: String(teacherRecord._id),
      schoolId,
      type: "teacher.created",
      title: "Teacher created (bulk import)",
      description: `Created via CSV import: ${row.firstName} ${row.lastName} (${normalizedEmail})`,
      metadata: {
        email: normalizedEmail,
        subjectIds: subjectIds.map(String),
        subjectOfferingIds: subjectOfferingIds.map(String),
        homeroomClassGroupId: homeroomClassGroupId ? String(homeroomClassGroupId) : null,
        importedBy: String(adminUserId),
        isBulkOperation: true,
      },
      createdBy: adminUserId,
    });
  }

  try {
    await issueInvitation({
      email: normalizedEmail,
      role: "teacher",
      schoolId,
      invitedBy: adminUserId,
      recipientName: `${row.firstName} ${row.lastName}`,
      schoolName,
      redirectNext: "/teacher",
      actorRole: "school_admin",
      relatedEntityType: "invitation",
      invitationMetadata: {
        firstName: row.firstName,
        lastName: row.lastName,
        subjects: splitMultiValue(row.subjects || ""),
        subjectOfferingIds: subjectOfferingIds.map(String),
        homeroom: row.homeroom || row.homeroomClass || null,
        homeroomClassGroupId: homeroomClassGroupId ? String(homeroomClassGroupId) : null,
        invitationEmailSuppressed: false,
      },
    });
  } catch {
    /* Invitation reuse/send is best-effort; teacher row still succeeds. */
  }

  input.results.push({
    row: rowNumber,
    success: true,
    teacherId: String(teacherRecord._id),
    email: normalizedEmail,
  });
}
