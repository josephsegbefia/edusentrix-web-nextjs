// src/app/api/school/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, ISchool } from "@/models/School";
import { User, IUser } from "@/models/User";
import mongoose from "mongoose";
import { z } from "zod";
import { isValidIanaTimeZone } from "@/lib/validation/iana-timezone";

const UpdateSchoolProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    motto: z
      .union([z.string().trim().max(160), z.literal(""), z.null()])
      .optional(),
    logo: z
      .union([z.string().trim().url(), z.literal(""), z.null()])
      .optional(),
    gesSchoolCode: z
      .union([z.string().trim().max(50), z.literal(""), z.null()])
      .optional(),
    timeZone: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .refine((s) => isValidIanaTimeZone(s), { message: "Invalid IANA time zone" })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No valid fields to update",
  });

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
      .select("_id name logo motto type status gesSchoolCode curriculumCode timeZone")
      .lean<
        Pick<
          ISchool,
          | "_id"
          | "name"
          | "logo"
          | "motto"
          | "type"
          | "status"
          | "gesSchoolCode"
          | "curriculumCode"
          | "timeZone"
        >
      >();

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
        motto: school.motto || null,
        type: school.type,
        status: school.status,
        gesSchoolCode: school.gesSchoolCode || null,
        curriculumCode: school.curriculumCode || "ghana_nacca",
        timeZone: school.timeZone?.trim() || "Africa/Accra",
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
 * Update school identity fields
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

    const parsed = UpdateSchoolProfileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            parsed.error.issues[0]?.message || "No valid fields to update",
        },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (typeof parsed.data.name === "string") {
      updates.name = parsed.data.name.trim();
    }
    if ("motto" in parsed.data) {
      updates.motto = parsed.data.motto?.trim() || null;
    }
    if ("logo" in parsed.data) {
      updates.logo = parsed.data.logo?.trim() || null;
    }
    if ("gesSchoolCode" in parsed.data) {
      updates.gesSchoolCode = parsed.data.gesSchoolCode?.trim() || null;
    }
    if (typeof parsed.data.timeZone === "string") {
      updates.timeZone = parsed.data.timeZone.trim();
    }

    const updated = await School.findByIdAndUpdate(
      user.schoolId,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select("_id name logo motto type status gesSchoolCode curriculumCode timeZone")
      .lean<
        Pick<
          ISchool,
          | "_id"
          | "name"
          | "logo"
          | "motto"
          | "type"
          | "status"
          | "gesSchoolCode"
          | "curriculumCode"
          | "timeZone"
        >
      >();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        name: updated.name,
        logo: updated.logo || null,
        motto: updated.motto || null,
        type: updated.type,
        status: updated.status,
        gesSchoolCode: updated.gesSchoolCode || null,
        curriculumCode: updated.curriculumCode || "ghana_nacca",
        timeZone: updated.timeZone?.trim() || "Africa/Accra",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update school";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
