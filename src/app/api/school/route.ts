// src/app/api/school/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, ISchool } from "@/models/School";
import { isValidIanaTimeZone } from "@/lib/validation/iana-timezone";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";
import { gateSchoolAdminRoles } from "@/lib/auth/role-gates";

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

type SchoolProfileFields = Pick<
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
>;

function serializeSchool(school: SchoolProfileFields) {
  return {
    id: String(school._id),
    name: school.name,
    logo: school.logo || null,
    motto: school.motto || null,
    type: school.type,
    status: school.status,
    gesSchoolCode: school.gesSchoolCode || null,
    curriculumCode: school.curriculumCode || "ghana_nacca",
    timeZone: school.timeZone?.trim() || "Africa/Accra",
  };
}

/**
 * GET /api/school
 * Get current school information for the authenticated user
 */
export async function GET() {
  try {
    const active = await resolveActiveSchoolContext();
    if (!active.ok) {
      const status =
        active.reason === "unauthorized"
          ? 401
          : active.reason === "needs_school_selection"
            ? 409
            : 404;
      return NextResponse.json(
        {
          success: false,
          error:
            active.reason === "needs_school_selection"
              ? "School selection required"
              : "No school associated with user",
        },
        { status }
      );
    }

    await connectToDatabase();

    const school = await School.findById(active.context.schoolId)
      .select("_id name logo motto type status gesSchoolCode curriculumCode timeZone")
      .lean<SchoolProfileFields>();

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeSchool(school),
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
    const active = await resolveActiveSchoolContext();
    if (!active.ok) {
      const status =
        active.reason === "unauthorized"
          ? 401
          : active.reason === "needs_school_selection"
            ? 409
            : 404;
      return NextResponse.json(
        {
          success: false,
          error:
            active.reason === "needs_school_selection"
              ? "School selection required"
              : "No school associated",
        },
        { status }
      );
    }

    const adminGate = gateSchoolAdminRoles(active.context.roles);
    if (!adminGate.ok) {
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

    await connectToDatabase();

    const updated = await School.findByIdAndUpdate(
      active.context.schoolId,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select("_id name logo motto type status gesSchoolCode curriculumCode timeZone")
      .lean<SchoolProfileFields>();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeSchool(updated),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update school";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
