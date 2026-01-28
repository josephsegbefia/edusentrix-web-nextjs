/* eslint-disable @typescript-eslint/no-explicit-any */
// POST /api/admin/teachers/create
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Subject, type ISubject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { UserMembership } from "@/models/UserMembership";
import { Teacher } from "@/models/Teacher";
import { School } from "@/models/School";
import { clerkClient } from "@clerk/nextjs/server";
import { Invitation } from "@/models/Invitation";
import { sendEmail } from "@/lib/email/brevo";
import { recordActivity } from "@/lib/audit/recordActivity";
import mongoose from "mongoose";

type Body = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  subjectIds?: string[];
  homeroomClassGroupId?: string;
  status?: "active" | "inactive";
};

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const body = (await req.json()) as Body;

    // Log received payload for debugging
    console.log("Teacher creation request payload:", {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      hasPhone: !!body.phone,
      hasPhotoUrl: !!body.photoUrl,
      subjectIdsCount: body.subjectIds?.length || 0,
      hasHomeroom: !!body.homeroomClassGroupId,
      status: body.status,
    });

    // Normalize optional fields - convert empty strings to undefined
    const normalizedBody: Body = {
      ...body,
      phone: body.phone?.trim() || undefined,
      photoUrl: body.photoUrl?.trim() || undefined,
      homeroomClassGroupId:
        body.homeroomClassGroupId?.trim() || undefined,
      subjectIds:
        body.subjectIds && body.subjectIds.length > 0
          ? body.subjectIds
              .map((id) => id?.trim())
              .filter((id): id is string => !!id)
          : undefined,
      status: body.status || "active",
    };

    // Validate required fields
    if (
      !normalizedBody.firstName?.trim() ||
      !normalizedBody.lastName?.trim() ||
      !normalizedBody.email?.trim()
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          details: {
            firstName: !normalizedBody.firstName?.trim(),
            lastName: !normalizedBody.lastName?.trim(),
            email: !normalizedBody.email?.trim(),
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedBody.email.trim())) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user with email already exists
    const existingUser = await User.findOne({
      email: normalizedBody.email.toLowerCase().trim(),
    }).lean();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "User with this email already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate subject IDs if provided
    let subjectIds: mongoose.Types.ObjectId[] = [];
    if (normalizedBody.subjectIds && normalizedBody.subjectIds.length > 0) {
      // Filter out invalid ObjectIds
      const validSubjectIds = normalizedBody.subjectIds.filter((id) =>
        mongoose.isValidObjectId(id)
      );

      // If subjectIds array was provided but all IDs are invalid, that's an error
      // But if it's an empty array, that's fine (no subjects assigned)
      if (normalizedBody.subjectIds.length > 0 && validSubjectIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "One or more subject IDs are invalid" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const subs = (await Subject.find({
        _id: { $in: validSubjectIds },
        schoolId,
        isActive: true,
      }).lean()) as unknown as ISubject[];

      subjectIds = subs.map((s: ISubject) => {
        const id = s._id;
        return id instanceof mongoose.Types.ObjectId
          ? id
          : new mongoose.Types.ObjectId(String(id));
      });

      if (subjectIds.length !== validSubjectIds.length) {
        return new Response(
          JSON.stringify({
            error: "One or more subject IDs are invalid or not found",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Validate homeroom class group if provided
    if (normalizedBody.homeroomClassGroupId) {
      if (!mongoose.isValidObjectId(normalizedBody.homeroomClassGroupId)) {
        return new Response(
          JSON.stringify({ error: "Invalid homeroom class group ID format" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const classGroup = await ClassGroup.findOne({
        _id: normalizedBody.homeroomClassGroupId,
        schoolId,
        isActive: true,
      }).lean();

      if (!classGroup) {
        return new Response(
          JSON.stringify({
            error: "Class group not found or not active",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Create teacher user
    const teacherUser = new User({
      email: normalizedBody.email.toLowerCase().trim(),
      firstName: normalizedBody.firstName.trim(),
      lastName: normalizedBody.lastName.trim(),
      phone: normalizedBody.phone,
      avatarUrl: normalizedBody.photoUrl,
      role: "teacher",
      schoolId: schoolIdObj,
    });

    await teacherUser.save();

    const teacherIdObj =
      teacherUser._id instanceof mongoose.Types.ObjectId
        ? teacherUser._id
        : new mongoose.Types.ObjectId(String(teacherUser._id));

    // Ensure membership entry for metrics/onboarding
    await UserMembership.findOneAndUpdate(
      { userId: teacherIdObj, schoolId: schoolIdObj },
      { $addToSet: { roles: "teacher" }, $set: { status: "active" } },
      { upsert: true }
    );

    // Persist teacher metadata (subjects + homeroom)
    const teacherRecord = new Teacher({
      schoolId: schoolIdObj,
      userId: teacherIdObj,
      subjectIds: subjectIds,
      homeroomClassGroupId: normalizedBody.homeroomClassGroupId
        ? new mongoose.Types.ObjectId(normalizedBody.homeroomClassGroupId)
        : null,
      status: normalizedBody.status || "active",
    });

    await teacherRecord.save();

    // Assign homeroom if provided
    if (normalizedBody.homeroomClassGroupId) {
      await ClassGroup.updateOne(
        {
          _id: new mongoose.Types.ObjectId(normalizedBody.homeroomClassGroupId),
          schoolId,
        },
        { $set: { homeroomTeacherId: teacherRecord._id } }
      );
    }

    // Send Clerk invitation email and create invitation record
    const APP_URL = process.env.APP_URL || "http://localhost:3000";
    const redirectUrl = `${APP_URL}/auth/callback`;
    let clerkInvitationId: string | undefined;
    let invitationStatus: "pending" | "failed" = "pending";

    try {
      const clerk = await clerkClient();
      const clerkInvitation = await clerk.invitations.createInvitation({
        emailAddress: normalizedBody.email.toLowerCase().trim(),
        redirectUrl,
        publicMetadata: {
          role: "teacher",
          schoolId: String(schoolIdObj),
        },
        ignoreExisting: true, // Don't error if they were invited before
      });
      clerkInvitationId = clerkInvitation.id;

      // Fetch school name for email
      const school = await School.findById(schoolIdObj)
        .select("name")
        .lean();
      const schoolName = school ? (school as any).name : "your school";

      // Send branded invitation email
      await sendEmail(normalizedBody.email.toLowerCase().trim(), "USER_INVITE", {
        name: `${normalizedBody.firstName} ${normalizedBody.lastName}`,
        role: "teacher",
        schoolName,
        setupLink: `${APP_URL}/sign-in`,
      });
    } catch (inviteError) {
      console.error("Clerk invitation error:", inviteError);
      invitationStatus = "failed";
      // Don't fail the request if invitation fails - teacher is already created
      // Admin can resend invitation later if needed
    }

    // Create invitation record
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      await Invitation.create({
        email: normalizedBody.email.toLowerCase().toLowerCase().trim(),
        role: "teacher",
        schoolId: schoolIdObj,
        status: invitationStatus,
        clerkInvitationId,
        sentAt: new Date(),
        expiresAt,
        resendCount: 0,
        invitedBy: new mongoose.Types.ObjectId(userId),
        metadata: {
          firstName: normalizedBody.firstName,
          lastName: normalizedBody.lastName,
          subjectIds: normalizedBody.subjectIds || [],
          homeroomClassGroupId: normalizedBody.homeroomClassGroupId,
        },
      });
    } catch (inviteRecordError) {
      console.error("Failed to create invitation record:", inviteRecordError);
      // Don't fail the request - invitation record is for tracking only
    }

    // Record activity
    await recordActivity({
      schoolId: String(schoolIdObj),
      userId: String(userId),
      type: "teacher.created",
      entityType: "teacher",
      entityId: String(teacherRecord._id),
      description: `Created teacher: ${normalizedBody.firstName} ${normalizedBody.lastName} (${normalizedBody.email})`,
      metadata: {
        teacherId: String(teacherRecord._id),
        email: normalizedBody.email,
        subjectIds: normalizedBody.subjectIds || [],
        homeroomClassGroupId: normalizedBody.homeroomClassGroupId,
        invitationSent: invitationStatus === "pending",
      },
    });

    return Response.json(
      {
        success: true,
        data: {
          _id: String(teacherRecord._id),
          userId: String(teacherIdObj),
          firstName: teacherUser.firstName,
          lastName: teacherUser.lastName,
          email: teacherUser.email,
          subjectIds: subjectIds.map(String),
          homeroomClassGroupId: normalizedBody.homeroomClassGroupId || null,
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("Teacher creation error:", e);
    const message = e instanceof Error ? e.message : "Failed to create teacher";

    // Handle MongoDB duplicate key errors (code 11000)
    if (e?.code === 11000) {
      const errorMsg = e?.message || "";
      if (errorMsg.includes("email_1") || errorMsg.includes("email")) {
        return new Response(
          JSON.stringify({ error: "User with this email already exists" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (
        errorMsg.includes("schoolId_1_userId_1") ||
        errorMsg.includes("schoolId")
      ) {
        return new Response(
          JSON.stringify({
            error: "This user is already a teacher in this school",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Generic duplicate key error
      return new Response(
        JSON.stringify({ error: "A record with this information already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle validation errors
    if (/validation|required/i.test(message)) {
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle Teacher model validation errors (e.g., homeroom class group validation)
    if (
      message.includes("Homeroom class group") ||
      message.includes("schoolId must match")
    ) {
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
