// src/app/api/admin/teachers/bulk-create/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Subject } from "@/models/Subject";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { UserMembership } from "@/models/UserMembership";
import { School } from "@/models/School";
import { Invitation } from "@/models/Invitation";
import { clerkClient } from "@clerk/nextjs/server";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { parse } from "csv-parse/sync";
import mongoose from "mongoose";
import {
  getAppUrl,
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
} from "@/lib/utils/getAppUrl";
import { allocateSyntheticTestEmail } from "@/lib/internal-test/allocate-synthetic-test-email";
import { createSyntheticClerkAccount } from "@/lib/internal-test/create-synthetic-clerk-account";
import { getInternalTestDefaultPassword } from "@/lib/internal-test/env";
import { loadSchoolInternalTestSnapshot } from "@/lib/internal-test/load-internal-test-context";
import { recordInvitationEmailSuppressed } from "@/lib/internal-test/record-invitation-suppressed";
import { shouldBypassInvitation } from "@/lib/internal-test/shouldBypassInvitation";
import { shouldUseSyntheticTestUserFlow } from "@/lib/internal-test/synthetic-test-user-flow";

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
  subjects?: string; // comma-separated subject names (e.g. "Mathematics,English")
  subjectIds?: string; // legacy: comma-separated IDs
  homeroomGrade?: string;
  homeroomClass?: string;
  homeroomClassGroupId?: string; // legacy: ID
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
        else if (n === "subjects") normalized.subjects = value;
        else if (n === "subjectids" || n === "subject_ids") normalized.subjectIds = value;
        else if (n === "homeroomgrade" || n === "homeroom_grade") normalized.homeroomGrade = value;
        else if (n === "homeroomclass" || n === "homeroom_class") normalized.homeroomClass = value;
        else if (n === "homeroomclassgroupid" || n === "homeroom_class_group_id")
          normalized.homeroomClassGroupId = value;
        else normalized[key] = value; // Keep unknown columns
      }
      return normalized as CSVRow;
    });

    const internalTestSnapshot = await loadSchoolInternalTestSnapshot(schoolIdObj);
    const syntheticFlowForCsv = shouldUseSyntheticTestUserFlow(internalTestSnapshot);
    const requiredColumns = syntheticFlowForCsv
      ? (["firstName", "lastName"] as const)
      : (["firstName", "lastName", "email"] as const);
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

    const APP_URL = getAppUrl();
    const redirectUrl = getInvitationRedirectUrl();

    // Fetch school name for emails
    const school = await School.findById(schoolIdObj).select("name").lean();
    const schoolName = school ? (school as any).name : "your school";

    const bypassInviteEmail = shouldBypassInvitation(internalTestSnapshot);
    const syntheticFlow = syntheticFlowForCsv;

    if (syntheticFlow) {
      const pwd = getInternalTestDefaultPassword();
      if (!pwd) {
        return Response.json(
          {
            error:
              "INTERNAL_TEST_DEFAULT_PASSWORD is not configured. Set it on the server for synthetic bulk teachers.",
            code: "INTERNAL_TEST_PASSWORD_NOT_CONFIGURED",
          },
          { status: 503 }
        );
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

        if (!syntheticFlow) {
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
        }

        const normalizedEmail = syntheticFlow
          ? await allocateSyntheticTestEmail(schoolIdObj, "teacher")
          : row.email.toLowerCase().trim();

        const existingUser = await User.findOne({
          email: normalizedEmail,
          schoolId: schoolIdObj,
        }).lean();
        if (existingUser) {
          results.push({
            row: rowNumber,
            success: false,
            email: normalizedEmail,
            error:
              "A user with this email already exists in your school",
          });
          continue;
        }

        // Validate and resolve subjects — by name or (legacy) by ID
        let subjectIds: mongoose.Types.ObjectId[] = [];
        const subjectInput = (row.subjects || row.subjectIds || "").trim();
        if (subjectInput) {
          const parts = subjectInput.split(",").map((p) => p.trim()).filter(Boolean);

          if (parts.length > 0) {
            const firstPart = parts[0];
            const looksLikeId = /^[a-f0-9]{24}$/i.test(firstPart);

            if (looksLikeId) {
              const validSubjectIds = parts
                .map((id) => toObjectIdOrNull(id))
                .filter((id): id is mongoose.Types.ObjectId => id !== null);
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
              subjectIds = subjects.map((s: any) =>
                s._id instanceof mongoose.Types.ObjectId ? s._id : new mongoose.Types.ObjectId(String(s._id))
              );
            } else {
              const allSubjects = await Subject.find({
                schoolId: schoolIdObj,
                isActive: true,
              })
                .select("_id name")
                .lean();
              const subjectMap = new Map(
                allSubjects.map((s: any) => [s.name.toLowerCase().trim(), s._id])
              );

              let subjectResolveFailed = false;
              for (const name of parts) {
                const id = subjectMap.get(name.toLowerCase().trim());
                if (!id) {
                  results.push({
                    row: rowNumber,
                    success: false,
                    email: normalizedEmail,
                    error: `Subject "${name}" not found. Available: ${[...subjectMap.keys()].slice(0, 10).join(", ")}${subjectMap.size > 10 ? "..." : ""}`,
                  });
                  subjectResolveFailed = true;
                  break;
                }
                subjectIds.push(
                  id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id))
                );
              }
              if (subjectResolveFailed) continue;
            }
          }
        }

        // Validate homeroom — by Grade + Class names or (legacy) by ID
        let homeroomClassGroupId: mongoose.Types.ObjectId | null = null;
        const hasHomeroomByName =
          row.homeroomGrade?.trim() && row.homeroomClass?.trim();
        const hasHomeroomById = row.homeroomClassGroupId?.trim();

        if (hasHomeroomByName) {
          const grade = await Grade.findOne({
            schoolId: schoolIdObj,
            name: new RegExp(`^${row.homeroomGrade!.trim()}$`, "i"),
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!grade) {
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: `Homeroom grade "${row.homeroomGrade}" not found`,
            });
            continue;
          }

          const classGroup = await ClassGroup.findOne({
            schoolId: schoolIdObj,
            gradeId: (grade as any)._id,
            name: new RegExp(`^${row.homeroomClass!.trim()}$`, "i"),
            isActive: true,
          }).lean();

          if (!classGroup) {
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error: `Class "${row.homeroomClass}" not found under grade "${row.homeroomGrade}"`,
            });
            continue;
          }

          homeroomClassGroupId =
            (classGroup as any)._id instanceof mongoose.Types.ObjectId
              ? (classGroup as any)._id
              : new mongoose.Types.ObjectId(String((classGroup as any)._id));
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

        const teacherUser = new User({
          email: normalizedEmail,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          phone: row.phone?.trim() || undefined,
          role: "teacher",
          schoolId: schoolIdObj,
          ...(syntheticFlow
            ? {
                isTestUser: true,
                testUserSource: "manual_test_school" as const,
                pendingOnboarding: false,
              }
            : {}),
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

        let clerkInvitationId: string | undefined;
        let invitationStatus: "pending" | "failed" | "accepted" = "pending";

        if (syntheticFlow) {
          const password = getInternalTestDefaultPassword();
          try {
            const { clerkUserId } = await createSyntheticClerkAccount({
              email: normalizedEmail,
              password,
              firstName: row.firstName,
              lastName: row.lastName,
              role: "teacher",
              schoolId: schoolIdObj,
            });
            await User.updateOne(
              { _id: teacherIdObj },
              {
                $set: {
                  clerkUserId,
                  pendingOnboarding: false,
                  isTestUser: true,
                  testUserSource: "manual_test_school",
                },
              }
            );
            invitationStatus = "accepted";
            if (adminUserId) {
              await recordInvitationEmailSuppressed({
                schoolId: schoolIdObj,
                actorId: new mongoose.Types.ObjectId(String(adminUserId)),
                templateKey: "TEACHER_INVITE",
                targetEmail: normalizedEmail,
              });
            }
          } catch (syntheticErr) {
            console.error(`Synthetic Clerk error for ${normalizedEmail}:`, syntheticErr);
            try {
              await TeacherAssignment.deleteMany({ teacherId: teacherRecord._id });
              await ClassGroup.updateMany(
                { homeroomTeacherId: teacherRecord._id, schoolId: schoolIdObj },
                { $unset: { homeroomTeacherId: 1 } }
              );
              await Teacher.deleteOne({ _id: teacherRecord._id });
              await UserMembership.deleteMany({ userId: teacherIdObj, schoolId: schoolIdObj });
              await User.deleteOne({ _id: teacherIdObj });
            } catch (rollbackErr) {
              console.error("Bulk synthetic teacher rollback:", rollbackErr);
            }
            results.push({
              row: rowNumber,
              success: false,
              email: normalizedEmail,
              error:
                syntheticErr instanceof Error
                  ? syntheticErr.message
                  : "Failed to create synthetic Clerk user",
            });
            continue;
          }
        } else {
          try {
            const clerk = await clerkClient();
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
              setupLink: getInvitationAcceptUrl(clerkInvitation, redirectUrl),
            });

            if (!bypassInviteEmail) {
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
            } else if (adminUserId) {
              await recordInvitationEmailSuppressed({
                schoolId: schoolIdObj,
                actorId: new mongoose.Types.ObjectId(String(adminUserId)),
                templateKey: "TEACHER_INVITE",
                targetEmail: normalizedEmail,
              });
            }
          } catch (inviteError) {
            console.error(`Clerk invitation error for ${normalizedEmail}:`, inviteError);
            invitationStatus = "failed";
          }
        }

        try {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (syntheticFlow ? 365 : 7));

          await Invitation.create({
            email: normalizedEmail,
            role: "teacher",
            schoolId: schoolIdObj,
            status: invitationStatus,
            clerkInvitationId,
            sentAt: new Date(),
            acceptedAt: invitationStatus === "accepted" ? new Date() : undefined,
            expiresAt,
            resendCount: 0,
            invitedBy: new mongoose.Types.ObjectId(adminUserId),
            metadata: {
              firstName: row.firstName,
              lastName: row.lastName,
              subjectIds: row.subjectIds?.split(",").map((id) => id.trim()) || [],
              homeroomClassGroupId: row.homeroomClassGroupId,
              invitationEmailSuppressed: bypassInviteEmail || syntheticFlow,
              syntheticClerkUser: syntheticFlow,
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
