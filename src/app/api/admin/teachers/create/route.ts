/* eslint-disable @typescript-eslint/no-explicit-any */
// POST /api/admin/teachers/create
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Subject, type ISubject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
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
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const body = (await req.json()) as Body;

    // Normalize optional fields - convert empty strings to undefined
    const normalizedBody: Body = {
      ...body,
      phone: body.phone?.trim() || undefined,
      photoUrl: body.photoUrl?.trim() || undefined,
      homeroomClassGroupId:
        body.homeroomClassGroupId?.trim() || undefined,
      subjectIds:
        body.subjectIds && body.subjectIds.length > 0
          ? body.subjectIds.filter((id) => id && id.trim())
          : undefined,
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

      if (validSubjectIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid subject IDs provided" }),
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
    const teacher = new User({
      email: normalizedBody.email.toLowerCase().trim(),
      firstName: normalizedBody.firstName.trim(),
      lastName: normalizedBody.lastName.trim(),
      phone: normalizedBody.phone,
      avatarUrl: normalizedBody.photoUrl,
      role: "teacher",
      schoolId: schoolIdObj,
    });

    await teacher.save();

    const teacherIdObj =
      teacher._id instanceof mongoose.Types.ObjectId
        ? teacher._id
        : new mongoose.Types.ObjectId(String(teacher._id));

    // Assign homeroom if provided
    if (normalizedBody.homeroomClassGroupId) {
      await ClassGroup.updateOne(
        {
          _id: new mongoose.Types.ObjectId(normalizedBody.homeroomClassGroupId),
          schoolId,
        },
        { $set: { homeroomTeacherId: teacherIdObj } }
      );
    }

    // TODO: Store subject assignments if Teacher model exists
    // For now, we're storing teacher info in User model
    // Subject assignments can be stored in a separate TeacherSubject junction table later

    return Response.json(
      {
        success: true,
        data: {
          _id: String(teacher._id),
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error("Teacher creation error:", e);
    const message = e instanceof Error ? e.message : "Failed to create teacher";

    // Handle duplicate email error
    if (message.includes("email") || message.includes("duplicate")) {
      return new Response(
        JSON.stringify({ error: "Email already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle validation errors
    if (message.includes("validation") || message.includes("required")) {
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
