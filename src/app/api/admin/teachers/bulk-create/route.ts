// src/app/api/admin/teachers/bulk-create/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { UserMembership } from "@/models/UserMembership";
import { School } from "@/models/School";
import { Invitation } from "@/models/Invitation";
import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail } from "@/lib/email/brevo";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { parse } from "csv-parse/sync";
import mongoose from "mongoose";

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
  subjectIds?: string; // comma-separated
  homeroomClassGroupId?: string;
};

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

    // Read file content
    const fileContent = await file.text();
    if (!fileContent.trim()) {
      return Response.json({ error: "File is empty" }, { status: 400 });
    }

    // Parse CSV
    let rows: CSVRow[];
    try {
      rows = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false,
      }) as CSVRow[];
    } catch (parseError) {
      return Response.json(
        { error: "Failed to parse CSV file", details: String(parseError) },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return Response.json({ error: "CSV file contains no data rows" }, { status: 400 });
    }

    // Validate required columns
    const requiredColumns = ["firstName", "lastName", "email"];
    const firstRow = rows[0];
    const missingColumns = requiredColumns.filter(
      (col) => !(col in firstRow) && !Object.keys(firstRow).some((k) => k.toLowerCase() === col.toLowerCase())
    );

    if (missingColumns.length > 0) {
      return Response.json(
        {
          error: `Missing required columns: ${missingColumns.join(", ")}`,
          required: requiredColumns,
        },
        { status: 400 }
      );
    }

    // Normalize column names (case-insensitive)
    const normalizedRows = rows.map((row) => {
      const normalized: any = {};
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.toLowerCase().trim();
        if (lowerKey === "firstname" || lowerKey === "first_name") normalized.firstName = value;
        else if (lowerKey === "lastname" || lowerKey === "last_name") normalized.lastName = value;
        else if (lowerKey === "email") normalized.email = value;
        else if (lowerKey === "phone") normalized.phone = value;
        else if (lowerKey === "employeeid" || lowerKey === "employee_id") normalized.employeeId = value;
        else if (lowerKey === "department") normalized.department = value;
        else if (lowerKey === "status") normalized.status = value;
        else if (lowerKey === "subjectids" || lowerKey === "subject_ids") normalized.subjectIds = value;
        else if (lowerKey === "homeroomclassgroupid" || lowerKey === "homeroom_class_group_id")
          normalized.homeroomClassGroupId = value;
        else normalized[key] = value; // Keep unknown columns
      }
      return normalized as CSVRow;
    });

    const results: Array<{
      row: number;
      success: boolean;
      teacherId?: string;
      email?: string;
      error?: string;
    }> = [];

    const APP_URL = process.env.APP_URL || "http://localhost:3000";
    const redirectUrl = `${APP_URL}/auth/callback`;

    // Fetch school name for emails
    const school = await School.findById(schoolIdObj).select("name").lean();
    const schoolName = school ? (school as any).name : "your school";

    // Process each row
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const rowNumber = i + 2; // +2 because CSV is 1-indexed and has header

      try {
        // Validate required fields
        if (!row.firstName?.trim() || !row.lastName?.trim() || !row.email?.trim()) {
          results.push({
            row: rowNumber,
            success: false,
            email: row.email,
            error: "Missing required fields: firstName, lastName, or email",
          });
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const normalizedEmail = row.email.toLowerCase().trim();
        if (!emailRegex.test(normalizedEmail)) {
          results.push({
            row: rowNumber,
            success: false,
            email: row.email,
            error: "Invalid email format",
          });
          continue;
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail }).lean();
        if (existingUser) {
          results.push({
            row: rowNumber,
            success: false,
            email: normalizedEmail,
            error: "User with this email already exists",
          });
          continue;
        }

        // Validate and parse subject IDs
        let subjectIds: mongoose.Types.ObjectId[] = [];
        if (row.subjectIds?.trim()) {
          const subjectIdStrings = row.subjectIds
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0);

          const validSubjectIds = subjectIdStrings
            .map((id) => toObjectIdOrNull(id))
            .filter((id): id is mongoose.Types.ObjectId => id !== null);

          if (validSubjectIds.length > 0) {
            const subjects = await Subject.find({
              _id: { $in: validSubjectIds },
              schoolId: schoolIdObj,
              isActive: true,
            }).lean();

            if (subjects.length !== validSubjectIds.length) {
              results.push({
                row: rowNumber,
                success: false,
                email: normalizedEmail,
                error: "One or more subject IDs are invalid or not found",
              });
              continue;
            }

            subjectIds = subjects.map((s: any) => {
              const id = s._id;
              return id instanceof mongoose.Types.ObjectId
                ? id
                : new mongoose.Types.ObjectId(String(id));
            });
          }
        }

        // Validate homeroom class group if provided
        let homeroomClassGroupId: mongoose.Types.ObjectId | null = null;
        if (row.homeroomClassGroupId?.trim()) {
          const classGroupObjId = toObjectIdOrNull(row.homeroomClassGroupId);
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

          // Check if class already has a homeroom teacher
          if ((classGroup as any).homeroomTeacherId) {
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: "Homeroom class already has a teacher assigned",
            });
            continue;
          }

          homeroomClassGroupId = classGroupObjId;
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

        // Create user
        const teacherUser = new User({
          email: normalizedEmail,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          phone: row.phone?.trim() || undefined,
          role: "teacher",
          schoolId: schoolIdObj,
        });

        await teacherUser.save();

        const teacherIdObj =
          teacherUser._id instanceof mongoose.Types.ObjectId
            ? teacherUser._id
            : new mongoose.Types.ObjectId(String(teacherUser._id));

        // Ensure membership entry
        await UserMembership.findOneAndUpdate(
          { userId: teacherIdObj, schoolId: schoolIdObj },
          { $addToSet: { roles: "teacher" }, $set: { status: "active" } },
          { upsert: true }
        );

        // Create teacher record
        const teacherRecord = new Teacher({
          schoolId: schoolIdObj,
          userId: teacherIdObj,
          subjectIds: subjectIds,
          homeroomClassGroupId: homeroomClassGroupId,
          status: status as "active" | "inactive" | "on_leave" | "terminated",
          employeeId: row.employeeId?.trim() || undefined,
          department: row.department?.trim() || undefined,
        });

        await teacherRecord.save();

        // Assign homeroom if provided
        if (homeroomClassGroupId) {
          await ClassGroup.updateOne(
            { _id: homeroomClassGroupId, schoolId: schoolIdObj },
            { $set: { homeroomTeacherId: teacherRecord._id } }
          );
        }

        // Send Clerk invitation
        let clerkInvitationId: string | undefined;
        let invitationStatus: "pending" | "failed" = "pending";

        try {
          const clerk = await clerkClient();
          const clerkInvitation = await clerk.invitations.createInvitation({
            emailAddress: normalizedEmail,
            redirectUrl,
            publicMetadata: {
              role: "teacher",
              schoolId: String(schoolIdObj),
            },
            ignoreExisting: true,
          });
          clerkInvitationId = clerkInvitation.id;

          // Send branded invitation email
          await sendEmail(normalizedEmail, "USER_INVITE", {
            name: `${row.firstName} ${row.lastName}`,
            role: "teacher",
            schoolName,
            setupLink: `${APP_URL}/sign-in`,
          });
        } catch (inviteError) {
          console.error(`Clerk invitation error for ${normalizedEmail}:`, inviteError);
          invitationStatus = "failed";
        }

        // Create invitation record
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
            expiresAt,
            resendCount: 0,
            invitedBy: new mongoose.Types.ObjectId(adminUserId),
            metadata: {
              firstName: row.firstName,
              lastName: row.lastName,
              subjectIds: row.subjectIds?.split(",").map((id) => id.trim()) || [],
              homeroomClassGroupId: row.homeroomClassGroupId,
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
