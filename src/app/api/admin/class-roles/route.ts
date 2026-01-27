// src/app/api/admin/class-roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ClassRoleDefinition,
  DEFAULT_CLASS_ROLES,
  type ClassRoleCategory,
} from "@/models/ClassRoleDefinition";
import mongoose from "mongoose";
import { z } from "zod";

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).toUpperCase(),
  category: z.enum(["leadership", "academic", "service", "social", "custom"]),
  description: z.string().max(500).optional(),
  maxPerClass: z.number().min(1).nullable().optional(),
  order: z.number().optional(),
});

/**
 * GET /api/admin/class-roles
 * Fetch all class role definitions for the school
 * Seeds default roles if none exist
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("active") === "1";
    const category = url.searchParams.get("category") as ClassRoleCategory | null;

    // Check if roles exist, seed defaults if not
    const existingCount = await ClassRoleDefinition.countDocuments({ schoolId: schoolIdObj });

    if (existingCount === 0) {
      // Seed default roles
      const defaultRoles = DEFAULT_CLASS_ROLES.map((role, idx) => ({
        schoolId: schoolIdObj,
        name: role.name,
        code: role.code,
        category: role.category,
        description: role.description,
        maxPerClass: role.maxPerClass,
        isDefault: true,
        isActive: true,
        order: idx,
      }));

      await ClassRoleDefinition.insertMany(defaultRoles);
    }

    // Build query
    const query: Record<string, unknown> = { schoolId: schoolIdObj };
    if (activeOnly) query.isActive = true;
    if (category) query.category = category;

    const roles = await ClassRoleDefinition.find(query)
      .sort({ category: 1, order: 1, name: 1 })
      .lean();

    const data = roles.map((role) => ({
      id: String(role._id),
      name: role.name,
      code: role.code,
      category: role.category,
      description: role.description || null,
      maxPerClass: role.maxPerClass ?? null,
      isDefault: role.isDefault,
      isActive: role.isActive,
      order: role.order ?? 0,
    }));

    // Group by category for easier UI consumption
    const grouped = {
      leadership: data.filter((r) => r.category === "leadership"),
      academic: data.filter((r) => r.category === "academic"),
      service: data.filter((r) => r.category === "service"),
      social: data.filter((r) => r.category === "social"),
      custom: data.filter((r) => r.category === "custom"),
    };

    return NextResponse.json({
      success: true,
      data,
      grouped,
      total: data.length,
    });
  } catch (e: unknown) {
    console.error("Error fetching class roles:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch class roles";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/class-roles
 * Create a new custom class role
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const parsed = CreateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await ClassRoleDefinition.findOne({
      schoolId: schoolIdObj,
      code: parsed.data.code,
    }).lean();

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Role with code "${parsed.data.code}" already exists` },
        { status: 409 }
      );
    }

    // Get max order for new role
    const maxOrderRole = await ClassRoleDefinition.findOne({ schoolId: schoolIdObj })
      .sort({ order: -1 })
      .select("order")
      .lean() as { order?: number } | null;
    const nextOrder = (maxOrderRole?.order ?? -1) + 1;

    const role = await ClassRoleDefinition.create({
      schoolId: schoolIdObj,
      name: parsed.data.name,
      code: parsed.data.code,
      category: parsed.data.category || "custom",
      description: parsed.data.description,
      maxPerClass: parsed.data.maxPerClass ?? null,
      isDefault: false,
      isActive: true,
      order: parsed.data.order ?? nextOrder,
    });

    return NextResponse.json({
      success: true,
      message: "Class role created successfully",
      data: {
        id: String(role._id),
        name: role.name,
        code: role.code,
        category: role.category,
        description: role.description || null,
        maxPerClass: role.maxPerClass ?? null,
        isDefault: role.isDefault,
        isActive: role.isActive,
        order: role.order ?? 0,
      },
    });
  } catch (e: unknown) {
    console.error("Error creating class role:", e);
    const message = e instanceof Error ? e.message : "Failed to create class role";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
