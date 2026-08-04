// src/app/api/admin/teachers/bulk-create/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { School } from "@/models/School";
import { Invitation } from "@/models/Invitation";
import { clerkClient } from "@clerk/nextjs/server";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import mongoose from "mongoose";
import {
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
  withInvitedEmail,
} from "@/lib/utils/getAppUrl";
import { ensureCanonicalUserForEmail, ensureMembershipForUser } from "@/lib/auth/canonical-user";

function toObjectIdOrNull(id: string): mongoose.Types.ObjectId | null {
  if (!id || !id.trim()) return null;
  try {
    return new mongoose.Types.ObjectId(String(id.trim()));
  } catch {
    return null;
  }
}

type CSVRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  status?: string;
  subjects?: string; // semicolon/comma-separated subject offering names
  subjectIds?: string; // legacy: comma-separated IDs
  subjectOfferingIds?: string; // legacy: comma-separated IDs
  homeroom?: string;
  homeroomGrade?: string;
  homeroomClass?: string;
  homeroomClassGroupId?: string; // legacy: ID
};

type SpreadsheetRow = Record<string, unknown>;

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

function parseSpreadsheetRows(buffer: Buffer, fileName: string): SpreadsheetRow[] {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "csv" || ext === "txt") {
    return parse(buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: false,
      bom: true,
      relax_column_count: true,
    }) as SpreadsheetRow[];
  }

  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    return XLSX.utils.sheet_to_json<SpreadsheetRow>(workbook.Sheets[sheetName], {
      defval: "",
      raw: false,
    });
  }

  throw new Error("Unsupported file type. Upload a CSV, XLS, or XLSX file.");
}

/**
 * POST /api/admin/teachers/bulk-create
 * Bulk create teachers from CSV file
 * Body: FormData with 'file' field containing CSV
 */
export async function POST(req: NextRequest) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  try {
    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (fileBuffer.length === 0) {
      return Response.json({ error: "File is empty" }, { status: 400 });
    }

    // Parse spreadsheet
    let rows: CSVRow[];
    try {
      rows = parseSpreadsheetRows(fileBuffer, file.name) as CSVRow[];
    } catch (parseError) {
      return Response.json(
        { error: "Failed to parse teacher import file", details: String(parseError) },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return Response.json({ error: "Import file contains no data rows" }, { status: 400 });
    }

    // Normalize column names (case-insensitive, spaces allowed)
    const normalizedRows = rows.map((row) => {
      const normalized: any = {};
      const norm = (k: string) => k.toLowerCase().trim().replace(/\s+/g, "");
      for (const [key, value] of Object.entries(row)) {
        const n = norm(key);
        if (n === "firstname" || n === "first_name") normalized.firstName = value;
        else if (n === "lastname" || n === "last_name") normalized.lastName = value;
        else if (n === "email") normalized.email = value;
        else if (n === "phone") normalized.phone = value;
        else if (n === "employeeid" || n === "employee_id") normalized.employeeId = value;
        else if (n === "department") normalized.department = value;
        else if (n === "status") normalized.status = value;
        else if (n === "subjects" || n === "subject") normalized.subjects = value;
        else if (n === "subjectids" || n === "subject_ids") normalized.subjectIds = value;
        else if (n === "subjectofferingids" || n === "subject_offering_ids")
          normalized.subjectOfferingIds = value;
        else if (n === "homeroom" || n === "homeroomclassname" || n === "homeroom_class_name")
          normalized.homeroom = value;
        else if (n === "homeroomgrade" || n === "homeroom_grade") normalized.homeroomGrade = value;
        else if (n === "homeroomclass" || n === "homeroom_class") normalized.homeroomClass = value;
        else if (n === "homeroomclassgroupid" || n === "homeroom_class_group_id")
          normalized.homeroomClassGroupId = value;
        else normalized[key] = value; // Keep unknown columns
      }
      return normalized as CSVRow;
    });

    const requiredColumns = ["firstName", "lastName", "email"] as const;
    const firstRow = normalizedRows[0];
    const missingColumns = requiredColumns.filter(
      (col) =>
        !(col in firstRow) && !Object.keys(firstRow).some((k) => k.toLowerCase() === col.toLowerCase())
    );

    if (missingColumns.length > 0) {
      return Response.json(
        {
          error: `Missing required columns: ${missingColumns.join(", ")}`,
          required: [...requiredColumns],
        },
        { status: 400 }
      );
    }

    const results: Array<{
      row: number;
      success: boolean;
      teacherId?: string;
      email?: string;
      error?: string;
    }> = [];

    const redirectUrlForEmail = (email: string) =>
      withInvitedEmail(
        `${getInvitationRedirectUrl()}?next=${encodeURIComponent("/teacher")}`,
        email
      );

    // Fetch school name for emails
    const school = await School.findById(schoolIdObj).select("name").lean();
    const schoolName = school ? (school as any).name : "your school";

    const allSubjectOfferings = await SubjectOffering.find({
      schoolId: schoolIdObj,
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
      schoolId: schoolIdObj,
      isActive: true,
    })
      .select("_id name gradeId homeroomTeacherId")
      .lean();

    const allGrades = await Grade.find({
      schoolId: schoolIdObj,
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

    // Process each row
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const rowNumber = i + 2; // +2 because CSV is 1-indexed and has header

      try {
        // Validate required fields
        if (!row.firstName?.trim() || !row.lastName?.trim()) {
          results.push({
            row: rowNumber,
            success: false,
            email: row.email,
            error: "Missing required fields: firstName or lastName",
          });
          continue;
        }

        if (!row.email?.trim()) {
          results.push({
            row: rowNumber,
            success: false,
            email: row.email,
            error: "Missing required field: email",
          });
          continue;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const probe = row.email.toLowerCase().trim();
        if (!emailRegex.test(probe)) {
          results.push({
            row: rowNumber,
            success: false,
            email: row.email,
            error: "Invalid email format",
          });
          continue;
        }

        const normalizedEmail = row.email.toLowerCase().trim();

        // Validate and resolve subject offerings — by name or legacy ID.
        let subjectIds: mongoose.Types.ObjectId[] = [];
        let subjectOfferingIds: mongoose.Types.ObjectId[] = [];
        const subjectInput = (row.subjects || row.subjectOfferingIds || row.subjectIds || "").trim();
        if (subjectInput) {
          const parts = splitMultiValue(subjectInput);

          if (parts.length > 0) {
            const firstPart = parts[0];
            const looksLikeId = /^[a-f0-9]{24}$/i.test(firstPart);

            if (looksLikeId) {
              const validSubjectOfferingIds = parts
                .map((id) => toObjectIdOrNull(id))
                .filter((id): id is mongoose.Types.ObjectId => id !== null);
              const offerings = await SubjectOffering.find({
                _id: { $in: validSubjectOfferingIds },
                schoolId: schoolIdObj,
                isActive: true,
              }).lean();
              if (offerings.length !== validSubjectOfferingIds.length) {
                results.push({
                  row: rowNumber,
                  success: false,
                  email: normalizedEmail,
                  error: "One or more subject offering IDs are invalid or not found",
                });
                continue;
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
              let subjectResolveFailed = false;
              for (const name of parts) {
                const offering = subjectOfferingMap.get(normalizeLookupValue(name));
                if (!offering) {
                  const available = allSubjectOfferings
                    .map((item) => item.displayName || item.shortName || item.code)
                    .filter(Boolean)
                    .slice(0, 12)
                    .join("; ");
                  results.push({
                    row: rowNumber,
                    success: false,
                    email: normalizedEmail,
                    error: `Subject "${name}" was not found. Use subject offering names such as: ${available}${allSubjectOfferings.length > 12 ? "..." : ""}`,
                  });
                  subjectResolveFailed = true;
                  break;
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
              if (subjectResolveFailed) continue;
            }
          }
        }
        subjectIds = uniqueObjectIds(subjectIds);
        subjectOfferingIds = uniqueObjectIds(subjectOfferingIds);

        // Validate homeroom — by class name, Grade + Class names, or legacy ID.
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
          const matches = classGroupMap.get(normalizeLookupValue(homeroomInput)) ?? [];

          if (matches.length === 0) {
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: `Homeroom class "${homeroomInput}" was not found. Use the class name as shown in Class Groups, for example "JHS 1 A".`,
            });
            continue;
          }

          if (matches.length > 1) {
            const candidates = matches
              .map((match) => `${gradeNameById.get(String(match.gradeId)) ?? "Grade"} / ${match.name}`)
              .join(", ");
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: `Homeroom class "${homeroomInput}" matches multiple classes: ${candidates}. Use a fuller name such as "JHS 1 A".`,
            });
            continue;
          }

          const classGroup = matches[0];
          homeroomClassGroupId =
            classGroup._id instanceof mongoose.Types.ObjectId
              ? classGroup._id
              : new mongoose.Types.ObjectId(String(classGroup._id));
        } else if (hasHomeroomById) {
          const classGroupObjId = toObjectIdOrNull(row.homeroomClassGroupId!);
          if (!classGroupObjId) {
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: "Invalid homeroom class group ID format",
            });
            continue;
          }

          const classGroup = await ClassGroup.findOne({
            _id: classGroupObjId,
            schoolId: schoolIdObj,
            isActive: true,
          }).lean();

          if (!classGroup) {
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: "Homeroom class group not found or not active",
            });
            continue;
          }

          homeroomClassGroupId = classGroupObjId;
        }

        if (homeroomClassGroupId) {
          const classGroup = await ClassGroup.findById(homeroomClassGroupId)
            .select("homeroomTeacherId")
            .lean();
          if ((classGroup as any)?.homeroomTeacherId) {
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: "Homeroom class already has a teacher assigned",
            });
            continue;
          }
        }

        // Validate status
        const status = row.status?.trim().toLowerCase() || "active";
        if (!["active", "inactive", "on_leave", "terminated"].includes(status)) {
          results.push({
            row: rowNumber,
            success: false,
            email: normalizedEmail,
            error: `Invalid status: ${status}. Must be one of: active, inactive, on_leave, terminated`,
          });
          continue;
        }

        const teacherUser = await ensureCanonicalUserForEmail({
          email: normalizedEmail,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          phone: row.phone?.trim() || undefined,
          role: "teacher",
          schoolId: schoolIdObj,
          pendingOnboarding: false,
        });

        const teacherIdObj =
          teacherUser._id instanceof mongoose.Types.ObjectId
            ? teacherUser._id
            : new mongoose.Types.ObjectId(String(teacherUser._id));

        const existingTeacher = await Teacher.findOne({
          schoolId: schoolIdObj,
          userId: teacherIdObj,
        })
          .select("_id")
          .lean();
        if (existingTeacher) {
          results.push({
            row: rowNumber,
            success: false,
            email: normalizedEmail,
            error: "A teacher record already exists for this email in your school",
          });
          continue;
        }

        await ensureMembershipForUser({
          userId: teacherIdObj,
          schoolId: schoolIdObj,
          role: "teacher",
          status: "active",
        });

        // Create teacher record
        const teacherRecord = new Teacher({
          schoolId: schoolIdObj,
          userId: teacherIdObj,
          subjectIds: subjectIds,
          subjectOfferingIds,
          homeroomClassGroupId: homeroomClassGroupId,
          status: status as "active" | "inactive" | "on_leave" | "terminated",
          employeeId: row.employeeId?.trim() || undefined,
        });

        await teacherRecord.save();

        // Assign homeroom if provided
        if (homeroomClassGroupId) {
          await ClassGroup.updateOne(
            { _id: homeroomClassGroupId, schoolId: schoolIdObj },
            { $set: { homeroomTeacherId: teacherRecord._id } }
          );
        }

        let clerkInvitationId: string | undefined;
        let invitationStatus: "pending" | "failed" = "pending";

        try {
          const clerk = await clerkClient();
          const redirectUrl = redirectUrlForEmail(normalizedEmail);
          const clerkInvitation = await clerk.invitations.createInvitation({
            emailAddress: normalizedEmail,
            redirectUrl,
            notify: false,
            publicMetadata: {
              role: "teacher",
              schoolId: String(schoolIdObj),
            },
            ignoreExisting: true,
          });
          clerkInvitationId = clerkInvitation.id;

          const rendered = renderTemplate("USER_INVITE", {
            name: `${row.firstName} ${row.lastName}`,
            role: "teacher",
            schoolName,
            setupLink: getInvitationAcceptUrl(
              clerkInvitation,
              redirectUrl,
              normalizedEmail
            ),
          });

          await sendTrackedBrevoEmail({
            to: normalizedEmail,
            subject: rendered.subject,
            htmlContent: rendered.htmlContent,
            textContent: rendered.textContent,
            templateKey: "TEACHER_INVITE",
            schoolId: String(schoolIdObj),
            schoolName,
            actorId: String(adminUserId),
            actorRole: "school_admin",
            relatedEntityType: "invitation",
          });
        } catch (inviteError) {
          console.error(`Clerk invitation error for ${normalizedEmail}:`, inviteError);
          invitationStatus = "failed";
        }

        try {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          await Invitation.create({
            email: normalizedEmail,
            role: "teacher",
            schoolId: schoolIdObj,
            status: invitationStatus,
            clerkInvitationId,
            sentAt: new Date(),
            acceptedAt: undefined,
            expiresAt,
            resendCount: 0,
            invitedBy: new mongoose.Types.ObjectId(adminUserId),
            metadata: {
              firstName: row.firstName,
              lastName: row.lastName,
              subjects: splitMultiValue(row.subjects || ""),
              subjectOfferingIds: subjectOfferingIds.map(String),
              homeroom: row.homeroom || row.homeroomClass || null,
              homeroomClassGroupId: homeroomClassGroupId ? String(homeroomClassGroupId) : null,
              invitationEmailSuppressed: false,
            },
          });
        } catch (inviteRecordError) {
          console.error(`Failed to create invitation record for ${normalizedEmail}:`, inviteRecordError);
        }

        // Log activity
        await logTeacherActivity({
          teacherId: String(teacherRecord._id),
          schoolId: schoolIdObj,
          type: "teacher.created",
          title: "Teacher created (bulk import)",
          description: `Created via CSV import: ${row.firstName} ${row.lastName} (${normalizedEmail})`,
          metadata: {
            email: normalizedEmail,
            subjectIds: subjectIds.map(String),
            subjectOfferingIds: subjectOfferingIds.map(String),
            homeroomClassGroupId: homeroomClassGroupId ? String(homeroomClassGroupId) : null,
            importedBy: adminUserId,
            isBulkOperation: true,
          },
          createdBy: adminUserId,
        });

        results.push({
          row: rowNumber,
          success: true,
          teacherId: String(teacherRecord._id),
          email: normalizedEmail,
        });
      } catch (error: any) {
        console.error(`Error processing row ${rowNumber}:`, error);
        results.push({
          row: rowNumber,
          success: false,
          email: row.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return Response.json({
      success: true,
      message: `Processed ${rows.length} row(s): ${successful} successful, ${failed} failed`,
      data: {
        totalRows: rows.length,
        successful,
        failed,
        results,
      },
    });
  } catch (error: any) {
    console.error("Bulk create error:", error);
    return Response.json(
      {
        error: "Failed to process bulk import",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
