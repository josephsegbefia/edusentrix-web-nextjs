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
      .select("_id name logo type status")
      .lean<Pick<ISchool, "_id" | "name" | "logo" | "type" | "status">>();

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
