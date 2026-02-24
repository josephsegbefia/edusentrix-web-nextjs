// src/app/api/school/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, ISchool } from "@/models/School";
import { User, IUser } from "@/models/User";
import mongoose from "mongoose";

/**
 * GET /api/school
 * Get current school information for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ clerkUserId }).select("schoolId").lean<Pick<IUser, "_id" | "schoolId">>();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.schoolId) {
      return NextResponse.json(
        { success: false, error: "No school associated with user" },
        { status: 404 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(user.schoolId));
    const school = await School.findById(schoolIdObj)
      .select("_id name logo type status gesSchoolCode curriculumCode")
      .lean<Pick<ISchool, "_id" | "name" | "logo" | "type" | "status" | "gesSchoolCode" | "curriculumCode">>();

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(school._id),
        name: school.name,
        logo: school.logo || null,
        type: school.type,
        status: school.status,
        gesSchoolCode: school.gesSchoolCode || null,
        curriculumCode: school.curriculumCode || "ghana_nacca",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch school";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school
 * Update school profile fields (currently: gesSchoolCode)
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ clerkUserId }).select("schoolId role").lean<Pick<IUser, "_id" | "schoolId" | "role">>();
    if (!user?.schoolId) {
      return NextResponse.json(
        { success: false, error: "No school associated" },
        { status: 404 }
      );
    }

    if (user.role !== "school_admin" && user.role !== "platform_admin") {
      return NextResponse.json(
        { success: false, error: "Only admins can update school info" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.gesSchoolCode === "string" || body.gesSchoolCode === null) {
      updates.gesSchoolCode = body.gesSchoolCode?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    await School.findByIdAndUpdate(user.schoolId, { $set: updates });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update school";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
